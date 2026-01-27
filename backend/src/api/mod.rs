use axum::{
    middleware,
    routing::{get, post, put, delete},
    Router,
};
use sqlx::SqlitePool;

use crate::middleware::auth_middleware;
use crate::config::Config;

pub mod auth;
pub mod monitors;
pub mod notifications;
pub mod security_analysis;
pub mod transactions;
pub mod sanctions;
pub mod multisig_info;
pub mod discord_oauth;

#[cfg(test)]
mod transaction_data_tests;

#[derive(Clone)]
pub struct AppState {
    pub pool: SqlitePool,
    pub nonce_store: crate::services::NonceStore,
    pub config: Config,
}

pub fn router(state: AppState) -> Router<AppState> {
    let protected_routes = Router::new()
        .route("/monitors", post(monitors::create_monitor))
        .route("/monitors", get(monitors::list_monitors))
        .route("/monitors/:id", get(monitors::get_monitor))
        .route("/monitors/:id", put(monitors::update_monitor))
        .route("/monitors/:id", delete(monitors::delete_monitor))
        .route("/notifications", get(notifications::list_notifications))
        .route("/notifications/:id", put(notifications::mark_as_read))
        .route("/transactions", get(transactions::list_transactions))
        .route("/transactions/:id", get(transactions::get_transaction))
        .route("/security/analyze", post(security_analysis::analyze_transaction))
        .route("/security/safe-review", post(security_analysis::save_safe_review))
        .route("/security/analyses", get(security_analysis::list_analyses))
        .route("/security/analyses", delete(security_analysis::delete_all_analyses))
        .route("/security/analyses/:id", get(security_analysis::get_analysis))
        .route("/security/analyses/:id", delete(security_analysis::delete_analysis))
        .route("/sanctions/check", post(sanctions::check_sanctions))
        .route("/multisig/info", post(multisig_info::get_multisig_info))
        .route("/discord/oauth/start", get(discord_oauth::discord_oauth_start))
        .route("/discord/oauth/callback", get(discord_oauth::discord_oauth_callback))
        .route("/auth/me", get(auth::me))
        .route("/auth/logout", post(auth::logout))
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ));

    let public_routes = Router::new()
        .route("/auth/google", post(auth::google_auth))
        .route("/auth/google/callback", post(auth::google_callback))
        .route("/auth/github/callback", post(auth::github_callback))
        .route("/auth/ethereum/nonce", post(auth::ethereum_nonce))
        .route("/auth/ethereum/verify", post(auth::ethereum_verify));

    Router::new()
        .merge(protected_routes)
        .merge(public_routes)
        .with_state(state)
}
