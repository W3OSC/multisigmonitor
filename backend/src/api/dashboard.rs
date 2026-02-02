use axum::{extract::{State, Extension}, Json};
use serde::{Deserialize, Serialize};

use crate::api::AppState;
use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DashboardStats {
    pub active_monitors: i64,
    pub total_transactions: i64,
    pub suspicious_transactions: i64,
    pub recent_alerts: i64,
    pub monitored_networks: Vec<String>,
}

pub async fn get_dashboard_stats(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
) -> Result<Json<DashboardStats>, AppError> {
    let pool = &state.pool;

    let active_monitors = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM monitors WHERE user_id = $1"
    )
    .bind(&user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let total_transactions = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM transactions t 
         INNER JOIN monitors m ON t.monitor_id = m.id 
         WHERE m.user_id = $1"
    )
    .bind(&user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let suspicious_transactions = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM transactions t 
         INNER JOIN monitors m ON t.monitor_id = m.id 
         INNER JOIN security_analyses sa ON t.safe_tx_hash = sa.safe_tx_hash 
         WHERE m.user_id = $1 AND sa.is_suspicious = 1"
    )
    .bind(&user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let recent_alerts = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM notifications n 
         INNER JOIN monitors m ON n.monitor_id = m.id 
         WHERE m.user_id = $1 
         AND datetime(n.notified_at) >= datetime('now', '-7 days')"
    )
    .bind(&user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let monitored_networks: Vec<String> = sqlx::query_scalar::<_, String>(
        "SELECT DISTINCT network FROM monitors WHERE user_id = $1 ORDER BY network"
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    Ok(Json(DashboardStats {
        active_monitors,
        total_transactions,
        suspicious_transactions,
        recent_alerts,
        monitored_networks,
    }))
}
