use serde::{Deserialize, Serialize};
use reqwest::Client;
use sqlx::SqlitePool;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;

const SAFE_INFO_DB_TTL_SECS: i64 = 3600;
const RATE_LIMIT_RESET_CAP: Duration = Duration::from_secs(3600);
const RATE_LIMIT_MAX_INLINE_WAIT: Duration = Duration::from_secs(10);

pub enum SafeApiError {
    UnsupportedNetwork(String),
    NotFound(String),
    RateLimited(String),
    NetworkError(String),
    ParseError(String),
}

impl std::fmt::Display for SafeApiError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SafeApiError::UnsupportedNetwork(net) => write!(f, "Unsupported network: {}", net),
            SafeApiError::NotFound(msg) => write!(f, "Not found: {}", msg),
            SafeApiError::RateLimited(msg) => write!(f, "Rate limited: {}", msg),
            SafeApiError::NetworkError(msg) => write!(f, "Network error: {}", msg),
            SafeApiError::ParseError(msg) => write!(f, "Parse error: {}", msg),
        }
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SafeApiResponse {
    pub address: String,
    #[serde(deserialize_with = "deserialize_nonce")]
    pub nonce: u64,
    pub threshold: u32,
    pub owners: Vec<String>,
    #[serde(rename = "masterCopy")]
    pub master_copy: Option<String>,
    pub modules: Vec<String>,
    #[serde(rename = "fallbackHandler")]
    pub fallback_handler: Option<String>,
    pub guard: Option<String>,
    pub version: Option<String>,
}

fn deserialize_nonce<'de, D>(deserializer: D) -> Result<u64, D::Error>
where
    D: serde::Deserializer<'de>,
{
    use serde::de::Error;
    let s = String::deserialize(deserializer)?;
    s.parse::<u64>().map_err(D::Error::custom)
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct SafeCreationInfo {
    pub created: String,
    pub creator: String,
    #[serde(rename = "transactionHash")]
    pub transaction_hash: String,
    #[serde(rename = "factoryAddress")]
    pub factory_address: Option<String>,
    #[serde(rename = "masterCopy")]
    pub master_copy: Option<String>,
}

pub fn get_safe_api_url(network: &str) -> Option<&'static str> {
    match network {
        "ethereum" => Some("https://api.safe.global/tx-service/eth"),
        "sepolia" => Some("https://api.safe.global/tx-service/sep"),
        "polygon" => Some("https://api.safe.global/tx-service/pol"),
        "arbitrum" => Some("https://api.safe.global/tx-service/arb1"),
        "optimism" => Some("https://api.safe.global/tx-service/oeth"),
        "base" => Some("https://api.safe.global/tx-service/base"),
        _ => None,
    }
}

pub fn get_safe_api_fallback_url(network: &str) -> Option<&'static str> {
    match network {
        "ethereum" => Some("https://safe-transaction-mainnet.safe.global"),
        "sepolia" => Some("https://safe-transaction-sepolia.safe.global"),
        "polygon" => Some("https://safe-transaction-polygon.safe.global"),
        "arbitrum" => Some("https://safe-transaction-arbitrum.safe.global"),
        "optimism" => Some("https://safe-transaction-optimism.safe.global"),
        "base" => Some("https://safe-transaction-base.safe.global"),
        _ => None,
    }
}


#[derive(Debug)]
struct RateLimitState {
    reset_at: Option<tokio::time::Instant>,
}

#[derive(Clone)]
pub struct CachedSafeClient {
    client: Client,
    fallback_client: Client,
    pool: SqlitePool,
    rate_limit: Arc<Mutex<RateLimitState>>,
}

impl CachedSafeClient {
    pub fn new(api_key: Option<String>, pool: SqlitePool) -> Self {
        let mut client_builder = Client::builder();
        if let Some(key) = api_key {
            let mut headers = reqwest::header::HeaderMap::new();
            let auth_value = reqwest::header::HeaderValue::from_str(&format!("Bearer {}", key))
                .expect("Invalid Safe API key format");
            headers.insert(reqwest::header::AUTHORIZATION, auth_value);
            client_builder = client_builder.default_headers(headers);
        }
        let client = client_builder.build().unwrap_or_else(|_| Client::new());
        let fallback_client = Client::builder()
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self {
            client,
            fallback_client,
            pool,
            rate_limit: Arc::new(Mutex::new(RateLimitState { reset_at: None })),
        }
    }

