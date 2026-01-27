use serde::{Deserialize, Serialize};

pub mod email;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Alert {
    pub safe_address: String,
    pub network: String,
    pub transaction_hash: String,
    pub alert_type: AlertType,
    pub description: String,
    pub nonce: u64,
    pub is_executed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum AlertType {
    Suspicious,
    Management,
    Normal,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum NotificationChannel {
    Email {
        email: String,
    },
    Telegram {
        bot_api_key: String,
        chat_id: String,
    },
    Webhook {
        url: String,
        webhook_type: WebhookType,
    },
}

#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum WebhookType {
    Discord,
    Slack,
    Generic,
}

pub struct NotificationService {
    from_email: String,
    resend_api_key: Option<String>,
}

impl NotificationService {
    pub fn new(from_email: String, resend_api_key: Option<String>) -> Self {
        Self {
            from_email,
            resend_api_key,
        }
    }

    pub async fn send_notification(
        &self,
        alert: &Alert,
        channel: &NotificationChannel,
    ) -> Result<(), Box<dyn std::error::Error>> {
        match channel {
            NotificationChannel::Email { email } => {
                self.send_email(alert, email).await?;
            }
            NotificationChannel::Telegram { bot_api_key, chat_id } => {
                self.send_telegram(alert, bot_api_key, chat_id).await?;
            }
            NotificationChannel::Webhook { url, webhook_type } => {
                self.send_webhook(alert, url, webhook_type).await?;
            }
        }
        Ok(())
    }

    async fn send_email(
        &self,
        alert: &Alert,
        to_email: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let api_key = self.resend_api_key.as_ref()
            .ok_or("RESEND_API_KEY not configured")?;

        let subject = match alert.alert_type {
            AlertType::Suspicious => format!("⚠️ SUSPICIOUS TRANSACTION - {}", alert.network),
            AlertType::Management => format!("🔧 Safe Configuration Change - {}", alert.network),
            AlertType::Normal => format!("📝 New Transaction - {}", alert.network),
        };

        let html_body = email::generate_email_html(alert);
        let text_body = email::generate_email_text(alert);

        let payload = serde_json::json!({
            "from": self.from_email,
            "to": [to_email],
            "subject": subject,
            "html": html_body,
            "text": text_body,
        });

        let client = reqwest::Client::new();
        let response = client
            .post("https://api.resend.com/emails")
            .header("Authorization", format!("Bearer {}", api_key))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Resend API error: {}", error_text).into());
        }

        tracing::info!("Email sent to {} for transaction {}", to_email, alert.transaction_hash);
        Ok(())
    }

    async fn send_telegram(
        &self,
        alert: &Alert,
        bot_api_key: &str,
        chat_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let safe_app_link = format!(
            "https://app.safe.global/transactions/tx?safe={}:{}&id=multisig_{}_{}",
            alert.network, alert.safe_address, alert.safe_address, alert.transaction_hash
        );

        let emoji = match alert.alert_type {
            AlertType::Suspicious => "⚠️",
            AlertType::Management => "🔧",
            AlertType::Normal => "📝",
        };

        let message = format!(
            "{} *{}*\n\n\
            *Network:* {}\n\
            *Safe:* `{}`\n\
            *Description:* {}\n\
            *Nonce:* {}\n\
            *Status:* {}\n\n\
            [View in Safe App]({})",
            emoji,
            match alert.alert_type {
                AlertType::Suspicious => "SUSPICIOUS TRANSACTION",
                AlertType::Management => "Safe Configuration Change",
                AlertType::Normal => "New Transaction",
            },
            alert.network,
            alert.safe_address,
            alert.description,
            alert.nonce,
            if alert.is_executed { "✅ Executed" } else { "⏳ Awaiting execution" },
            safe_app_link
        );

        let client = reqwest::Client::new();
        let url = format!("https://api.telegram.org/bot{}/sendMessage", bot_api_key);

        let payload = serde_json::json!({
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "Markdown",
            "disable_web_page_preview": true,
        });

        let response = client
            .post(&url)
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Telegram API error: {}", error_text).into());
        }

