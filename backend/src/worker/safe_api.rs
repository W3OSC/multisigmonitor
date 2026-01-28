use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use ethers::utils::to_checksum;

#[derive(Debug, Clone)]
pub struct SafeApiClient {
    client: Client,
    network_configs: HashMap<String, NetworkConfig>,
}

#[derive(Debug, Clone)]
struct NetworkConfig {
    tx_service_url: String,
    chain_id: u64,
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
    results: Vec<SafeTransaction>,
}

impl SafeApiClient {
    pub fn new() -> Self {
        let mut network_configs = HashMap::new();

        network_configs.insert("ethereum".to_string(), NetworkConfig {
            tx_service_url: "https://safe-transaction-mainnet.safe.global".to_string(),
            chain_id: 1,
            name: "Ethereum Mainnet".to_string(),
        });

        network_configs.insert("sepolia".to_string(), NetworkConfig {
            tx_service_url: "https://safe-transaction-sepolia.safe.global".to_string(),
            chain_id: 11155111,
            name: "Sepolia Testnet".to_string(),
        });

        network_configs.insert("polygon".to_string(), NetworkConfig {
            tx_service_url: "https://safe-transaction-polygon.safe.global".to_string(),
            chain_id: 137,
            name: "Polygon".to_string(),
        });

        network_configs.insert("arbitrum".to_string(), NetworkConfig {
            tx_service_url: "https://safe-transaction-arbitrum.safe.global".to_string(),
            chain_id: 42161,
            name: "Arbitrum".to_string(),
        });

        network_configs.insert("optimism".to_string(), NetworkConfig {
            tx_service_url: "https://safe-transaction-optimism.safe.global".to_string(),
            chain_id: 10,
            name: "Optimism".to_string(),
        });

        network_configs.insert("base".to_string(), NetworkConfig {
            tx_service_url: "https://safe-transaction-base.safe.global".to_string(),
            chain_id: 8453,
            name: "Base".to_string(),
        });

        // Build HTTP client with redirect policy
        let client = Client::builder()
            .redirect(reqwest::redirect::Policy::limited(10))
            .build()
            .unwrap_or_else(|_| Client::new());

        Self {
            client,
            network_configs,
        }
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

        tracing::debug!("Fetching transactions from: {}", url);

        let response = self.client
            .get(&url)
            .send()
            .await?;

        let status = response.status();
        tracing::debug!("Safe API response status: {}", status);

        if !status.is_success() {
            let body = response.text().await.unwrap_or_else(|_| "Unable to read response body".to_string());
            tracing::error!("Safe API error response body: {}", body);
            return Err(format!("Safe API returned status: {} - {}", status, body).into());
        }

        let tx_response: SafeTransactionsResponse = response.json().await?;
        
        tracing::debug!("Found {} pending transactions", tx_response.results.len());

        Ok(tx_response.results)
    }

    pub async fn fetch_all_transactions(
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

        tracing::debug!("Fetching all transactions from: {}", url);

        let response = self.client
            .get(&url)
            .send()
            .await?;

        let status = response.status();
        tracing::debug!("Safe API response status: {}", status);

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
        let config = self.network_configs.get(network)
            .ok_or(format!("Unsupported network: {}", network))?;

        let checksum_address = to_checksum(&safe_address.parse()?, None);

        let url = format!(
            "{}/api/v1/safes/{}/",
            config.tx_service_url,
            checksum_address
        );

        tracing::debug!("Fetching Safe info from: {}", url);

        let response = self.client
            .get(&url)
            .send()
            .await?;

        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_else(|_| "Unable to read response body".to_string());
            return Err(format!("Safe API returned status: {} - {}", status, body).into());
        }

        let safe_info: SafeInfo = response.json().await?;
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