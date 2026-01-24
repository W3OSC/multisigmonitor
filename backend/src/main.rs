use axum::routing::get;
use axum::Router;
use sqlx::sqlite::{SqlitePool, SqliteConnectOptions};
use std::net::SocketAddr;
use std::str::FromStr;
use std::num::NonZeroU32;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tower_governor::{governor::GovernorConfigBuilder, GovernorLayer};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

mod api;
mod middleware;
mod models;
mod services;

#[derive(OpenApi)]
#[openapi(
    paths(
        health,
    ),
    components(
        schemas(
            models::user::User,
            models::user::UserResponse,
            models::user::AuthResponse,
            models::monitor::Monitor,
            models::monitor::MonitorSettings,
            models::monitor::NotificationChannel,
            models::monitor::CreateMonitorRequest,
            models::monitor::UpdateMonitorRequest,
        )
    ),
    tags(
        (name = "auth", description = "Authentication endpoints"),
        (name = "monitors", description = "Monitor management endpoints"),
        (name = "health", description = "Health check endpoints")
    ),
    info(
        title = "Multisig Monitor API",
        version = "0.1.0",
        description = "API for monitoring multisignature wallets",
    )
)]
struct ApiDoc;

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let env_file = if cfg!(debug_assertions) {
        "../secrets/.env.backend.local"
    } else {
        "../secrets/.env.backend.prod"
    };
    dotenvy::from_filename(env_file).ok();

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "multisigmonitor_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    let database_url = std::env::var("DATABASE_URL")?;
    let options = SqliteConnectOptions::from_str(&database_url)?
        .foreign_keys(true)
        .create_if_missing(true);
    let pool = SqlitePool::connect_with(options).await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    let nonce_store = services::NonceStore::new();
    
    let cleanup_nonce_store = nonce_store.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(300));
        loop {
            interval.tick().await;
            cleanup_nonce_store.cleanup_expired().await;
        }
    });
    
    let rate_limit_per_second = std::env::var("RATE_LIMIT_PER_SECOND")
        .ok()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(10);
    
    let governor_conf = GovernorConfigBuilder::default()
        .per_second(rate_limit_per_second as u64)
        .burst_size(rate_limit_per_second * 2)
        .finish()
        .unwrap();

    let cors = CorsLayer::new()
        .allow_origin(std::env::var("CORS_ORIGIN")?
            .parse::<axum::http::HeaderValue>()
            .unwrap())
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PUT,
            axum::http::Method::DELETE,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers([
            axum::http::header::CONTENT_TYPE,
            axum::http::header::AUTHORIZATION,
            axum::http::header::COOKIE,
        ])
        .allow_credentials(true);

    let app = Router::new()
        .route("/health", get(health))
        .merge(SwaggerUi::new("/api-docs").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .nest("/api", api::router(pool.clone(), nonce_store.clone()))
        .layer(TraceLayer::new_for_http())
        .layer(cors)
        .with_state((pool, nonce_store));

    let governor_limiter = governor_conf.limiter().clone();
    let interval = std::time::Duration::from_secs(60);
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(interval);
            tracing::debug!("rate limiting storage size: {}", governor_limiter.len());
            governor_limiter.retain_recent();
        }
    });

    let host = std::env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string());
    let port = std::env::var("PORT").unwrap_or_else(|_| "3000".to_string());
    let addr: SocketAddr = format!("{}:{}", host, port).parse()?;

    tracing::info!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[utoipa::path(
    get,
    path = "/health",
    tag = "health",
    responses(
        (status = 200, description = "Service is healthy", body = String)
    )
)]
async fn health() -> &'static str {
    "OK"
}