    async fn load_safe_info_from_db(&self, safe_address: &str, network: &str) -> Option<SafeApiResponse> {
        let row: Option<(String, String)> = sqlx::query_as(
            "SELECT safe_info_json, safe_info_cached_at FROM safe_cache
             WHERE safe_address = ? AND network = ? AND safe_info_json IS NOT NULL"
        )
        .bind(safe_address)
        .bind(network)
        .fetch_optional(&self.pool)
        .await
        .ok()
        .flatten();

        let (json, cached_at_str) = row?;
        let cached_at = chrono::DateTime::parse_from_rfc3339(&cached_at_str).ok()?;
        let age = chrono::Utc::now().signed_duration_since(cached_at.with_timezone(&chrono::Utc));
        if age.num_seconds() > SAFE_INFO_DB_TTL_SECS {
            return None;
        }
        serde_json::from_str(&json).ok()
    }

    async fn store_safe_info_in_db(&self, safe_address: &str, network: &str, info: &SafeApiResponse) {
        let json = match serde_json::to_string(info) {
            Ok(j) => j,
            Err(_) => return,
        };
        let now = chrono::Utc::now().to_rfc3339();
        let _ = sqlx::query(
            "INSERT INTO safe_cache (safe_address, network, safe_info_json, safe_info_cached_at, updated_at)
             VALUES (?, ?, ?, ?, ?)
             ON CONFLICT(safe_address, network) DO UPDATE SET
                safe_info_json = excluded.safe_info_json,
                safe_info_cached_at = excluded.safe_info_cached_at,
                updated_at = excluded.updated_at"
        )
        .bind(safe_address)
        .bind(network)
        .bind(&json)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await;
    }

