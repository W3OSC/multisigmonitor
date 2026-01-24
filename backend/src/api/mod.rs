use axum::{
    middleware,
    routing::{get, post, put, delete},
    Router,
};
use sqlx::SqlitePool;

use crate::middleware::{auth_middleware, optional_auth_middleware};

pub mod auth;
pub mod monitors;
pub mod notifications;

type AppState = (SqlitePool, crate::services::NonceStore);

pub fn router(pool: SqlitePool, nonce_store: crate::services::NonceStore) -> Router<AppState> {
    let protected = Router::new()
        .route("/auth/me", get(auth::me))
        .route("/monitors", post(monitors::create_monitor))
        .route("/monitors", get(monitors::list_monitors))
        .route("/monitors/:id", get(monitors::get_monitor))
        .route("/monitors/:id", put(monitors::update_monitor))
        .route("/monitors/:id", delete(monitors::delete_monitor))
        .route("/notifications", get(notifications::list_notifications))
        .route("/notifications/:id", put(notifications::mark_as_read))
        .route_layer(middleware::from_fn_with_state(
            (pool.clone(), nonce_store.clone()),
            auth_middleware,
        ));

    Router::new()
        .route("/auth/google", post(auth::google_auth))
        .route("/auth/google/callback", post(auth::google_callback))
        .route("/auth/github/callback", post(auth::github_callback))
        .route("/auth/ethereum/nonce", post(auth::ethereum_nonce))
        .route("/auth/ethereum/verify", post(auth::ethereum_verify))
        .route("/auth/logout", post(auth::logout))
        .merge(protected)
        .with_state((pool, nonce_store))
}
