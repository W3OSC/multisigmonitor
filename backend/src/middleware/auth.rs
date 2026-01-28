use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use cookie::Cookie;

use crate::services::{AuthService, ApiKeyService};
use crate::api::AppState;

pub async fn auth_middleware(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if let Some(api_key) = extract_api_key(&headers) {
        let user_id = ApiKeyService::verify_api_key(&state.pool, &api_key)
            .await
            .map_err(|e| {
                tracing::error!("API key verification error: {}", e);
                StatusCode::INTERNAL_SERVER_ERROR
            })?
            .ok_or_else(|| {
                tracing::debug!("Invalid or expired API key");
                StatusCode::UNAUTHORIZED
            })?;

        request.extensions_mut().insert(user_id);
        return Ok(next.run(request).await);
    }

    let token = extract_token_from_cookie(&headers)
        .ok_or_else(|| {
            tracing::debug!("No authentication token found in cookies");
            StatusCode::UNAUTHORIZED
        })?;

    let claims = AuthService::verify_token(&token, &state.config.jwt_secret)
        .map_err(|e| {
            tracing::warn!("Token verification failed: {}", e);
            StatusCode::UNAUTHORIZED
        })?;

    request.extensions_mut().insert(claims.sub.clone());

    Ok(next.run(request).await)
}

pub async fn optional_auth_middleware(
    State(state): State<AppState>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    if let Some(api_key) = extract_api_key(&headers) {
        if let Ok(Some(user_id)) = ApiKeyService::verify_api_key(&state.pool, &api_key).await {
            request.extensions_mut().insert(user_id);
        }
        return Ok(next.run(request).await);
    }

    let user_id = extract_token_from_cookie(&headers)
        .and_then(|token| {
            AuthService::verify_token(&token, &state.config.jwt_secret)
                .ok()
                .map(|claims| claims.sub)
        });

    if let Some(id) = user_id {
        request.extensions_mut().insert(id);
    }

    Ok(next.run(request).await)
}

fn extract_api_key(headers: &HeaderMap) -> Option<String> {
    headers
        .get("x-api-key")
        .and_then(|h| h.to_str().ok())
        .map(|s| s.to_string())
}

fn extract_token_from_cookie(headers: &HeaderMap) -> Option<String> {
    headers
        .get("cookie")
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            cookies
                .split(';')
                .filter_map(|cookie_str| Cookie::parse(cookie_str.trim()).ok())
                .find(|cookie| cookie.name() == "token")
                .map(|cookie| cookie.value().to_string())
        })
}
