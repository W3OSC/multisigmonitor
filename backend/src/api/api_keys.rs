use axum::{
    extract::{Extension, Path, State},
    http::StatusCode,
    Json,
};
use chrono::Utc;

use crate::api::AppState;
use crate::models::api_key::{ApiKeyResponse, CreateApiKeyRequest, CreateApiKeyResponse};
use crate::services::ApiKeyService;

#[utoipa::path(
    post,
    path = "/api/api-keys",
    request_body = CreateApiKeyRequest,
    responses(
        (status = 201, description = "API key created successfully", body = CreateApiKeyResponse),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("cookie_auth" = [])
    ),
    tag = "api-keys"
)]
pub async fn create_api_key(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Json(payload): Json<CreateApiKeyRequest>,
) -> Result<(StatusCode, Json<CreateApiKeyResponse>), StatusCode> {
    let name = payload.name
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| {
            let timestamp = Utc::now().format("%Y-%m-%d %H:%M");
            format!("API Key {}", timestamp)
        });

    let api_key = ApiKeyService::create_api_key(&state.pool, &user_id, &name)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create API key: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok((StatusCode::CREATED, Json(api_key)))
}

#[utoipa::path(
    get,
    path = "/api/api-keys",
    responses(
        (status = 200, description = "List of API keys", body = Vec<ApiKeyResponse>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("cookie_auth" = [])
    ),
    tag = "api-keys"
)]
pub async fn list_api_keys(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
) -> Result<Json<Vec<ApiKeyResponse>>, StatusCode> {
    let keys = ApiKeyService::get_user_api_keys(&state.pool, &user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list API keys: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(Json(keys))
}

#[utoipa::path(
    delete,
    path = "/api/api-keys/{id}",
    params(
        ("id" = String, Path, description = "API key ID")
    ),
    responses(
        (status = 204, description = "API key revoked successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    security(
        ("cookie_auth" = [])
    ),
    tag = "api-keys"
)]
pub async fn revoke_api_key(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Path(key_id): Path<String>,
) -> Result<StatusCode, StatusCode> {
    ApiKeyService::revoke_api_key(&state.pool, &user_id, &key_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to revoke API key: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    Ok(StatusCode::NO_CONTENT)
}
