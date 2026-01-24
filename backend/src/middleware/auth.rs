use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    middleware::Next,
    response::Response,
};
use sqlx::SqlitePool;

use crate::services::AuthService;

type AppState = (SqlitePool, crate::services::NonceStore);

pub async fn auth_middleware(
    State((pool, _)): State<AppState>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let token = headers
        .get("cookie")
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            cookies
                .split(';')
                .find_map(|cookie| {
                    let (key, value) = cookie.trim().split_once('=')?;
                    if key == "token" {
                        Some(value)
                    } else {
                        None
                    }
                })
        })
        .ok_or(StatusCode::UNAUTHORIZED)?;

    let claims = AuthService::verify_token(token)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    request.extensions_mut().insert(claims.sub.clone());
    request.extensions_mut().insert(pool);

    Ok(next.run(request).await)
}

pub async fn optional_auth_middleware(
    State((pool, _)): State<AppState>,
    headers: HeaderMap,
    mut request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let user_id = headers
        .get("cookie")
        .and_then(|h| h.to_str().ok())
        .and_then(|cookies| {
            cookies
                .split(';')
                .find_map(|cookie| {
                    let (key, value) = cookie.trim().split_once('=')?;
                    if key == "token" {
                        Some(value)
                    } else {
                        None
                    }
                })
        })
        .and_then(|token| {
            AuthService::verify_token(token)
                .ok()
                .map(|claims| claims.sub)
        });

    request.extensions_mut().insert(user_id);
    request.extensions_mut().insert(pool);

    Ok(next.run(request).await)
}
