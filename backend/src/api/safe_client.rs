use serde::Deserialize;
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::{Mutex, RwLock};

const SAFE_INFO_TTL: Duration = Duration::from_secs(300);
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

#[derive(Debug, Deserialize, Clone)]
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

#[derive(Debug, Deserialize, Clone)]
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


#[derive(Debug)]
struct RateLimitState {
    reset_at: Option<tokio::time::Instant>,
}

#[derive(Clone)]
pub struct CachedSafeClient {
    client: Client,
    safe_info_cache: Arc<RwLock<HashMap<String, (SafeApiResponse, Instant)>>>,
    safe_creation_cache: Arc<RwLock<HashMap<String, SafeCreationInfo>>>,
    rate_limit: Arc<Mutex<RateLimitState>>,
}

impl CachedSafeClient {
    pub fn new(api_key: Option<String>) -> Self {
        let mut client_builder = Client::builder();
        if let Some(key) = api_key {
            let mut headers = reqwest::header::HeaderMap::new();
            let auth_value = reqwest::header::HeaderValue::from_str(&format!("Bearer {}", key))
                .expect("Invalid Safe API key format");
            headers.insert(reqwest::header::AUTHORIZATION, auth_value);
            client_builder = client_builder.default_headers(headers);
        }
        let client = client_builder.build().unwrap_or_else(|_| Client::new());
        Self {
            client,
            safe_info_cache: Arc::new(RwLock::new(HashMap::new())),
            safe_creation_cache: Arc::new(RwLock::new(HashMap::new())),
            rate_limit: Arc::new(Mutex::new(RateLimitState { reset_at: None })),
        }
    }

    fn cache_key(safe_address: &str, network: &str) -> String {
        format!("{}:{}", network.to_lowercase(), safe_address.to_lowercase())
    }

    fn parse_reset_duration(response: &reqwest::Response) -> Duration {
        let raw = response
            .headers()
            .get("x-ratelimit-reset")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(60_000);

        let duration = if raw > 60_000 {
            Duration::from_millis(raw)
        } else {
            Duration::from_secs(raw)
        };

        duration.min(RATE_LIMIT_RESET_CAP)
    }

    async fn get(&self, url: &str) -> Result<reqwest::Response, SafeApiError> {
        {
            let state = self.rate_limit.lock().await;
            if let Some(reset_at) = state.reset_at {
                let now = tokio::time::Instant::now();
                if reset_at > now {
                    let wait = reset_at - now;
                    if wait > RATE_LIMIT_MAX_INLINE_WAIT {
                        return Err(SafeApiError::RateLimited(format!(
                            "Safe API rate limited, retry after {:.0}s",
                            wait.as_secs_f64()
                        )));
                    }
                    tracing::warn!("Safe API rate limit active, waiting {:?} before request", wait);
                    drop(state);
                    tokio::time::sleep(wait).await;
                }
            }
        }

        let response = self.client.get(url).send().await
            .map_err(|e| SafeApiError::NetworkError(e.to_string()))?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            let reset_duration = Self::parse_reset_duration(&response);
            let jitter = Duration::from_millis(
                rand::Rng::gen_range(&mut rand::thread_rng(), 0u64..=2_000),
            );
            let wait = reset_duration + jitter;

            tracing::warn!("Safe API 429 for {}, waiting {:?} before retry", url, wait);

            {
                let mut state = self.rate_limit.lock().await;
                let new_deadline = tokio::time::Instant::now() + wait;
                state.reset_at = Some(match state.reset_at {
                    Some(existing) if existing > new_deadline => existing,
                    _ => new_deadline,
                });
            }

            tokio::time::sleep(wait).await;

            let retry = self.client.get(url).send().await
                .map_err(|e| SafeApiError::NetworkError(e.to_string()))?;

            if retry.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                return Err(SafeApiError::RateLimited(format!("Safe API rate limit persists after retry (url: {})", url)));
            }

            return Ok(retry);
        }

        {
            let mut state = self.rate_limit.lock().await;
            if let Some(reset_at) = state.reset_at {
                if tokio::time::Instant::now() >= reset_at {
                    state.reset_at = None;
                }
            }
        }

        Ok(response)
    }

    pub async fn fetch_safe_info(&self, safe_address: &str, network: &str) -> Result<SafeApiResponse, SafeApiError> {
        let key = Self::cache_key(safe_address, network);

        {
            let cache = self.safe_info_cache.read().await;
            if let Some((info, cached_at)) = cache.get(&key) {
                if cached_at.elapsed() < SAFE_INFO_TTL {
                    return Ok(info.clone());
                }
            }
        }

        let base_url = get_safe_api_url(network)
            .ok_or_else(|| SafeApiError::UnsupportedNetwork(network.to_string()))?;
        let url = format!("{}/api/v1/safes/{}/", base_url, safe_address);

        let response = self.get(&url).await?;

        if !response.status().is_success() {
            if response.status() == 404 {
                return Err(SafeApiError::NotFound(format!("Safe {} not found on {}", safe_address, network)));
            }
            return Err(SafeApiError::NetworkError(format!("Safe API returned status: {}", response.status())));
        }

        let info = response.json::<SafeApiResponse>().await
            .map_err(|e| SafeApiError::ParseError(format!("Failed to parse Safe info: {}", e)))?;

        {
            let mut cache = self.safe_info_cache.write().await;
            cache.insert(key, (info.clone(), Instant::now()));
        }

        Ok(info)
    }

    pub async fn fetch_safe_creation(&self, safe_address: &str, network: &str) -> Result<SafeCreationInfo, SafeApiError> {
        let key = Self::cache_key(safe_address, network);

        {
            let cache = self.safe_creation_cache.read().await;
            if let Some(info) = cache.get(&key) {
                return Ok(info.clone());
            }
        }

        let base_url = get_safe_api_url(network)
            .ok_or_else(|| SafeApiError::UnsupportedNetwork(network.to_string()))?;
        let url = format!("{}/api/v1/safes/{}/creation/", base_url, safe_address);

        let response = self.get(&url).await?;

        if !response.status().is_success() {
            if response.status() == 404 {
                return Err(SafeApiError::NotFound(format!("Creation info for Safe {} not found on {}", safe_address, network)));
            }
            return Err(SafeApiError::NetworkError(format!("Safe API returned status: {}", response.status())));
        }

        let info = response.json::<SafeCreationInfo>().await
            .map_err(|e| SafeApiError::ParseError(format!("Failed to parse Safe creation info: {}", e)))?;

        {
            let mut cache = self.safe_creation_cache.write().await;
            cache.insert(key, info.clone());
        }

        Ok(info)
    }
}
