use axum::{
    extract::State,
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};

use super::AppState;

#[derive(Debug, Deserialize)]
pub struct CheckSanctionsRequest {
    pub address: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SanctionsResponse {
    pub sanctioned: bool,
    pub data: Vec<serde_json::Value>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}

pub async fn check_sanctions(
    State(state): State<AppState>,
    Json(payload): Json<CheckSanctionsRequest>,
) -> Result<Json<SanctionsResponse>, StatusCode> {
    let api_key = match &state.config.chainalysis_api_key {
        Some(key) if !key.is_empty() => key.clone(),
        _ => {
            tracing::warn!("CHAINALYSIS_API_KEY not set - sanctions check not performed");
            return Ok(Json(SanctionsResponse {
                sanctioned: false,
                data: vec![],
                message: Some("Sanctions check not performed - API key not configured".to_string()),
            }));
        }
    };

    let url = format!(
        "https://public.chainalysis.com/api/v1/address/{}",
        payload.address
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("X-API-Key", api_key)
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| {
            tracing::error!("Failed to call Chainalysis API: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    if !response.status().is_success() {
        tracing::error!("Chainalysis API returned error: {}", response.status());
        return Err(StatusCode::BAD_GATEWAY);
    }

    let result: serde_json::Value = response.json().await.map_err(|e| {
        tracing::error!("Failed to parse Chainalysis response: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let identifications = result["identifications"]
        .as_array()
        .cloned()
        .unwrap_or_default();

    Ok(Json(SanctionsResponse {
        sanctioned: !identifications.is_empty(),
        data: identifications,
        message: None,
    }))
}
