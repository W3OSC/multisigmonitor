use serde::{Deserialize, Serialize};
use serde_json::Value;

pub use crate::types::{NotificationChannel, WebhookType};

#[derive(Default)]
pub struct MsgBuilder {
    text: String,
    entities: Vec<Value>,
}

impl MsgBuilder {
    pub fn new() -> Self { Self::default() }

    fn utf16_len(s: &str) -> usize { s.encode_utf16().count() }

    fn current_offset(&self) -> usize { Self::utf16_len(&self.text) }

    pub fn plain(mut self, s: &str) -> Self { self.text.push_str(s); self }

    pub fn bold(mut self, s: &str) -> Self {
        let offset = self.current_offset();
        let length = Self::utf16_len(s);
        self.entities.push(serde_json::json!({"type":"bold","offset":offset,"length":length}));
        self.text.push_str(s);
        self
    }

    pub fn code(mut self, s: &str) -> Self {
        let offset = self.current_offset();
        let length = Self::utf16_len(s);
        self.entities.push(serde_json::json!({"type":"code","offset":offset,"length":length}));
        self.text.push_str(s);
        self
    }

    pub fn text_link(mut self, label: &str, url: &str) -> Self {
        let offset = self.current_offset();
        let length = Self::utf16_len(label);
        self.entities.push(serde_json::json!({
            "type": "text_link",
            "offset": offset,
            "length": length,
            "url": url
        }));
        self.text.push_str(label);
        self
    }

    pub fn build(self) -> (String, Vec<Value>) { (self.text, self.entities) }
}

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


pub struct NotificationService {
    telegram_bot_token: Option<String>,
    http_client: reqwest::Client,
}

impl NotificationService {
    pub fn new(telegram_bot_token: Option<String>) -> Self {
        Self {
            telegram_bot_token,
            http_client: reqwest::Client::new(),
        }
    }

    pub async fn send_notification(
        &self,
        alert: &Alert,
        channel: &NotificationChannel,
    ) -> Result<(), Box<dyn std::error::Error>> {
        match channel {
            NotificationChannel::Telegram { chat_id } => {
                self.send_telegram(alert, chat_id).await?;
            }
            NotificationChannel::Webhook { url, webhook_type } => {
                self.send_webhook(alert, url, webhook_type).await?;
            }
        }
        Ok(())
    }

    async fn send_telegram(
        &self,
        alert: &Alert,
        chat_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let safe_app_link = format!(
            "https://app.safe.global/transactions/tx?safe={}:{}&id=multisig_{}_{}",
            alert.network, alert.safe_address, alert.safe_address, alert.transaction_hash
        );

        let title = match alert.alert_type {
            AlertType::Suspicious => "SUSPICIOUS TRANSACTION",
            AlertType::Management => "Safe Configuration Change",
            AlertType::Normal => "New Transaction",
        };

        let status = if alert.is_executed { "Executed" } else { "Pending" };

        let (text, entities) = MsgBuilder::new()
            .bold(title)
            .plain("\n\nNetwork: ")
            .bold(&alert.network)
            .plain("\nSafe: ")
            .code(&alert.safe_address)
            .plain("\nDescription: ")
            .plain(&alert.description)
            .plain("\nNonce: ")
            .plain(&alert.nonce.to_string())
            .plain("\nStatus: ")
            .plain(status)
            .plain("\n\n")
            .text_link("View in Safe App", &safe_app_link)
            .build();

        let token = self.telegram_bot_token.as_ref()
            .ok_or("Telegram bot token not configured")?;
        let url = format!("https://api.telegram.org/bot{}/sendMessage", token);

        let payload = serde_json::json!({
            "chat_id": chat_id,
            "text": text,
            "entities": entities,
            "disable_web_page_preview": true,
        });

        let response = self.http_client
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
        let payload = match webhook_type {
            WebhookType::Discord => self.format_discord_webhook(alert),
            WebhookType::Slack => self.format_slack_webhook(alert),
            WebhookType::Generic => serde_json::json!(alert),
        };

        let response = self.http_client
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
            AlertType::Suspicious => 0xFF0000,
            AlertType::Management => 0xFFA500,
            AlertType::Normal => 0x00FF00,
        };

        serde_json::json!({
            "embeds": [{
                "title": match alert.alert_type {
                    AlertType::Suspicious => "SUSPICIOUS TRANSACTION",
                    AlertType::Management => "Safe Configuration Change",
                    AlertType::Normal => "New Transaction",
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
