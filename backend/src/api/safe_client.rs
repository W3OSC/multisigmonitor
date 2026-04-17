use serde::Deserialize;
use reqwest::Client;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;

const SAFE_INFO_TTL: Duration = Duration::from_secs(300);

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
        "ethereum" => Some("https://safe-transaction-mainnet.safe.global"),
        "sepolia" => Some("https://safe-transaction-sepolia.safe.global"),
        "polygon" => Some("https://safe-transaction-polygon.safe.global"),
        "arbitrum" => Some("https://safe-transaction-arbitrum.safe.global"),
        "optimism" => Some("https://safe-transaction-optimism.safe.global"),
        "base" => Some("https://safe-transaction-base.safe.global"),
        _ => None,
    }
}

pub async fn fetch_safe_info(
    client: &Client,
    safe_address: &str,
    network: &str,
) -> Result<SafeApiResponse, SafeApiError> {
    let base_url = get_safe_api_url(network)
        .ok_or_else(|| SafeApiError::UnsupportedNetwork(network.to_string()))?;
    
    let url = format!("{}/api/v1/safes/{}/", base_url, safe_address);
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| SafeApiError::NetworkError(format!("Failed to fetch Safe info: {}", e)))?;
    
    if !response.status().is_success() {
        if response.status() == 404 {
            return Err(SafeApiError::NotFound(format!("Safe {} not found on {}", safe_address, network)));
        }
        if response.status() == 429 {
            return Err(SafeApiError::RateLimited(format!("Safe API rate limit reached for {} on {}", safe_address, network)));
        }
        return Err(SafeApiError::NetworkError(format!("Safe API returned status: {}", response.status())));
    }
    
    response
        .json::<SafeApiResponse>()
        .await
        .map_err(|e| SafeApiError::ParseError(format!("Failed to parse Safe info: {}", e)))
}

pub async fn fetch_safe_creation(
    client: &Client,
    safe_address: &str,
    network: &str,
) -> Result<SafeCreationInfo, SafeApiError> {
    let base_url = get_safe_api_url(network)
        .ok_or_else(|| SafeApiError::UnsupportedNetwork(network.to_string()))?;
    
    let url = format!("{}/api/v1/safes/{}/creation/", base_url, safe_address);
    
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| SafeApiError::NetworkError(format!("Failed to fetch Safe creation info: {}", e)))?;
    
    if !response.status().is_success() {
        if response.status() == 404 {
            return Err(SafeApiError::NotFound(format!("Creation info for Safe {} not found on {}", safe_address, network)));
        }
        if response.status() == 429 {
            return Err(SafeApiError::RateLimited(format!("Safe API rate limit reached for {} on {}", safe_address, network)));
        }
        return Err(SafeApiError::NetworkError(format!("Safe API returned status: {}", response.status())));
    }
    
    response
        .json::<SafeCreationInfo>()
        .await
        .map_err(|e| SafeApiError::ParseError(format!("Failed to parse Safe creation info: {}", e)))
}

#[derive(Clone)]
pub struct CachedSafeClient {
    client: Client,
    safe_info_cache: Arc<RwLock<HashMap<String, (SafeApiResponse, Instant)>>>,
    safe_creation_cache: Arc<RwLock<HashMap<String, SafeCreationInfo>>>,
}

impl CachedSafeClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
            safe_info_cache: Arc::new(RwLock::new(HashMap::new())),
            safe_creation_cache: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    fn cache_key(safe_address: &str, network: &str) -> String {
        format!("{}:{}", network.to_lowercase(), safe_address.to_lowercase())
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

        let info = fetch_safe_info(&self.client, safe_address, network).await?;

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

        let info = fetch_safe_creation(&self.client, safe_address, network).await?;

        {
            let mut cache = self.safe_creation_cache.write().await;
            cache.insert(key, info.clone());
        }

        Ok(info)
    }
}
