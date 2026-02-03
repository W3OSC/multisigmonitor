use axum::{
    extract::{Query, State},
    http::StatusCode,
    Extension, Json,
};
use serde::{Deserialize, Serialize};
use crate::api::AppState;
use crate::models::worker_activity::WorkerActivity;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityQuery {
    pub limit: Option<i32>,
    pub event_type: Option<String>,
    pub monitor_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityResponse {
    pub activities: Vec<WorkerActivity>,
    pub total: i64,
}

pub async fn list_activity(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Query(query): Query<ActivityQuery>,
) -> Result<Json<ActivityResponse>, StatusCode> {
    let limit = query.limit.unwrap_or(50).min(100);

    let mut sql = String::from(
        "SELECT id, user_id, monitor_id, event_type, safe_address, network, message, metadata, created_at 
         FROM worker_activity 
         WHERE user_id = ?"
    );
    
    let mut params: Vec<String> = vec![user_id.clone()];

    if let Some(ref event_type) = query.event_type {
        sql.push_str(" AND event_type = ?");
        params.push(event_type.clone());
    }

    if let Some(ref monitor_id) = query.monitor_id {
        sql.push_str(" AND monitor_id = ?");
        params.push(monitor_id.clone());
    }

    sql.push_str(" ORDER BY created_at DESC LIMIT ?");

    let activities = match (query.event_type.as_ref(), query.monitor_id.as_ref()) {
        (Some(event_type), Some(monitor_id)) => {
            sqlx::query_as::<_, WorkerActivity>(&sql)
                .bind(&user_id)
                .bind(event_type)
                .bind(monitor_id)
                .bind(limit)
                .fetch_all(&state.pool)
                .await
        }
        (Some(event_type), None) => {
            sqlx::query_as::<_, WorkerActivity>(&sql)
                .bind(&user_id)
                .bind(event_type)
                .bind(limit)
                .fetch_all(&state.pool)
                .await
        }
        (None, Some(monitor_id)) => {
            sqlx::query_as::<_, WorkerActivity>(&sql)
                .bind(&user_id)
                .bind(monitor_id)
                .bind(limit)
                .fetch_all(&state.pool)
                .await
        }
        (None, None) => {
            sqlx::query_as::<_, WorkerActivity>(&sql)
                .bind(&user_id)
                .bind(limit)
                .fetch_all(&state.pool)
                .await
        }
    }.map_err(|e| {
        tracing::error!("Failed to fetch activity: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let total: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM worker_activity WHERE user_id = ?"
    )
    .bind(&user_id)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to count activity: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(ActivityResponse {
        activities,
        total: total.0,
    }))
}

pub async fn clear_activity(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query("DELETE FROM worker_activity WHERE user_id = ?")
        .bind(&user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to clear activity: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}
