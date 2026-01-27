use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use utoipa::ToSchema;

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TransactionAnalysisRequest {
    pub safe_address: String,
    pub network: String,
    pub transaction: SafeTransaction,
    pub chain_id: Option<u64>,
    pub safe_version: Option<String>,
    pub previous_nonce: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SafeTransaction {
    pub to: String,
    pub value: Option<String>,
    pub data: Option<String>,
    pub data_decoded: Option<DataDecoded>,
    pub operation: Option<u8>,
    pub gas_token: Option<String>,
    pub safe_tx_gas: Option<String>,
    pub base_gas: Option<String>,
    pub gas_price: Option<String>,
    pub refund_receiver: Option<String>,
    pub nonce: Option<u64>,
    pub safe_tx_hash: Option<String>,
    pub trusted: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DataDecoded {
    pub method: String,
    pub parameters: Option<Vec<Parameter>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Parameter {
    pub name: String,
    pub r#type: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, FromRow)]
#[serde(rename_all = "camelCase")]
pub struct SecurityAnalysisResult {
    pub id: String,
    pub safe_address: String,
    pub network: String,
    pub transaction_hash: Option<String>,
    pub safe_tx_hash: Option<String>,
    pub is_suspicious: bool,
    pub risk_level: String,
    pub warnings: serde_json::Value,
    pub details: serde_json::Value,
    pub call_type: Option<serde_json::Value>,
    pub hash_verification: Option<serde_json::Value>,
    pub nonce_check: Option<serde_json::Value>,
    pub calldata: Option<serde_json::Value>,
    pub assessment: Option<serde_json::Value>,
    pub analyzed_at: String,
    pub user_id: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisResponse {
    pub is_suspicious: bool,
    pub risk_level: RiskLevel,
    pub warnings: Vec<String>,
    pub details: Vec<AnalysisDetail>,
    pub call_type: Option<CallType>,
    pub hash_verification: Option<HashVerification>,
    pub nonce_check: Option<NonceCheck>,
    pub calldata: Option<CalldataInfo>,
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl std::fmt::Display for RiskLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RiskLevel::Low => write!(f, "low"),
            RiskLevel::Medium => write!(f, "medium"),
            RiskLevel::High => write!(f, "high"),
            RiskLevel::Critical => write!(f, "critical"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisDetail {
    pub r#type: String,
    pub severity: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(flatten)]
    pub extra: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CallType {
    pub is_call: bool,
    pub is_delegate_call: bool,
    pub is_trusted_delegate: bool,
    pub contract_address: String,
    pub contract_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct HashVerification {
    pub verified: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct NonceCheck {
    pub is_risky: bool,
    pub risk_level: String,
    pub message: String,
    pub gap: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CalldataInfo {
    pub method: Option<String>,
    pub decoded: Option<DataDecoded>,
}
