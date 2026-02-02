use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

pub use crate::types::NotificationChannel;

#[derive(Debug, Clone, FromRow, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
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
#[serde(rename_all = "camelCase")]
pub struct MonitorWithLastCheck {
    #[serde(flatten)]
    pub monitor: Monitor,
    pub last_checked_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MonitorSettings {
    pub active: bool,
    pub email_notifications: Option<bool>,
    pub webhook_notifications: Option<bool>,
    pub telegram_notifications: Option<bool>,
    pub notification_channels: Option<Vec<NotificationChannel>>,
    pub notify_all: Option<bool>,
    pub notify_management: Option<bool>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateMonitorRequest {
    pub safe_address: String,
    pub network: String,
    pub settings: MonitorSettings,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateMonitorRequest {
    pub settings: MonitorSettings,
}
