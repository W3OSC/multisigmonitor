use axum::{
    extract::{State, Extension},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use uuid::Uuid;

use crate::{
    models::{
        security_analysis::*,
    },
    services::security_analysis::{SecurityAnalysisService, AnalysisOptions},
    api::AppState,
};

#[utoipa::path(
    post,
    path = "/api/security/analyze",
    request_body = TransactionAnalysisRequest,
    responses(
        (status = 200, description = "Analysis completed successfully", body = AnalysisResponse),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    tag = "security",
    security(("jwt" = []))
)]
pub async fn analyze_transaction(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Json(request): Json<TransactionAnalysisRequest>,
) -> Result<impl IntoResponse, StatusCode> {
    let service = SecurityAnalysisService::new();
    
    let options = AnalysisOptions {
        chain_id: request.chain_id,
        safe_version: request.safe_version,
        previous_nonce: request.previous_nonce,
    };

    let analysis = service.analyze_transaction(
        &request.transaction,
        &request.safe_address,
        options,
    );

    let result_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    
    let warnings_json = serde_json::to_value(&analysis.warnings)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let details_json = serde_json::to_value(&analysis.details)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let call_type_json = serde_json::to_value(&analysis.call_type)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let hash_verification_json = serde_json::to_value(&analysis.hash_verification)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let nonce_check_json = serde_json::to_value(&analysis.nonce_check)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    
    let calldata_json = serde_json::to_value(&analysis.calldata)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    sqlx::query(
        r#"
        INSERT INTO security_analyses 
        (id, safe_address, network, transaction_hash, safe_tx_hash, is_suspicious, 
         risk_level, warnings, details, call_type, hash_verification, nonce_check, 
         calldata, analyzed_at, user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        "#
    )
    .bind(&result_id)
    .bind(&request.safe_address)
    .bind(&request.network)
    .bind(request.transaction.safe_tx_hash.as_deref())
    .bind(request.transaction.safe_tx_hash.as_deref())
    .bind(analysis.is_suspicious)
    .bind(analysis.risk_level.to_string())
    .bind(warnings_json.to_string())
    .bind(details_json.to_string())
    .bind(call_type_json.to_string())
    .bind(hash_verification_json.to_string())
    .bind(nonce_check_json.to_string())
    .bind(calldata_json.to_string())
    .bind(&now)
    .bind(&user_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to store security analysis: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(analysis))
}

#[utoipa::path(
    post,
    path = "/api/security/safe-review",
    request_body = serde_json::Value,
    responses(
        (status = 200, description = "Safe review saved successfully", body = SecurityAnalysisResult),
        (status = 400, description = "Invalid request"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    tag = "security",
    security(("jwt" = []))
)]
pub async fn save_safe_review(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Json(request): Json<serde_json::Value>,
) -> Result<impl IntoResponse, StatusCode> {
    let safe_address = request.get("safeAddress")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;
    
    let network = request.get("network")
        .and_then(|v| v.as_str())
        .ok_or(StatusCode::BAD_REQUEST)?;
    
    let assessment = request.get("assessment")
        .ok_or(StatusCode::BAD_REQUEST)?;

    let is_suspicious = assessment.get("isSuspicious")
        .and_then(|v| v.as_bool())
        .unwrap_or(false);
    
    let risk_level = assessment.get("overallRisk")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown");

    let result_id = Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        r#"
        INSERT INTO security_analyses 
        (id, safe_address, network, is_suspicious, risk_level, warnings, details, 
         assessment, analyzed_at, user_id)
        VALUES (?, ?, ?, ?, ?, '[]', '{}', ?, ?, ?)
        "#
    )
    .bind(&result_id)
    .bind(safe_address)
    .bind(network)
    .bind(is_suspicious)
    .bind(risk_level)
    .bind(assessment.to_string())
    .bind(&now)
    .bind(&user_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to store safe review: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    let result = SecurityAnalysisResult {
        id: result_id,
        safe_address: safe_address.to_string(),
        network: network.to_string(),
        transaction_hash: None,
        safe_tx_hash: None,
        is_suspicious,
        risk_level: risk_level.to_string(),
        warnings: serde_json::json!([]),
        details: serde_json::json!({}),
        call_type: None,
        hash_verification: None,
        nonce_check: None,
        calldata: None,
        assessment: Some(assessment.clone()),
        analyzed_at: now.clone(),
        user_id: Some(user_id),
        created_at: Some(now),
    };

    Ok(Json(result))
}

#[utoipa::path(
    get,
    path = "/api/security/analyses",
    params(
        ("safe_address" = Option<String>, Query, description = "Filter by Safe address"),
        ("network" = Option<String>, Query, description = "Filter by network"),
        ("risk_level" = Option<String>, Query, description = "Filter by risk level")
    ),
    responses(
        (status = 200, description = "List of security analyses", body = Vec<SecurityAnalysisResult>),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    tag = "security",
    security(("jwt" = []))
)]
pub async fn list_analyses(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let analyses = sqlx::query_as::<_, SecurityAnalysisResult>(
        r#"
        SELECT * FROM security_analyses 
        WHERE user_id = ?
        ORDER BY analyzed_at DESC
        LIMIT 100
        "#
    )
    .bind(&user_id)
    .fetch_all(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch security analyses: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(Json(analyses))
}

#[utoipa::path(
    get,
    path = "/api/security/analyses/{id}",
    params(
        ("id" = String, Path, description = "Analysis ID")
    ),
    responses(
        (status = 200, description = "Security analysis result", body = SecurityAnalysisResult),
        (status = 404, description = "Analysis not found"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    tag = "security",
    security(("jwt" = []))
)]
pub async fn get_analysis(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<impl IntoResponse, StatusCode> {
    let analysis = sqlx::query_as::<_, SecurityAnalysisResult>(
        "SELECT * FROM security_analyses WHERE id = ? AND user_id = ?"
    )
    .bind(&id)
    .bind(&user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to fetch security analysis: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    Ok(Json(analysis))
}

#[utoipa::path(
    delete,
    path = "/api/security/analyses/{id}",
    params(
        ("id" = String, Path, description = "Analysis ID")
    ),
    responses(
        (status = 204, description = "Analysis deleted successfully"),
        (status = 404, description = "Analysis not found"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    tag = "security",
    security(("jwt" = []))
)]
pub async fn delete_analysis(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    axum::extract::Path(id): axum::extract::Path<String>,
) -> Result<StatusCode, StatusCode> {
    let result = sqlx::query(
        "DELETE FROM security_analyses WHERE id = ? AND user_id = ?"
    )
    .bind(&id)
    .bind(&user_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to delete security analysis: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    if result.rows_affected() == 0 {
        return Err(StatusCode::NOT_FOUND);
    }

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    delete,
    path = "/api/security/analyses",
    responses(
        (status = 204, description = "All analyses deleted successfully"),
        (status = 401, description = "Unauthorized"),
        (status = 500, description = "Internal server error")
    ),
    tag = "security",
    security(("jwt" = []))
)]
pub async fn delete_all_analyses(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
) -> Result<StatusCode, StatusCode> {
    sqlx::query(
        "DELETE FROM security_analyses WHERE user_id = ?"
    )
    .bind(&user_id)
    .execute(&state.pool)
    .await
    .map_err(|e| {
        tracing::error!("Failed to delete all security analyses: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?;

    Ok(StatusCode::NO_CONTENT)
}
