use multisigmonitor_backend::worker::MonitorWorker;
use multisigmonitor_backend::config::Config;
use sqlx::sqlite::{SqlitePool, SqliteConnectOptions};
use std::str::FromStr;
use tokio::time::{interval, Duration};
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = Config::from_env().map_err(|e| {
        eprintln!("Configuration error: {}", e);
        eprintln!("\nThe worker cannot start without proper configuration.");
        eprintln!("Please ensure all required environment variables are set.");
        e
    })?;

    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "monitor_worker=info,multisigmonitor_backend=info".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Monitor Worker...");
    tracing::info!("Configuration loaded successfully");

    let options = SqliteConnectOptions::from_str(&config.database_url)?
        .foreign_keys(true)
        .create_if_missing(true);
    let pool = SqlitePool::connect_with(options).await?;

    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("Database migrations completed");

    let worker = MonitorWorker::new(
        pool, 
        config.default_from_email.clone(),
        config.resend_api_key.clone(),
        config.worker_concurrency,
    );

    let polling_interval = std::env::var("POLLING_INTERVAL_SECONDS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(60);

    tracing::info!("Polling interval set to {} seconds", polling_interval);

    tracing::info!("Running initial check...");
    if let Err(e) = worker.run_check().await {
        tracing::error!("Initial check failed: {}", e);
    }

    let mut interval = interval(Duration::from_secs(polling_interval));
    interval.tick().await;

    loop {
        interval.tick().await;
        tracing::debug!("Starting scheduled check");
        
        if let Err(e) = worker.run_check().await {
            tracing::error!("Check cycle failed: {}", e);
        }
    }
}