        tracing::info!("Telegram notification sent to chat {} for transaction {}", chat_id, alert.transaction_hash);
        Ok(())
    }

    async fn send_webhook(
        &self,
        alert: &Alert,
        url: &str,
        webhook_type: &WebhookType,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let client = reqwest::Client::new();

        let payload = match webhook_type {
            WebhookType::Discord => self.format_discord_webhook(alert),
            WebhookType::Slack => self.format_slack_webhook(alert),
            WebhookType::Generic => serde_json::json!(alert),
        };

        let response = client
            .post(url)
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await?;
            return Err(format!("Webhook error: {}", error_text).into());
        }

        tracing::info!("Webhook sent to {} for transaction {}", url, alert.transaction_hash);
        Ok(())
    }

    fn format_discord_webhook(&self, alert: &Alert) -> serde_json::Value {
        let color = match alert.alert_type {
            AlertType::Suspicious => 0xFF0000, // Red
            AlertType::Management => 0xFFA500, // Orange
            AlertType::Normal => 0x00FF00,     // Green
        };

        serde_json::json!({
            "embeds": [{
                "title": match alert.alert_type {
                    AlertType::Suspicious => "⚠️ SUSPICIOUS TRANSACTION",
                    AlertType::Management => "🔧 Safe Configuration Change",
                    AlertType::Normal => "📝 New Transaction",
                },
                "color": color,
                "fields": [
                    {
                        "name": "Network",
                        "value": &alert.network,
                        "inline": true
                    },
                    {
                        "name": "Safe Address",
                        "value": &alert.safe_address,
                        "inline": true
                    },
                    {
                        "name": "Description",
                        "value": &alert.description,
                        "inline": false
                    },
                    {
                        "name": "Nonce",
                        "value": alert.nonce.to_string(),
                        "inline": true
                    },
                    {
                        "name": "Status",
                        "value": if alert.is_executed { "Executed" } else { "Pending" },
                        "inline": true
                    }
                ],
                "url": format!(
                    "https://app.safe.global/transactions/tx?safe={}:{}&id=multisig_{}_{}",
                    alert.network, alert.safe_address, alert.safe_address, alert.transaction_hash
                )
            }]
        })
    }

    fn format_slack_webhook(&self, alert: &Alert) -> serde_json::Value {
        let emoji = match alert.alert_type {
            AlertType::Suspicious => ":warning:",
            AlertType::Management => ":wrench:",
            AlertType::Normal => ":memo:",
        };

        serde_json::json!({
            "text": format!("{} {} Transaction Alert", emoji, alert.network),
            "blocks": [
                {
                    "type": "section",
                    "text": {
                        "type": "mrkdwn",
                        "text": format!(
                            "*{}*\n*Network:* {}\n*Safe:* `{}`\n*Description:* {}\n*Nonce:* {}\n*Status:* {}",
                            match alert.alert_type {
                                AlertType::Suspicious => "SUSPICIOUS TRANSACTION",
                                AlertType::Management => "Safe Configuration Change",
                                AlertType::Normal => "New Transaction",
                            },
                            alert.network,
                            alert.safe_address,
                            alert.description,
                            alert.nonce,
                            if alert.is_executed { "Executed" } else { "Pending" }
                        )
                    }
                },
                {
                    "type": "actions",
                    "elements": [
                        {
                            "type": "button",
                            "text": {
                                "type": "plain_text",
                                "text": "View in Safe App"
                            },
                            "url": format!(
                                "https://app.safe.global/transactions/tx?safe={}:{}&id=multisig_{}_{}",
                                alert.network, alert.safe_address, alert.safe_address, alert.transaction_hash
                            )
                        }
                    ]
                }
            ]
        })
    }
}
