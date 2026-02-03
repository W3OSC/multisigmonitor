use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WorkerActivity {
    pub id: String,
    pub user_id: String,
    pub monitor_id: Option<String>,
    pub event_type: String,
    pub safe_address: Option<String>,
    pub network: Option<String>,
    pub message: String,
    pub metadata: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActivityEventType {
    ScanStarted,
    ScanCompleted,
    TransactionFound,
    TransactionAnalyzed,
    AlertSent,
    ScanError,
}

impl ActivityEventType {
    pub fn as_str(&self) -> &'static str {
        match self {
            ActivityEventType::ScanStarted => "scan_started",
            ActivityEventType::ScanCompleted => "scan_completed",
            ActivityEventType::TransactionFound => "transaction_found",
            ActivityEventType::TransactionAnalyzed => "transaction_analyzed",
            ActivityEventType::AlertSent => "alert_sent",
            ActivityEventType::ScanError => "scan_error",
        }
    }
}
