use axum::{
    extract::{Path, State},
    http::StatusCode,
    Extension, Json,
    response::{IntoResponse, Response},
};
use uuid::Uuid;
use serde_json::json;

use crate::models::monitor::{CreateMonitorRequest, Monitor, MonitorWithLastCheck, UpdateMonitorRequest};
use crate::api::AppState;

pub async fn create_monitor(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Json(payload): Json<CreateMonitorRequest>,
) -> Result<Json<Monitor>, Response> {
    let id = Uuid::new_v4().to_string();
    let settings_json = serde_json::to_string(&payload.settings)
        .map_err(|_| {
            (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "Invalid settings format"}))
            ).into_response()
        })?;
    let now = chrono::Utc::now().to_rfc3339();

    let monitor = sqlx::query_as::<_, Monitor>(
        "INSERT INTO monitors (id, user_id, safe_address, network, settings, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         RETURNING *"
    )
    .bind(&id)
    .bind(&user_id)
    .bind(&payload.safe_address)
    .bind(&payload.network)
    .bind(&settings_json)
    .bind(&now)
    .bind(&now)
    .fetch_one(&state.pool)
    .await
    .map_err(|e| {
        let err_msg = e.to_string();
        if err_msg.contains("UNIQUE constraint failed") {
            tracing::warn!("Monitor already exists for safe_address: {}, network: {}", payload.safe_address, payload.network);
            (
                StatusCode::CONFLICT,
                Json(json!({"error": "A monitor already exists for this address on this network"}))
            ).into_response()
        } else {
            tracing::error!("Failed to create monitor: {}", e);
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": "Failed to create monitor"}))
            ).into_response()
        }
    })?;

    sqlx::query(
        "INSERT INTO last_checks (id, monitor_id, safe_address, network, checked_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&id)
    .bind(&payload.safe_address)
    .bind(&payload.network)
    .bind(&now)
    .bind(&now)
    .bind(&now)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to initialize last_checks: {}", e);
        (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": "Failed to initialize monitor checks"}))
        ).into_response()
    })?;

    Ok(Json(monitor))
}

pub async fn list_monitors(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
) -> Result<Json<Vec<MonitorWithLastCheck>>, StatusCode> {
    tracing::info!("Listing monitors for user_id: {}", user_id);
    
    let monitors = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE user_id = ? ORDER BY created_at DESC"
    )
    .bind(&user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to list monitors: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    
    tracing::info!("Found {} monitors for user {}", monitors.len(), user_id);

    // Fetch last check times for each monitor
    let mut monitors_with_checks = Vec::new();
    for monitor in monitors {
        let last_check = sqlx::query_scalar::<_, Option<String>>(
            "SELECT checked_at FROM last_checks WHERE monitor_id = ?"
        )
        .bind(&monitor.id)
        .fetch_optional(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to fetch last check: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .flatten();

        monitors_with_checks.push(MonitorWithLastCheck {
            monitor,
            last_checked_at: last_check,
        });
    }

    Ok(Json(monitors_with_checks))
}

pub async fn get_monitor(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Path(id): Path<String>,
) -> Result<Json<Monitor>, StatusCode> {
    let monitor = sqlx::query_as::<_, Monitor>(
        "SELECT * FROM monitors WHERE id = ? AND user_id = ?"
    )
    .bind(&id)
    .bind(&user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to get monitor: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(monitor))
}

pub async fn update_monitor(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateMonitorRequest>,
) -> Result<Json<Monitor>, StatusCode> {
    let settings_json = serde_json::to_string(&payload.settings)
        .map_err(|_| StatusCode::BAD_REQUEST)?;
    let now = chrono::Utc::now().to_rfc3339();

    let monitor = sqlx::query_as::<_, Monitor>(
        "UPDATE monitors SET settings = ?, updated_at = ? WHERE id = ? AND user_id = ?
         RETURNING *"
    )
    .bind(&settings_json)
    .bind(&now)
    .bind(&id)
    .bind(&user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to update monitor: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(monitor))
}

pub async fn delete_monitor(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Path(id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query("DELETE FROM monitors WHERE id = ? AND user_id = ?")
        .bind(&id)
        .bind(&user_id)
        .execute(&state.pool)
        .await
        .map_err(|e| {
            tracing::error!("Failed to delete monitor: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}
