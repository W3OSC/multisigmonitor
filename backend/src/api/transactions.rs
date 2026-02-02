use axum::{
    extract::{Path, Query, State, Extension},
    http::StatusCode,
    Json,
};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

use super::AppState;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TransactionRecord {
    pub id: String,
    pub monitor_id: String,
    pub safe_tx_hash: String,
    pub network: String,
    pub safe_address: String,
    pub to_address: String,
    pub value: Option<String>,
    pub data: Option<String>,
    pub operation: Option<i64>,
    pub nonce: i64,
    pub is_executed: bool,
    pub submission_date: Option<String>,
    pub execution_date: Option<String>,
    pub transaction_data: Option<serde_json::Value>,
    pub created_at: String,
    pub updated_at: String,
    pub security_analysis: Option<SecurityAnalysisSummary>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SecurityAnalysisSummary {
    pub id: String,
    pub is_suspicious: bool,
    pub risk_level: String,
    pub warnings: Vec<String>,
    pub details: Option<Vec<serde_json::Value>>,
    pub hash_verification: Option<serde_json::Value>,
    pub nonce_check: Option<serde_json::Value>,
    pub calldata: Option<serde_json::Value>,
}

#[derive(Debug, FromRow)]
struct TransactionRow {
    id: String,
    monitor_id: String,
    safe_tx_hash: String,
    network: String,
    safe_address: String,
    to_address: String,
    value: Option<String>,
    data: Option<String>,
    operation: Option<i64>,
    nonce: i64,
    is_executed: bool,
    submission_date: Option<String>,
    execution_date: Option<String>,
    transaction_data: Option<String>,
    created_at: String,
    updated_at: String,
    sa_id: Option<String>,
    is_suspicious: Option<bool>,
    risk_level: Option<String>,
    warnings: Option<String>,
    details: Option<String>,
    hash_verification: Option<String>,
    nonce_check: Option<String>,
    calldata: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TransactionListQuery {
    pub safe_address: Option<String>,
    pub network: Option<String>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

pub async fn list_transactions(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Query(query): Query<TransactionListQuery>,
) -> Result<Json<Vec<TransactionRecord>>, StatusCode> {
    let limit = query.limit.unwrap_or(100).min(1000);
    let offset = query.offset.unwrap_or(0);

    let mut sql = String::from(
        "SELECT DISTINCT 
            t.id, t.monitor_id, t.safe_tx_hash, t.network, t.safe_address,
            t.to_address, t.value, t.data, t.operation, t.nonce,
            t.is_executed, t.submission_date, t.execution_date,
            t.transaction_data, t.created_at, t.updated_at,
            sa.id as sa_id, sa.is_suspicious, sa.risk_level, sa.warnings, sa.details,
            sa.hash_verification, sa.nonce_check, sa.calldata
         FROM transactions t
         INNER JOIN monitors m ON t.monitor_id = m.id
         LEFT JOIN security_analyses sa ON t.safe_tx_hash = sa.safe_tx_hash 
            AND LOWER(t.safe_address) = LOWER(sa.safe_address)
         WHERE m.user_id = ?"
    );

    let mut params: Vec<String> = vec![user_id];

    if let Some(safe_address) = &query.safe_address {
        sql.push_str(" AND t.safe_address = ?");
        params.push(safe_address.clone());
    }

    if let Some(network) = &query.network {
        sql.push_str(" AND t.network = ?");
        params.push(network.clone());
    }

    sql.push_str(" ORDER BY t.created_at DESC LIMIT ? OFFSET ?");
    params.push(limit.to_string());
    params.push(offset.to_string());

    let mut query_builder = sqlx::query_as::<_, TransactionRow>(&sql);

    for param in &params {
        query_builder = query_builder.bind(param);
    }

    let rows = query_builder
        .fetch_all(&state.pool)
        .await
        .map_err(|e| {
            eprintln!("Database error: {}", e);
            StatusCode::INTERNAL_SERVER_ERROR
        })?;

    let transactions: Vec<TransactionRecord> = rows
        .into_iter()
        .map(|row| {
            let security_analysis = if let (Some(sa_id), Some(is_suspicious), Some(risk_level), Some(warnings_str)) = 
                (row.sa_id.clone(), row.is_suspicious, row.risk_level.clone(), row.warnings.clone()) {
                let warnings: Vec<String> = serde_json::from_str(&warnings_str).unwrap_or_default();
                let details: Option<Vec<serde_json::Value>> = row.details
                    .and_then(|d| serde_json::from_str(&d).ok());
                let hash_verification: Option<serde_json::Value> = row.hash_verification
                    .and_then(|h| serde_json::from_str(&h).ok());
                let nonce_check: Option<serde_json::Value> = row.nonce_check
                    .and_then(|n| serde_json::from_str(&n).ok());
                let calldata: Option<serde_json::Value> = row.calldata
                    .and_then(|c| serde_json::from_str(&c).ok());
                Some(SecurityAnalysisSummary {
                    id: sa_id,
                    is_suspicious,
                    risk_level,
                    warnings,
                    details,
                    hash_verification,
                    nonce_check,
                    calldata,
                })
            } else {
                None
            };

            TransactionRecord {
                id: row.id,
                monitor_id: row.monitor_id,
                safe_tx_hash: row.safe_tx_hash,
                network: row.network,
                safe_address: row.safe_address,
                to_address: row.to_address,
                value: row.value,
                data: row.data,
                operation: row.operation,
                nonce: row.nonce,
                is_executed: row.is_executed,
                submission_date: row.submission_date,
                execution_date: row.execution_date,
                transaction_data: row.transaction_data.and_then(|json_str| serde_json::from_str(&json_str).ok()),
                created_at: row.created_at,
                updated_at: row.updated_at,
                security_analysis,
            }
        })
        .collect();

    Ok(Json(transactions))
}

pub async fn get_transaction(
    State(state): State<AppState>,
    Extension(user_id): Extension<String>,
    Path(id): Path<String>,
) -> Result<Json<TransactionRecord>, StatusCode> {
    let row = sqlx::query_as::<_, TransactionRow>(
        "SELECT 
            t.id, t.monitor_id, t.safe_tx_hash, t.network, t.safe_address,
            t.to_address, t.value, t.data, t.operation, t.nonce,
            t.is_executed, t.submission_date, t.execution_date,
            t.transaction_data, t.created_at, t.updated_at,
            sa.id as sa_id, sa.is_suspicious, sa.risk_level, sa.warnings, sa.details,
            sa.hash_verification, sa.nonce_check, sa.calldata
         FROM transactions t
         INNER JOIN monitors m ON t.monitor_id = m.id
         LEFT JOIN security_analyses sa ON t.safe_tx_hash = sa.safe_tx_hash 
            AND t.safe_address = sa.safe_address
         WHERE t.id = ? AND m.user_id = ?"
    )
    .bind(&id)
    .bind(&user_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(|e| {
        eprintln!("Database error: {}", e);
        StatusCode::INTERNAL_SERVER_ERROR
    })?
    .ok_or(StatusCode::NOT_FOUND)?;

    let security_analysis = if let (Some(sa_id), Some(is_suspicious), Some(risk_level), Some(warnings_str)) = 
        (row.sa_id.clone(), row.is_suspicious, row.risk_level.clone(), row.warnings.clone()) {
        let warnings: Vec<String> = serde_json::from_str(&warnings_str).unwrap_or_default();
        let details: Option<Vec<serde_json::Value>> = row.details.clone()
            .and_then(|d| serde_json::from_str(&d).ok());
        let hash_verification: Option<serde_json::Value> = row.hash_verification.clone()
            .and_then(|h| serde_json::from_str(&h).ok());
        let nonce_check: Option<serde_json::Value> = row.nonce_check.clone()
            .and_then(|n| serde_json::from_str(&n).ok());
        let calldata: Option<serde_json::Value> = row.calldata.clone()
            .and_then(|c| serde_json::from_str(&c).ok());
        Some(SecurityAnalysisSummary {
            id: sa_id,
            is_suspicious,
            risk_level,
            warnings,
            details,
            hash_verification,
            nonce_check,
            calldata,
        })
    } else {
        None
    };

    let transaction = TransactionRecord {
        id: row.id,
        monitor_id: row.monitor_id,
        safe_tx_hash: row.safe_tx_hash,
        network: row.network,
        safe_address: row.safe_address,
        to_address: row.to_address,
        value: row.value,
        data: row.data,
        operation: row.operation,
        nonce: row.nonce,
        is_executed: row.is_executed,
        submission_date: row.submission_date,
        execution_date: row.execution_date,
        transaction_data: row.transaction_data.and_then(|json_str| serde_json::from_str(&json_str).ok()),
        created_at: row.created_at,
        updated_at: row.updated_at,
        security_analysis,
    };

    Ok(Json(transaction))
}
