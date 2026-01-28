use axum::{
    extract::{State, Extension},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use super::AppState;

#[derive(Debug, Serialize, Deserialize, FromRow)]
pub struct NotificationRecord {
    pub id: i64,
    pub transaction_hash: String,
    pub safe_address: String,
    pub network: String,
    pub monitor_id: String,
    pub transaction_type: String,
    pub notified_at: String,
}

pub async fn list_notifications(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
) -> Result<Json<Vec<NotificationRecord>>, StatusCode> {
    let notifications = sqlx::query_as::<_, NotificationRecord>(
        "SELECT ns.id, ns.transaction_hash, ns.safe_address, ns.network, 
                ns.monitor_id, ns.transaction_type, ns.notified_at
         FROM notification_status ns
         INNER JOIN monitors m ON ns.monitor_id = m.id
         WHERE m.user_id = ?
         ORDER BY ns.notified_at DESC
         LIMIT 100"
    )
    .bind(&user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch notifications: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(notifications))
}

pub async fn mark_as_read() -> Result<Json<()>, StatusCode> {
    Err(StatusCode::NOT_IMPLEMENTED)
}
