use axum::routing::get;
use axum::Router;
use sqlx::sqlite::{SqlitePool, SqliteConnectOptions};
use std::net::SocketAddr;
use std::str::FromStr;
use tower_http::cors::CorsLayer;
use tower_http::trace::TraceLayer;
use tower_governor::governor::GovernorConfigBuilder;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;

mod api;
mod config;
mod error;
mod middleware;
mod models;
mod services;
mod types;

use config::Config;
use api::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(
        health,
        api::security_analysis::analyze_transaction,
        api::security_analysis::list_analyses,
        api::security_analysis::get_analysis,
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
            models::security_analysis::TransactionAnalysisRequest,
            models::security_analysis::SafeTransaction,
            models::security_analysis::DataDecoded,
            models::security_analysis::Parameter,
            models::security_analysis::SecurityAnalysisResult,
            models::security_analysis::AnalysisResponse,
            models::security_analysis::RiskLevel,
            models::security_analysis::AnalysisDetail,
            models::security_analysis::CallType,
            models::security_analysis::HashVerification,
            models::security_analysis::NonceCheck,
            models::security_analysis::CalldataInfo,
        )
    ),
    tags(
        (name = "auth", description = "Authentication endpoints"),
        (name = "monitors", description = "Monitor management endpoints"),
        (name = "security", description = "Security analysis endpoints"),
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
    let config = Config::from_env().map_err(|e| {
        eprintln!("Configuration error: {}", e);
        eprintln!("\nThe application cannot start without proper configuration.");
        eprintln!("Please ensure all required environment variables are set.");
        e
    })?;

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "multisigmonitor_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Configuration loaded successfully");

    let options = SqliteConnectOptions::from_str(&config.database_url)?
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
    
    let governor_conf = GovernorConfigBuilder::default()
        .per_second(config.rate_limit_per_second as u64)
        .burst_size(config.rate_limit_per_second * 2)
        .finish()
        .unwrap();

    let cors_origin = config.cors_origin.parse::<axum::http::HeaderValue>()
        .map_err(|e| format!("Invalid CORS_ORIGIN: {}", e))?;

    let cors = CorsLayer::new()
        .allow_origin(cors_origin)
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

    let app_state = AppState {
        pool: pool.clone(),
        nonce_store: nonce_store.clone(),
        config: config.clone(),
    };

    let app = Router::new()
        .route("/health", get(health))
        .merge(SwaggerUi::new("/api-docs").url("/api-docs/openapi.json", ApiDoc::openapi()))
        .nest("/api", api::router(app_state))
        .layer(TraceLayer::new_for_http())
        .layer(cors);

    let governor_limiter = governor_conf.limiter().clone();
    let interval = std::time::Duration::from_secs(60);
    std::thread::spawn(move || {
        loop {
            std::thread::sleep(interval);
            tracing::debug!("rate limiting storage size: {}", governor_limiter.len());
            governor_limiter.retain_recent();
        }
    });

    let addr = SocketAddr::new(config.host, config.port);

    tracing::info!("listening on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app.into_make_service()).await?;

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
