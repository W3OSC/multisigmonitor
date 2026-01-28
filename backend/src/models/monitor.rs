use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, ToSchema)]
pub struct Monitor {
    pub id: String,
    pub user_id: String,
    pub safe_address: String,
    pub network: String,
    pub settings: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct MonitorWithLastCheck {
    #[serde(flatten)]
    pub monitor: Monitor,
    pub last_checked_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct MonitorSettings {
    pub active: bool,
    pub email_notifications: Option<bool>,
    pub webhook_notifications: Option<bool>,
    pub telegram_notifications: Option<bool>,
    pub notification_channels: Option<Vec<NotificationChannel>>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct NotificationChannel {
    pub channel_type: String,
    pub enabled: bool,
    pub config: serde_json::Value,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreateMonitorRequest {
    pub safe_address: String,
    pub network: String,
    pub settings: MonitorSettings,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct UpdateMonitorRequest {
    pub settings: MonitorSettings,
}
