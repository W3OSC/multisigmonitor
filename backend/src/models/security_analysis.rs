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
    Info,
    Low,
    Medium,
    High,
    Critical,
}

impl std::fmt::Display for RiskLevel {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RiskLevel::Info => write!(f, "info"),
            RiskLevel::Low => write!(f, "low"),
            RiskLevel::Medium => write!(f, "medium"),
            RiskLevel::High => write!(f, "high"),
            RiskLevel::Critical => write!(f, "critical"),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum FindingType {
    HashVerification,
    HashMismatch,
    OperationType,
    OwnerAdded,
    OwnerRemoved,
    OwnerSwapped,
    OwnerAddedWithThreshold,
    ThresholdChanged,
    ModuleEnabled,
    ModuleDisabled,
    GuardChanged,
    FallbackHandlerChanged,
    ImplementationChanged,
    SafeSetup,
    DelegateCall,
    UntrustedDelegateCall,
    TrustedDelegateCall,
    GasParams,
    GasTokenAttack,
    GasTokenAttackEnhanced,
    HighSafeTxGas,
    HighBaseGas,
    ZeroGasWithToken,
    CustomGasToken,
    CustomRefundReceiver,
    LargeValueTransfer,
    ExecutionFailure,
    UnverifiedContract,
    ContractInteraction,
    SafeTxGasSet,
    #[serde(other)]
    Other,
}

impl FindingType {
    pub fn from_str(s: &str) -> Self {
        match s {
            "hash_verification" | "hash_verified" => FindingType::HashVerification,
            "hash_mismatch" => FindingType::HashMismatch,
            "operation_type" => FindingType::OperationType,
            "owner_added" => FindingType::OwnerAdded,
            "owner_removed" => FindingType::OwnerRemoved,
            "owner_swapped" => FindingType::OwnerSwapped,
            "owner_added_with_threshold" => FindingType::OwnerAddedWithThreshold,
            "threshold_changed" => FindingType::ThresholdChanged,
            "module_enabled" => FindingType::ModuleEnabled,
            "module_disabled" => FindingType::ModuleDisabled,
            "guard_changed" => FindingType::GuardChanged,
            "fallback_handler_changed" => FindingType::FallbackHandlerChanged,
            "implementation_changed" => FindingType::ImplementationChanged,
            "safe_setup" => FindingType::SafeSetup,
            "delegate_call" => FindingType::DelegateCall,
            "untrusted_delegate_call" => FindingType::UntrustedDelegateCall,
            "trusted_delegate_call" => FindingType::TrustedDelegateCall,
            "gas_params" => FindingType::GasParams,
            "gas_token_attack" => FindingType::GasTokenAttack,
            "gas_token_attack_enhanced" => FindingType::GasTokenAttackEnhanced,
            "high_safe_tx_gas" => FindingType::HighSafeTxGas,
            "high_base_gas" => FindingType::HighBaseGas,
            "zero_gas_with_token" => FindingType::ZeroGasWithToken,
            "custom_gas_token" => FindingType::CustomGasToken,
            "custom_refund_receiver" => FindingType::CustomRefundReceiver,
            "large_value_transfer" => FindingType::LargeValueTransfer,
            "execution_failure" => FindingType::ExecutionFailure,
            "unverified_contract" => FindingType::UnverifiedContract,
            "contract_interaction" => FindingType::ContractInteraction,
            "safe_tx_gas_set" => FindingType::SafeTxGasSet,
            _ => FindingType::Other,
        }
    }
    
    pub fn as_str(&self) -> &'static str {
        match self {
            FindingType::HashVerification => "hash_verification",
            FindingType::HashMismatch => "hash_mismatch",
            FindingType::OperationType => "operation_type",
            FindingType::OwnerAdded => "owner_added",
            FindingType::OwnerRemoved => "owner_removed",
            FindingType::OwnerSwapped => "owner_swapped",
            FindingType::OwnerAddedWithThreshold => "owner_added_with_threshold",
            FindingType::ThresholdChanged => "threshold_changed",
            FindingType::ModuleEnabled => "module_enabled",
            FindingType::ModuleDisabled => "module_disabled",
            FindingType::GuardChanged => "guard_changed",
            FindingType::FallbackHandlerChanged => "fallback_handler_changed",
            FindingType::ImplementationChanged => "implementation_changed",
            FindingType::SafeSetup => "safe_setup",
            FindingType::DelegateCall => "delegate_call",
            FindingType::UntrustedDelegateCall => "untrusted_delegate_call",
            FindingType::TrustedDelegateCall => "trusted_delegate_call",
            FindingType::GasParams => "gas_params",
            FindingType::GasTokenAttack => "gas_token_attack",
            FindingType::GasTokenAttackEnhanced => "gas_token_attack_enhanced",
            FindingType::HighSafeTxGas => "high_safe_tx_gas",
            FindingType::HighBaseGas => "high_base_gas",
            FindingType::ZeroGasWithToken => "zero_gas_with_token",
            FindingType::CustomGasToken => "custom_gas_token",
            FindingType::CustomRefundReceiver => "custom_refund_receiver",
            FindingType::LargeValueTransfer => "large_value_transfer",
            FindingType::ExecutionFailure => "execution_failure",
            FindingType::UnverifiedContract => "unverified_contract",
            FindingType::ContractInteraction => "contract_interaction",
            FindingType::SafeTxGasSet => "safe_tx_gas_set",
            FindingType::Other => "other",
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisDetail {
    pub finding_type: FindingType,
    pub category: String,
    pub severity: String,
    pub title: String,
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
#[serde(rename_all = "camelCase")]
pub struct HashVerification {
    pub verified: bool,
    pub calculated_hashes: Option<CalculatedHashes>,
    pub api_hashes: Option<ApiHashes>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CalculatedHashes {
    pub domain_hash: String,
    pub message_hash: String,
    pub safe_tx_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApiHashes {
    pub safe_tx_hash: String,
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
