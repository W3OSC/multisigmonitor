use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use ethers::{
    abi::Abi,
    contract::Contract,
    providers::{Http, Middleware, Provider},
    types::{Address, H256, U256},
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use reqwest::Url;

use super::AppState;

#[derive(Debug, Deserialize)]
pub struct MultisigInfoRequest {
    pub txhash: String,
    pub network: String,
    #[serde(rename = "safeAddress")]
    pub safe_address: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MultisigInfoResponse {
    pub creator: Option<String>,
    pub proxy: Option<String>,
    #[serde(rename = "proxyFactory")]
    pub proxy_factory: Option<String>,
    #[serde(rename = "masterCopy")]
    pub master_copy: Option<String>,
    pub initializer: Option<String>,
    #[serde(rename = "fallbackHandler")]
    pub fallback_handler: Option<String>,
    #[serde(rename = "fallbackHandlerRuntime")]
    pub fallback_handler_runtime: Option<String>,
    pub initiator: Option<String>,
    pub owners: Vec<String>,
    pub threshold: Option<String>,
    pub guard: Option<String>,
    pub modules: Vec<String>,
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub errors: Vec<String>,
}

pub async fn get_multisig_info(
    State(state): State<AppState>,
    Json(payload): Json<MultisigInfoRequest>,
) -> Result<Json<MultisigInfoResponse>, StatusCode> {
    let response = get_multisig_info_internal(
        &state,
        &payload.txhash,
        &payload.network,
        payload.safe_address.as_deref(),
    )
    .await?;
    
    Ok(Json(response))
}

pub async fn get_multisig_info_internal(
    state: &AppState,
    txhash: &str,
    network: &str,
    safe_address: Option<&str>,
) -> Result<MultisigInfoResponse, StatusCode> {
    let infura_api_key = &state.config.infura_api_key;

    let infura_network = match network {
        "ethereum" => "mainnet",
        "goerli" => "goerli",
        "sepolia" => "sepolia",
        other => other,
    };

    let infura_url = format!("https://{}.infura.io/v3/{}", infura_network, infura_api_key);
    
    tracing::debug!("Creating provider with URL: {}", infura_url);
    
    let url = Url::parse(&infura_url).map_err(|e| {
        tracing::error!("Failed to parse URL '{}': {:?}", infura_url, e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;
    
    let http_provider = Http::new(url);
    let provider = Provider::new(http_provider);

    let tx_hash: H256 = txhash.parse()
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let receipt = provider.get_transaction_receipt(tx_hash)
        .await
        .map_err(|e| {
            tracing::error!("Failed to get transaction receipt: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?
        .ok_or(StatusCode::NOT_FOUND)?;

    let mut response = MultisigInfoResponse {
        creator: Some(format!("{:?}", receipt.from)),
        proxy: None,
        proxy_factory: None,
        master_copy: None,
        initializer: None,
        fallback_handler: None,
        fallback_handler_runtime: None,
        initiator: None,
        owners: Vec::new(),
        threshold: None,
        guard: None,
        modules: Vec::new(),
        version: None,
        errors: Vec::new(),
    };

    // Parse event logs for SafeSetup and ProxyCreation events
    let mut proxy_address: Option<Address> = None;

    // SafeSetup event signature: SafeSetup(address indexed initiator, address[] owners, uint256 threshold, address initializer, address fallbackHandler)
    let safe_setup_topic = "0x141df868a6331af528e38c83b7aa03edc19be66e37ae67f9285bf4f8e3c6a1a8";
    
    // ProxyCreation event signature: ProxyCreation(address indexed proxy, address singleton)
    let proxy_creation_topic = "0x4f51faf6c4561ff95f067657e43439f0f856d97c04d9ec9070a6199ad418e235";

    tracing::debug!("Transaction receipt has {} logs", receipt.logs.len());
    
    for log in &receipt.logs {
        if log.topics.is_empty() {
            continue;
        }

        let topic = format!("{:?}", log.topics[0]);
        tracing::debug!("Log topic: {}, from address: {:?}", topic, log.address);
        
        if topic == safe_setup_topic {
            // Parse SafeSetup event
            if log.topics.len() >= 2 {
                response.initiator = Some(format!("{:?}", log.topics[1]));
            }
            
            // Parse data field for owners, threshold, initializer, fallbackHandler
            // Data contains: owners[], threshold, initializer, fallbackHandler
            if log.data.len() >= 160 {
                // Skip first 32 bytes (offset to owners array)
                // Bytes 32-64: threshold
                let threshold_bytes = &log.data[32..64];
                let threshold = U256::from_big_endian(threshold_bytes);
                response.threshold = Some(threshold.to_string());
                
                // Bytes 64-96: initializer (32 bytes, last 20 bytes are address)
                if log.data.len() >= 96 {
                    let initializer_bytes = &log.data[76..96];
                    let initializer = Address::from_slice(initializer_bytes);
                    response.initializer = Some(format!("{:?}", initializer));
                }
                
                // Bytes 96-128: fallbackHandler
                if log.data.len() >= 128 {
                    let fallback_bytes = &log.data[108..128];
                    let fallback = Address::from_slice(fallback_bytes);
                    response.fallback_handler = Some(format!("{:?}", fallback));
                }
            }
        } else if topic == proxy_creation_topic {
            // Parse ProxyCreation event
            if log.topics.len() >= 2 {
                // proxy address is in topics[1]
                let proxy_bytes = &log.topics[1].as_bytes()[12..]; // Last 20 bytes
                let proxy = Address::from_slice(proxy_bytes);
                response.proxy = Some(format!("{:?}", proxy));
                proxy_address = Some(proxy);
                response.proxy_factory = Some(format!("{:?}", log.address));
            }
            
            // singleton/masterCopy is in data
            if log.data.len() >= 32 {
                let master_bytes = &log.data[12..32]; // Last 20 bytes of first 32 bytes
                let master = Address::from_slice(master_bytes);
                response.master_copy = Some(format!("{:?}", master));
            }
        }
    }

    // If no proxy address found in events and safeAddress provided, use it
    if proxy_address.is_none() {
        if let Some(addr_str) = safe_address {
            if let Ok(addr) = addr_str.parse::<Address>() {
                proxy_address = Some(addr);
                response.proxy = Some(format!("{:?}", addr));
                tracing::debug!("Using provided Safe address: {:?}", addr);
            }
        } else if let Some(contract_addr) = receipt.contract_address {
            proxy_address = Some(contract_addr);
            response.proxy = Some(format!("{:?}", contract_addr));
        } else if let Some(to_addr) = receipt.to {
            proxy_address = Some(to_addr);
            response.proxy = Some(format!("{:?}", to_addr));
        }
    }

    // Call Safe contract methods to get runtime configuration
    if let Some(safe_addr) = proxy_address {
        let safe_abi: Abi = serde_json::from_str(r#"[
            {"inputs":[],"name":"getOwners","outputs":[{"internalType":"address[]","name":"","type":"address[]"}],"stateMutability":"view","type":"function"},
            {"inputs":[],"name":"getThreshold","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
            {"inputs":[],"name":"getGuard","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
            {"inputs":[],"name":"getFallbackHandler","outputs":[{"internalType":"address","name":"","type":"address"}],"stateMutability":"view","type":"function"},
            {"inputs":[{"internalType":"address","name":"start","type":"address"},{"internalType":"uint256","name":"pageSize","type":"uint256"}],"name":"getModulesPaginated","outputs":[{"internalType":"address[]","name":"array","type":"address[]"},{"internalType":"address","name":"next","type":"address"}],"stateMutability":"view","type":"function"},
            {"inputs":[],"name":"VERSION","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"}
        ]"#).unwrap_or_else(|_| Abi { constructor: None, functions: Default::default(), events: Default::default(), errors: Default::default(), receive: false, fallback: false });

        let contract = Contract::new(safe_addr, safe_abi, Arc::new(provider.clone()));

        match contract.method::<_, Vec<Address>>("getOwners", ()) {
            Ok(call) => match call.call().await {
                Ok(result) => {
                    response.owners = result.iter().map(|a| format!("{:?}", a)).collect();
                }
                Err(e) => {
                    let err_msg = format!("Failed to call getOwners: {}", e);
                    tracing::error!("{}", err_msg);
                    response.errors.push(err_msg);
                }
            },
            Err(e) => {
                let err_msg = format!("Failed to encode getOwners call: {}", e);
                tracing::error!("{}", err_msg);
                response.errors.push(err_msg);
            }
        }

        if response.threshold.is_none() {
            match contract.method::<_, U256>("getThreshold", ()) {
                Ok(call) => match call.call().await {
                    Ok(threshold) => {
                        response.threshold = Some(threshold.to_string());
                    }
                    Err(e) => {
                        let err_msg = format!("Failed to call getThreshold: {}", e);
                        tracing::error!("{}", err_msg);
                        response.errors.push(err_msg);
                    }
                },
                Err(e) => {
                    let err_msg = format!("Failed to encode getThreshold call: {}", e);
                    tracing::error!("{}", err_msg);
                    response.errors.push(err_msg);
                }
            }
        }

        match contract.method::<_, Address>("getGuard", ()) {
            Ok(call) => match call.call().await {
                Ok(guard) => {
                    let guard_str = format!("{:?}", guard);
                    if guard_str != "0x0000000000000000000000000000000000000000" {
                        response.guard = Some(guard_str);
                    }
                }
                Err(e) => {
                    let err_msg = format!("Failed to call getGuard: {}", e);
                    tracing::error!("{}", err_msg);
                    response.errors.push(err_msg);
                }
            },
            Err(e) => {
                let err_msg = format!("Failed to encode getGuard call: {}", e);
                tracing::error!("{}", err_msg);
                response.errors.push(err_msg);
            }
        }

        match contract.method::<_, Address>("getFallbackHandler", ()) {
            Ok(call) => match call.call().await {
                Ok(fallback) => {
                    response.fallback_handler_runtime = Some(format!("{:?}", fallback));
                }
                Err(e) => {
                    let err_msg = format!("Failed to call getFallbackHandler: {}", e);
                    tracing::error!("{}", err_msg);
                    response.errors.push(err_msg);
                }
            },
            Err(e) => {
                let err_msg = format!("Failed to encode getFallbackHandler call: {}", e);
                tracing::error!("{}", err_msg);
                response.errors.push(err_msg);
            }
        }

        match contract.method::<_, (Vec<Address>, Address)>("getModulesPaginated", (Address::zero(), U256::from(100))) {
            Ok(call) => match call.call().await {
                Ok((modules, _next)) => {
                    response.modules = modules.iter().map(|a| format!("{:?}", a)).collect();
                }
                Err(e) => {
                    let err_msg = format!("Failed to call getModulesPaginated: {}", e);
                    tracing::error!("{}", err_msg);
                    response.errors.push(err_msg);
                }
            },
            Err(e) => {
                let err_msg = format!("Failed to encode getModulesPaginated call: {}", e);
                tracing::error!("{}", err_msg);
                response.errors.push(err_msg);
            }
        }

        match contract.method::<_, String>("VERSION", ()) {
            Ok(call) => match call.call().await {
                Ok(version) => {
                    response.version = Some(version);
                }
                Err(e) => {
                    let err_msg = format!("Failed to call VERSION: {}", e);
                    tracing::error!("{}", err_msg);
                    response.errors.push(err_msg);
                }
            },
            Err(e) => {
                let err_msg = format!("Failed to encode VERSION call: {}", e);
                tracing::error!("{}", err_msg);
                response.errors.push(err_msg);
            }
        }
    }

    Ok(response)
}
