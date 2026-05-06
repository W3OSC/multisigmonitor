use multisigmonitor_backend::worker::MonitorWorker;
use multisigmonitor_backend::config::Config;
use sqlx::sqlite::{SqlitePool, SqliteConnectOptions};
use std::str::FromStr;
use tokio::time::Duration;
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

    let polling_interval_secs = std::env::var("POLLING_INTERVAL_SECONDS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(3600);

    let address_delay_min_secs = std::env::var("MONITOR_ADDRESS_DELAY_MIN_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(3);

    let address_delay_max_secs = std::env::var("MONITOR_ADDRESS_DELAY_MAX_SECS")
        .ok()
        .and_then(|s| s.parse::<u64>().ok())
        .unwrap_or(10);

    if address_delay_min_secs > address_delay_max_secs {
        eprintln!(
            "Configuration error: MONITOR_ADDRESS_DELAY_MIN_SECS ({}) must be <= MONITOR_ADDRESS_DELAY_MAX_SECS ({})",
            address_delay_min_secs, address_delay_max_secs
        );
        std::process::exit(1);
    }

    tracing::info!(
        "Polling interval: {}s, address delay: {}–{}s",
        polling_interval_secs, address_delay_min_secs, address_delay_max_secs
    );

    let worker = MonitorWorker::new(
        pool,
        config.telegram_bot_token.clone(),
        config.safe_api_key.clone(),
        address_delay_min_secs,
        address_delay_max_secs,
    );

    loop {
        tokio::time::sleep(Duration::from_secs(polling_interval_secs)).await;
        tracing::debug!("Starting scheduled check");
        if let Err(e) = worker.run_check().await {
            tracing::error!("Check cycle failed: {}", e);
        }
    }
}