    async fn load_creation_info_from_db(&self, safe_address: &str, network: &str) -> Option<SafeCreationInfo> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT creation_info_json FROM safe_cache
             WHERE safe_address = ? AND network = ? AND creation_info_json IS NOT NULL"
        )
        .bind(safe_address)
        .bind(network)
        .fetch_optional(&self.pool)
        .await
        .ok()
        .flatten();

        row.and_then(|(json,)| serde_json::from_str(&json).ok())
    }

    async fn store_creation_info_in_db(&self, safe_address: &str, network: &str, info: &SafeCreationInfo) {
        let json = match serde_json::to_string(info) {
            Ok(j) => j,
            Err(_) => return,
        };
        let now = chrono::Utc::now().to_rfc3339();
        let _ = sqlx::query(
            "INSERT INTO safe_cache (safe_address, network, creation_info_json, updated_at)
             VALUES (?, ?, ?, ?)
             ON CONFLICT(safe_address, network) DO UPDATE SET
                creation_info_json = excluded.creation_info_json,
                updated_at = excluded.updated_at"
        )
        .bind(safe_address)
        .bind(network)
        .bind(&json)
        .bind(&now)
        .execute(&self.pool)
        .await;
    }

    fn parse_reset_duration(response: &reqwest::Response) -> Duration {
        let raw = response
            .headers()
            .get("x-ratelimit-reset")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(60);

        let duration = if raw > 60_000 {
            Duration::from_millis(raw)
        } else {
            Duration::from_secs(raw)
        };

        duration.min(RATE_LIMIT_RESET_CAP)
    }

    async fn read_db_rate_limit(&self) -> Option<tokio::time::Instant> {
        let row: Option<(String,)> = sqlx::query_as(
            "SELECT reset_at FROM safe_api_rate_limit WHERE id = 1"
        )
        .fetch_optional(&self.pool)
        .await
        .ok()
        .flatten();

        let reset_str = row?.0;
        let reset_dt = chrono::DateTime::parse_from_rfc3339(&reset_str).ok()?;
        let now_utc = chrono::Utc::now();
        if reset_dt > now_utc {
            let secs_remaining = (reset_dt.with_timezone(&chrono::Utc) - now_utc).num_seconds().max(0) as u64;
            Some(tokio::time::Instant::now() + Duration::from_secs(secs_remaining))
        } else {
            None
        }
    }

    async fn write_db_rate_limit(&self, wait: Duration) {
        let reset_at = chrono::Utc::now() + chrono::Duration::from_std(wait).unwrap_or(chrono::Duration::seconds(60));
        let now = chrono::Utc::now().to_rfc3339();
        let _ = sqlx::query(
            "INSERT INTO safe_api_rate_limit (id, reset_at, updated_at) VALUES (1, ?, ?)
             ON CONFLICT(id) DO UPDATE SET
                reset_at = CASE WHEN excluded.reset_at > reset_at THEN excluded.reset_at ELSE reset_at END,
                updated_at = excluded.updated_at"
        )
        .bind(reset_at.to_rfc3339())
        .bind(now)
        .execute(&self.pool)
        .await;
    }

    fn to_fallback_url(url: &str, network: &str) -> Option<String> {
        let primary_base = get_safe_api_url(network)?;
        let fallback_base = get_safe_api_fallback_url(network)?;
        let path = url.strip_prefix(primary_base)?;
        Some(format!("{}{}", fallback_base, path))
    }

    async fn get(&self, url: &str, network: &str) -> Result<reqwest::Response, SafeApiError> {
        {
            let mut state = self.rate_limit.lock().await;
            if let Some(reset_at) = state.reset_at {
                let now = tokio::time::Instant::now();
                if reset_at > now {
                    let wait = reset_at - now;
                    if wait > RATE_LIMIT_MAX_INLINE_WAIT {
                        tracing::warn!("Primary Safe API rate limited, trying fallback");
                        drop(state);
                        return self.get_fallback(url, network).await;
                    }
                    tracing::warn!("Safe API rate limit active, waiting {:?} before request", wait);
                    drop(state);
                    tokio::time::sleep(wait).await;
                } else {
                    state.reset_at = None;
                }
            }
        }

        if let Some(db_deadline) = self.read_db_rate_limit().await {
            {
                let mut state = self.rate_limit.lock().await;
                state.reset_at = Some(db_deadline);
            }
            tracing::warn!("Primary Safe API rate limited (cross-process), trying fallback");
            return self.get_fallback(url, network).await;
        }

        let response = self.client.get(url).send().await
            .map_err(|e| SafeApiError::NetworkError(e.to_string()))?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            let reset_duration = Self::parse_reset_duration(&response);
            let jitter = Duration::from_millis(
                rand::Rng::gen_range(&mut rand::thread_rng(), 0u64..=2_000),
            );
            let wait = reset_duration + jitter;

            {
                let mut state = self.rate_limit.lock().await;
                let new_deadline = tokio::time::Instant::now() + wait;
                state.reset_at = Some(match state.reset_at {
                    Some(existing) if existing > new_deadline => existing,
                    _ => new_deadline,
                });
            }

            self.write_db_rate_limit(wait).await;

            tracing::warn!("Primary Safe API quota exhausted for {}, trying fallback", url);
            return self.get_fallback(url, network).await;
        }

        Ok(response)
    }

    async fn get_fallback(&self, url: &str, network: &str) -> Result<reqwest::Response, SafeApiError> {
        let fallback_url = Self::to_fallback_url(url, network)
            .ok_or_else(|| SafeApiError::RateLimited(format!(
                "Safe API rate limited and no fallback available for network: {}", network
            )))?;

        tracing::info!("Using unauthenticated fallback: {}", fallback_url);

        let response = self.fallback_client.get(&fallback_url).send().await
            .map_err(|e| SafeApiError::NetworkError(format!("Fallback request failed: {}", e)))?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            return Err(SafeApiError::RateLimited(
                "Both authenticated and unauthenticated Safe API endpoints are rate limited".to_string()
            ));
        }

        Ok(response)
    }

    pub async fn fetch_safe_info(&self, safe_address: &str, network: &str) -> Result<SafeApiResponse, SafeApiError> {
        if let Some(cached) = self.load_safe_info_from_db(safe_address, network).await {
            tracing::debug!("Safe info DB cache hit for {}:{}", network, safe_address);
            return Ok(cached);
        }

        let base_url = get_safe_api_url(network)
            .ok_or_else(|| SafeApiError::UnsupportedNetwork(network.to_string()))?;
        let url = format!("{}/api/v1/safes/{}/", base_url, safe_address);

        let response = self.get(&url, network).await?;

        if !response.status().is_success() {
            if response.status() == 404 {
                return Err(SafeApiError::NotFound(format!("Safe {} not found on {}", safe_address, network)));
            }
            return Err(SafeApiError::NetworkError(format!("Safe API returned status: {}", response.status())));
        }

        let info = response.json::<SafeApiResponse>().await
            .map_err(|e| SafeApiError::ParseError(format!("Failed to parse Safe info: {}", e)))?;

        self.store_safe_info_in_db(safe_address, network, &info).await;

        Ok(info)
    }

    pub async fn fetch_safe_creation(&self, safe_address: &str, network: &str) -> Result<SafeCreationInfo, SafeApiError> {
        if let Some(cached) = self.load_creation_info_from_db(safe_address, network).await {
            tracing::debug!("Safe creation DB cache hit for {}:{}", network, safe_address);
            return Ok(cached);
        }

        let base_url = get_safe_api_url(network)
            .ok_or_else(|| SafeApiError::UnsupportedNetwork(network.to_string()))?;
        let url = format!("{}/api/v1/safes/{}/creation/", base_url, safe_address);

        let response = self.get(&url, network).await?;

        if !response.status().is_success() {
            if response.status() == 404 {
                return Err(SafeApiError::NotFound(format!("Creation info for Safe {} not found on {}", safe_address, network)));
            }
            return Err(SafeApiError::NetworkError(format!("Safe API returned status: {}", response.status())));
        }

        let info = response.json::<SafeCreationInfo>().await
            .map_err(|e| SafeApiError::ParseError(format!("Failed to parse Safe creation info: {}", e)))?;

        self.store_creation_info_in_db(safe_address, network, &info).await;

        Ok(info)
    }
}
