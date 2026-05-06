use reqwest::Client;
use serde::{Deserialize, Serialize};
use sqlx::SqlitePool;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::Mutex;
use ethers::utils::to_checksum;

const SAFE_INFO_DB_TTL_SECS: i64 = 86400;
const RATE_LIMIT_WARN_THRESHOLD: u64 = 500;
const RATE_LIMIT_CRITICAL_THRESHOLD: u64 = 50;
const RATE_LIMIT_RESET_CAP: Duration = Duration::from_secs(3600);

#[derive(Debug)]
struct RateLimitState {
    reset_at: Option<tokio::time::Instant>,
}

#[derive(Debug, Clone)]
pub struct SafeApiClient {
    client: Client,
    fallback_client: Client,
    network_configs: HashMap<String, NetworkConfig>,
    pool: SqlitePool,
    rate_limit: Arc<Mutex<RateLimitState>>,
}

#[derive(Debug, Clone)]
struct NetworkConfig {
    tx_service_url: String,
    chain_id: u64,
    #[allow(dead_code)]
    name: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SafeTransaction {
    pub safe_tx_hash: String,
    pub to: String,
    pub value: Option<serde_json::Value>,
    pub data: Option<String>,
    pub operation: Option<u8>,
    pub gas_token: Option<String>,
    pub safe_tx_gas: Option<serde_json::Value>,
    pub base_gas: Option<serde_json::Value>,
    pub gas_price: Option<serde_json::Value>,
    pub refund_receiver: Option<String>,
    pub nonce: u64,
    pub execution_date: Option<String>,
    pub submission_date: Option<String>,
    pub modified: Option<String>,
    pub block_number: Option<u64>,
    pub transaction_hash: Option<String>,
    pub executor: Option<String>,
    pub is_executed: Option<bool>,
    pub is_successful: Option<bool>,
    pub confirmations_required: Option<u32>,
    pub confirmations: Option<Vec<Confirmation>>,
    pub trusted: Option<bool>,
    pub data_decoded: Option<DataDecoded>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Confirmation {
    pub owner: String,
    pub submission_date: String,
    pub signature: String,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DataDecoded {
    pub method: String,
    pub parameters: Option<Vec<Parameter>>,
}

#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct Parameter {
    pub name: String,
    pub r#type: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Deserialize)]
struct SafeTransactionsResponse {
    next: Option<String>,
    results: Vec<SafeTransaction>,
}

impl SafeApiClient {
    pub fn new(api_key: Option<String>, pool: SqlitePool) -> Self {
        let mut network_configs = HashMap::new();

        network_configs.insert("ethereum".to_string(), NetworkConfig {
            tx_service_url: "https://api.safe.global/tx-service/eth".to_string(),
            chain_id: 1,
            name: "Ethereum Mainnet".to_string(),
        });

        network_configs.insert("sepolia".to_string(), NetworkConfig {
            tx_service_url: "https://api.safe.global/tx-service/sep".to_string(),
            chain_id: 11155111,
            name: "Sepolia Testnet".to_string(),
        });

        network_configs.insert("polygon".to_string(), NetworkConfig {
            tx_service_url: "https://api.safe.global/tx-service/pol".to_string(),
            chain_id: 137,
            name: "Polygon".to_string(),
        });

        network_configs.insert("arbitrum".to_string(), NetworkConfig {
            tx_service_url: "https://api.safe.global/tx-service/arb1".to_string(),
            chain_id: 42161,
            name: "Arbitrum".to_string(),
        });

        network_configs.insert("optimism".to_string(), NetworkConfig {
            tx_service_url: "https://api.safe.global/tx-service/oeth".to_string(),
            chain_id: 10,
            name: "Optimism".to_string(),
        });

        network_configs.insert("base".to_string(), NetworkConfig {
            tx_service_url: "https://api.safe.global/tx-service/base".to_string(),
            chain_id: 8453,
            name: "Base".to_string(),
        });

        let client = {
            let mut builder = Client::builder()
                .redirect(reqwest::redirect::Policy::limited(10));
            if let Some(key) = api_key {
                let mut headers = reqwest::header::HeaderMap::new();
                let auth_value = reqwest::header::HeaderValue::from_str(&format!("Bearer {}", key))
                    .expect("Invalid Safe API key format");
                headers.insert(reqwest::header::AUTHORIZATION, auth_value);
                builder = builder.default_headers(headers);
            }
            builder.build().unwrap_or_else(|_| Client::new())
        };

        let fallback_client = Client::builder()
            .redirect(reqwest::redirect::Policy::limited(5))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            client,
            fallback_client,
            network_configs,
            pool,
            rate_limit: Arc::new(Mutex::new(RateLimitState { reset_at: None })),
        }
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

    fn parse_remaining(response: &reqwest::Response) -> Option<u64> {
        response
            .headers()
            .get("x-ratelimit-remaining")
            .and_then(|v| v.to_str().ok())
            .and_then(|s| s.parse::<u64>().ok())
    }

    fn fallback_url_for(&self, url: &str, network: &str) -> Option<String> {
        let config = self.network_configs.get(network)?;
        let path = url.strip_prefix(&config.tx_service_url)?;
        let fallback_base = match network {
            "ethereum" => "https://safe-transaction-mainnet.safe.global",
            "sepolia" => "https://safe-transaction-sepolia.safe.global",
            "polygon" => "https://safe-transaction-polygon.safe.global",
            "arbitrum" => "https://safe-transaction-arbitrum.safe.global",
            "optimism" => "https://safe-transaction-optimism.safe.global",
            "base" => "https://safe-transaction-base.safe.global",
            _ => return None,
        };
        Some(format!("{}{}", fallback_base, path))
    }

    async fn get(&self, url: &str) -> Result<reqwest::Response, Box<dyn std::error::Error>> {
        {
            let state = self.rate_limit.lock().await;
            if let Some(reset_at) = state.reset_at {
                let now = tokio::time::Instant::now();
                if reset_at > now {
                    let wait = reset_at - now;
                    tracing::warn!("Safe API rate limit active, waiting {:?} before request", wait);
                    drop(state);
                    tokio::time::sleep(wait).await;
                }
            }
        }

        let response = self.client.get(url).send().await?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            let reset_duration = Self::parse_reset_duration(&response);
            let jitter = Duration::from_millis(
                rand::Rng::gen_range(&mut rand::thread_rng(), 0u64..=5_000),
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

            tokio::time::sleep(wait).await;

            let retry = self.client.get(url).send().await?;
            if retry.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                return Err(format!(
                    "Safe API rate limit persists after retry (url: {})",
                    url
                )
                .into());
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

        if let Some(remaining) = Self::parse_remaining(&response) {
            if remaining < RATE_LIMIT_CRITICAL_THRESHOLD {
                return Err(format!(
                    "Safe API quota critically low ({} remaining), skipping remaining addresses",
                    remaining
                ).into());
            } else if remaining < RATE_LIMIT_WARN_THRESHOLD {
                tracing::warn!("Safe API quota low: {} requests remaining", remaining);
            }
        }

        Ok(response)
    }

    async fn get_safe_info_url(&self, url: &str, network: &str) -> Result<reqwest::Response, Box<dyn std::error::Error>> {
        {
            let state = self.rate_limit.lock().await;
            if let Some(reset_at) = state.reset_at {
                let now = tokio::time::Instant::now();
                if reset_at > now {
                    tracing::warn!("Primary Safe API rate limited, trying fallback for safe info");
                    drop(state);
                    if let Some(fallback_url) = self.fallback_url_for(url, network) {
                        tracing::info!("Using unauthenticated fallback: {}", fallback_url);
                        return Ok(self.fallback_client.get(&fallback_url).send().await?);
                    }
                    return Err("Safe API rate limited and no fallback available".into());
                }
            }
        }

        let response = self.client.get(url).send().await?;

        if response.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
            let reset_duration = Self::parse_reset_duration(&response);
            {
                let mut state = self.rate_limit.lock().await;
                let new_deadline = tokio::time::Instant::now() + reset_duration;
                state.reset_at = Some(match state.reset_at {
                    Some(existing) if existing > new_deadline => existing,
                    _ => new_deadline,
                });
            }

            tracing::warn!("Primary Safe API quota exhausted, trying fallback for safe info");
            if let Some(fallback_url) = self.fallback_url_for(url, network) {
                tracing::info!("Using unauthenticated fallback: {}", fallback_url);
                let fallback = self.fallback_client.get(&fallback_url).send().await?;
                if fallback.status() == reqwest::StatusCode::TOO_MANY_REQUESTS {
                    return Err("Both authenticated and unauthenticated Safe API endpoints are rate limited".into());
                }
                return Ok(fallback);
            }
            return Err("Safe API rate limited and no fallback available".into());
        }

        if let Some(remaining) = Self::parse_remaining(&response) {
            if remaining < RATE_LIMIT_CRITICAL_THRESHOLD {
                return Err(format!(
                    "Safe API quota critically low ({} remaining), skipping remaining addresses",
                    remaining
                ).into());
            } else if remaining < RATE_LIMIT_WARN_THRESHOLD {
                tracing::warn!("Safe API quota low: {} requests remaining", remaining);
            }
        }

        Ok(response)
    }

    async fn fetch_all_pages(&self, initial_url: String) -> Result<Vec<SafeTransaction>, Box<dyn std::error::Error>> {
        let mut results = Vec::new();
        let mut next_url: Option<String> = Some(initial_url);

        while let Some(url) = next_url {
            let response = self.get(&url).await?;
            let status = response.status();

            if !status.is_success() {
                let body = response.text().await.unwrap_or_else(|_| "Unable to read response body".to_string());
                return Err(format!("Safe API returned status: {} - {}", status, body).into());
            }

            let page: SafeTransactionsResponse = response.json().await?;
            next_url = page.next;
            results.extend(page.results);
        }

        Ok(results)
    }

    pub async fn fetch_pending_transactions(
        &self,
        safe_address: &str,
        network: &str,
    ) -> Result<Vec<SafeTransaction>, Box<dyn std::error::Error>> {
        let config = self.network_configs.get(network)
            .ok_or(format!("Unsupported network: {}", network))?;

        let checksum_address = to_checksum(&safe_address.parse()?, None);

        let url = format!(
            "{}/api/v1/safes/{}/multisig-transactions/?executed=false&ordering=-nonce",
            config.tx_service_url,
            checksum_address
        );

        tracing::debug!("Fetching pending transactions from: {}", url);

        self.fetch_all_pages(url).await
    }

    pub async fn fetch_executed_since(
        &self,
        safe_address: &str,
        network: &str,
        last_max_nonce: Option<i64>,
    ) -> Result<Vec<SafeTransaction>, Box<dyn std::error::Error>> {
        let config = self.network_configs.get(network)
            .ok_or(format!("Unsupported network: {}", network))?;

        let checksum_address = to_checksum(&safe_address.parse()?, None);

        let url = match last_max_nonce {
            Some(n) => format!(
                "{}/api/v1/safes/{}/multisig-transactions/?executed=true&nonce__gt={}&ordering=nonce",
                config.tx_service_url, checksum_address, n
            ),
            None => format!(
                "{}/api/v1/safes/{}/multisig-transactions/?executed=true&ordering=nonce",
                config.tx_service_url, checksum_address
            ),
        };

        tracing::debug!("Fetching executed transactions since nonce {:?} from: {}", last_max_nonce, url);

        self.fetch_all_pages(url).await
    }

    pub async fn fetch_recent_transactions(
        &self,
        safe_address: &str,
        network: &str,
        limit: usize,
    ) -> Result<Vec<SafeTransaction>, Box<dyn std::error::Error>> {
        let config = self.network_configs.get(network)
            .ok_or(format!("Unsupported network: {}", network))?;

        let checksum_address = to_checksum(&safe_address.parse()?, None);

        let url = format!(
            "{}/api/v1/safes/{}/multisig-transactions/?limit={}&ordering=-nonce",
            config.tx_service_url,
            checksum_address,
            limit
        );

        tracing::debug!("Fetching recent {} transactions from: {}", limit, url);

        let response = self.get(&url).await?;
        let status = response.status();

        if !status.is_success() {
            let body = response.text().await.unwrap_or_else(|_| "Unable to read response body".to_string());
            tracing::error!("Safe API error response body: {}", body);
            return Err(format!("Safe API returned status: {} - {}", status, body).into());
        }

        let response_text = response.text().await?;
        tracing::debug!("Response body length: {} bytes", response_text.len());

        let tx_response: SafeTransactionsResponse = serde_json::from_str(&response_text)
            .map_err(|e| {
                tracing::error!("Failed to parse response: {}", e);
                tracing::error!("Response body (first 500 chars): {}", &response_text.chars().take(500).collect::<String>());
                e
            })?;

        tracing::debug!("Found {} total transactions", tx_response.results.len());
        Ok(tx_response.results)
    }

    pub async fn fetch_safe_info(
        &self,
        safe_address: &str,
        network: &str,
    ) -> Result<SafeInfo, Box<dyn std::error::Error>> {
        let row: Option<(String, String)> = sqlx::query_as(
            "SELECT safe_info_json, safe_info_cached_at FROM safe_cache
             WHERE safe_address = ? AND network = ? AND safe_info_json IS NOT NULL"
        )
        .bind(safe_address)
        .bind(network)
        .fetch_optional(&self.pool)
        .await
        .unwrap_or(None);

        if let Some((json, cached_at_str)) = row {
            if let Ok(cached_at) = chrono::DateTime::parse_from_rfc3339(&cached_at_str) {
                let age = chrono::Utc::now().signed_duration_since(cached_at.with_timezone(&chrono::Utc));
                if age.num_seconds() < SAFE_INFO_DB_TTL_SECS {
                    if let Ok(info) = serde_json::from_str::<SafeInfo>(&json) {
                        tracing::debug!("Worker safe info DB cache hit for {}:{}", network, safe_address);
                        return Ok(info);
                    }
                }
            }
        }

        let config = self.network_configs.get(network)
            .ok_or(format!("Unsupported network: {}", network))?;

        let checksum_address = to_checksum(&safe_address.parse()?, None);

        let url = format!(
            "{}/api/v1/safes/{}/",
            config.tx_service_url,
            checksum_address
        );

        tracing::debug!("Fetching Safe info from: {}", url);

        let response = self.get_safe_info_url(&url, network).await?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_else(|_| "Unable to read response body".to_string());
            return Err(format!("Safe API returned status: {} - {}", status, body).into());
        }

        let safe_info: SafeInfo = response.json().await?;

        if let Ok(json) = serde_json::to_string(&safe_info) {
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

        Ok(safe_info)
    }

    pub fn get_chain_id(&self, network: &str) -> Option<u64> {
        self.network_configs.get(network).map(|config| config.chain_id)
    }
}

#[derive(Debug, Deserialize, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SafeInfo {
    pub address: String,
    pub nonce: u64,
    pub threshold: u32,
    pub owners: Vec<String>,
    pub master_copy: Option<String>,
    pub version: Option<String>,
    pub guard: Option<String>,
}