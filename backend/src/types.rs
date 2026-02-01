use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum NotificationChannel {
    Telegram {
        chat_id: String,
    },
    Webhook {
        url: String,
        webhook_type: WebhookType,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum WebhookType {
    Discord,
    Slack,
    Generic,
}
