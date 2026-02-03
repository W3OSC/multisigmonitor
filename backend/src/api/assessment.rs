use axum::{
    extract::State,
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::collections::HashMap;

use crate::api::safe_client::{fetch_safe_info, fetch_safe_creation, SafeApiError};
use crate::api::multisig_info::get_multisig_info_internal;
use crate::services::safe_assessment::{
    SafeAssessmentService, SafeAssessmentRequest, SafeAssessmentResponse,
    SafeInfo, CreationInfo, MultisigInfo, SanctionsResults, SanctionResult,
};
use super::AppState;

#[derive(Debug, Deserialize)]
pub struct AssessmentRequest {
    pub safe_address: String,
    pub network: String,
}

pub async fn assess_safe(
    State(state): State<AppState>,
    Json(payload): Json<AssessmentRequest>,
) -> Response {
    tracing::info!("Starting comprehensive Safe assessment for {} on {}", payload.safe_address, payload.network);
    
    let client = reqwest::Client::new();
    
    let safe_api_info = match fetch_safe_info(&client, &payload.safe_address, &payload.network).await {
        Ok(info) => info,
        Err(e) => {
            tracing::error!("Failed to fetch Safe API info: {}", e);
            let (status, message) = match e {
                SafeApiError::UnsupportedNetwork(msg) => (StatusCode::BAD_REQUEST, msg),
                SafeApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
                SafeApiError::NetworkError(msg) => (StatusCode::BAD_GATEWAY, msg),
                SafeApiError::ParseError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            };
            return (status, Json(json!({"message": message}))).into_response();
        }
    };
    
    let creation_api_info = match fetch_safe_creation(&client, &payload.safe_address, &payload.network).await {
        Ok(info) => info,
        Err(e) => {
            tracing::error!("Failed to fetch Safe creation info: {}", e);
            let (status, message) = match e {
                SafeApiError::UnsupportedNetwork(msg) => (StatusCode::BAD_REQUEST, msg),
                SafeApiError::NotFound(msg) => (StatusCode::NOT_FOUND, msg),
                SafeApiError::NetworkError(msg) => (StatusCode::BAD_GATEWAY, msg),
                SafeApiError::ParseError(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            };
            return (status, Json(json!({"message": message}))).into_response();
        }
    };
    
    let blockchain_info = match get_multisig_info_internal(
        &state,
        &creation_api_info.transaction_hash,
        &payload.network,
        Some(&payload.safe_address),
    ).await {
        Ok(info) => info,
        Err(e) => {
            tracing::error!("Failed to fetch blockchain info: {}", e);
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(json!({"message": "Failed to fetch blockchain info"}))).into_response();
        }
    };
    
    let safe_info = SafeInfo {
        address: safe_api_info.address,
        nonce: safe_api_info.nonce,
        threshold: safe_api_info.threshold,
        owners: safe_api_info.owners,
        master_copy: safe_api_info.master_copy,
        modules: if safe_api_info.modules.is_empty() { None } else { Some(safe_api_info.modules) },
        fallback_handler: safe_api_info.fallback_handler,
        guard: safe_api_info.guard,
        version: safe_api_info.version,
    };
    
    let creation_info = Some(CreationInfo {
        creator: creation_api_info.creator,
        transaction_hash: creation_api_info.transaction_hash,
        factory_address: creation_api_info.factory_address,
    });
    
    let multisig_info = Some(MultisigInfo {
        master_copy: blockchain_info.master_copy,
        initializer: blockchain_info.initializer,
        fallback_handler: blockchain_info.fallback_handler,
        creator: blockchain_info.creator,
        proxy: blockchain_info.proxy,
        proxy_factory: blockchain_info.proxy_factory,
        initiator: blockchain_info.initiator,
        owners: if blockchain_info.owners.is_empty() { None } else { Some(blockchain_info.owners) },
        threshold: blockchain_info.threshold,
        guard: blockchain_info.guard,
        fallback_handler_runtime: blockchain_info.fallback_handler_runtime,
        modules: if blockchain_info.modules.is_empty() { None } else { Some(blockchain_info.modules) },
        version: blockchain_info.version,
    });
    
    let sanctions_results = check_sanctions_for_safe(&state, &safe_info, &creation_info, &multisig_info).await;
    
    let assessment_request = SafeAssessmentRequest {
        safe_address: payload.safe_address,
        network: payload.network,
        safe_info,
        creation_info,
        sanctions_results,
        multisig_info,
    };
    
    let service = SafeAssessmentService::new();
    let response = service.assess_safe(assessment_request);
    
    Json(response).into_response()
}

async fn check_sanctions_for_safe(
    state: &AppState,
    safe_info: &SafeInfo,
    creation_info: &Option<CreationInfo>,
    multisig_info: &Option<MultisigInfo>,
) -> Option<SanctionsResults> {
    let api_key = match &state.config.chainalysis_api_key {
        Some(key) if !key.is_empty() => key,
        _ => {
            tracing::debug!("CHAINALYSIS_API_KEY not set - skipping sanctions check");
            return None;
        }
    };

    let mut addresses_to_check: Vec<String> = Vec::new();
    
    addresses_to_check.push(safe_info.address.clone());
    addresses_to_check.extend(safe_info.owners.clone());
    
    if let Some(ref creation) = creation_info {
        addresses_to_check.push(creation.creator.clone());
        if let Some(ref factory) = creation.factory_address {
            addresses_to_check.push(factory.clone());
        }
    }
    
    if let Some(ref modules) = safe_info.modules {
        addresses_to_check.extend(modules.clone());
    }
    
    if let Some(ref master_copy) = safe_info.master_copy {
        addresses_to_check.push(master_copy.clone());
    }
    
    if let Some(ref handler) = safe_info.fallback_handler {
        if handler != "0x0000000000000000000000000000000000000000" {
            addresses_to_check.push(handler.clone());
        }
    }
    
    addresses_to_check.sort();
    addresses_to_check.dedup();
    
    let mut results = HashMap::new();
    let mut sanctioned_addresses = Vec::new();
    
    let client = reqwest::Client::new();
    
    for address in &addresses_to_check {
        let url = format!("https://public.chainalysis.com/api/v1/address/{}", address);
        
        match client
            .get(&url)
            .header("X-API-Key", api_key)
            .header("Accept", "application/json")
            .send()
            .await
        {
            Ok(response) if response.status().is_success() => {
                match response.json::<serde_json::Value>().await {
                    Ok(data) => {
                        let identifications = data["identifications"]
                            .as_array()
                            .cloned()
                            .unwrap_or_default();
                        
                        let is_sanctioned = !identifications.is_empty();
                        if is_sanctioned {
                            sanctioned_addresses.push(address.clone());
                        }
                        
                        results.insert(
                            address.clone(),
                            SanctionResult {
                                sanctioned: is_sanctioned,
                                data: if is_sanctioned { Some(identifications) } else { None },
                            },
                        );
                    }
                    Err(e) => {
                        tracing::warn!("Failed to parse Chainalysis response for {}: {}", address, e);
                        results.insert(
                            address.clone(),
                            SanctionResult {
                                sanctioned: false,
                                data: None,
                            },
                        );
                    }
                }
            }
            Ok(response) => {
                tracing::warn!("Chainalysis API returned {} for {}", response.status(), address);
                results.insert(
                    address.clone(),
                    SanctionResult {
                        sanctioned: false,
                        data: None,
                    },
                );
            }
            Err(e) => {
                tracing::warn!("Failed to call Chainalysis API for {}: {}", address, e);
                results.insert(
                    address.clone(),
                    SanctionResult {
                        sanctioned: false,
                        data: None,
                    },
                );
            }
        }
    }
    
    Some(SanctionsResults {
        overall_sanctioned: !sanctioned_addresses.is_empty(),
        sanctioned_addresses,
        results,
    })
}
