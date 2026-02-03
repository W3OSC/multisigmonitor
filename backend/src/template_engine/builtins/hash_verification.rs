use super::{BuiltinCheck, BuiltinContext, BuiltinResult, BuiltinOutput};
use crate::services::hash_verification;

const ZERO_ADDRESS: &str = "0x0000000000000000000000000000000000000000";

pub struct HashVerificationBuiltin;

impl BuiltinCheck for HashVerificationBuiltin {
    fn name(&self) -> &'static str {
        "verify-transaction-hash"
    }

    fn execute(&self, context: &BuiltinContext) -> BuiltinResult {
        let tx = &context.transaction;
        
        let chain_id = match context.chain_id {
            Some(id) => id,
            None => {
                tracing::debug!("Hash verification skipped: no chain_id");
                return BuiltinResult {
                    success: true,
                    output: None,
                    error: None,
                };
            }
        };

        let safe_version = match &context.safe_version {
            Some(v) => v.clone(),
            None => {
                tracing::debug!("Hash verification skipped: no safe_version");
                return BuiltinResult {
                    success: true,
                    output: None,
                    error: None,
                };
            }
        };

        let nonce = match tx.get("nonce").and_then(|n| n.as_u64()) {
            Some(n) => n,
            None => {
                tracing::debug!("Hash verification skipped: no nonce");
                return BuiltinResult {
                    success: true,
                    output: None,
                    error: None,
                };
            }
        };

        let safe_tx_hash = match tx.get("safeTxHash").and_then(|h| h.as_str()) {
            Some(h) => h,
            None => {
                tracing::debug!("Hash verification skipped: no safeTxHash");
                return BuiltinResult {
                    success: true,
                    output: None,
                    error: None,
                };
            }
        };

        let to = tx.get("to").and_then(|v| v.as_str()).unwrap_or("");
        let value = tx.get("value").and_then(|v| v.as_str()).unwrap_or("0");
        let data = tx.get("data").and_then(|v| v.as_str()).unwrap_or("0x");
        let operation = tx.get("operation").and_then(|v| v.as_u64()).unwrap_or(0) as u8;
        let safe_tx_gas = tx.get("safeTxGas").and_then(|v| v.as_str()).unwrap_or("0");
        let base_gas = tx.get("baseGas").and_then(|v| v.as_str()).unwrap_or("0");
        let gas_price = tx.get("gasPrice").and_then(|v| v.as_str()).unwrap_or("0");
        let gas_token = tx.get("gasToken").and_then(|v| v.as_str()).unwrap_or(ZERO_ADDRESS);
        let refund_receiver = tx.get("refundReceiver").and_then(|v| v.as_str()).unwrap_or(ZERO_ADDRESS);

        let result = hash_verification::verify_transaction_hashes(
            to,
            value,
            data,
            operation,
            safe_tx_gas,
            base_gas,
            gas_price,
            gas_token,
            refund_receiver,
            nonce,
            safe_tx_hash,
            &context.safe_address,
            chain_id,
            &safe_version,
        );

        tracing::debug!(
            verified = result.verified,
            safe_tx_hash = %safe_tx_hash,
            "Hash verification result"
        );

        if !result.verified {
            tracing::warn!(
                safe_tx_hash = %safe_tx_hash,
                calculated = %result.calculated_hashes.safe_tx_hash,
                "Hash mismatch detected!"
            );
            BuiltinResult {
                success: false,
                output: Some(BuiltinOutput {
                    output_type: "hash_mismatch".to_string(),
                    severity: "critical".to_string(),
                    warning: Some("Hash Verification Failed".to_string()),
                    message: result.error.clone().unwrap_or_else(|| 
                        "Safe transaction hash does not match calculated hash".to_string()
                    ),
                    priority: Some("P0".to_string()),
                    extra: serde_json::json!({
                        "verified": false,
                        "calculatedHashes": {
                            "domainHash": result.calculated_hashes.domain_hash,
                            "messageHash": result.calculated_hashes.message_hash,
                            "safeTxHash": result.calculated_hashes.safe_tx_hash,
                        },
                        "apiHashes": {
                            "safeTxHash": result.api_hashes.safe_tx_hash,
                        }
                    }),
                }),
                error: result.error,
            }
        } else {
            BuiltinResult {
                success: true,
                output: Some(BuiltinOutput {
                    output_type: "hash_verified".to_string(),
                    severity: "low".to_string(),
                    warning: None,
                    message: "Safe transaction hash matches calculated hash".to_string(),
                    priority: None,
                    extra: serde_json::json!({
                        "verified": true,
                        "calculatedHashes": {
                            "domainHash": result.calculated_hashes.domain_hash,
                            "messageHash": result.calculated_hashes.message_hash,
                            "safeTxHash": result.calculated_hashes.safe_tx_hash,
                        },
                        "apiHashes": {
                            "safeTxHash": result.api_hashes.safe_tx_hash,
                        }
                    }),
                }),
                error: None,
            }
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct HashVerificationOutput {
    pub verified: bool,
    pub calculated_hashes: CalculatedHashes,
    pub api_hashes: ApiHashes,
    pub error: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct CalculatedHashes {
    pub domain_hash: String,
    pub message_hash: String,
    pub safe_tx_hash: String,
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct ApiHashes {
    pub safe_tx_hash: String,
}

#[allow(dead_code)]
impl HashVerificationBuiltin {
    pub fn get_verification_result(context: &BuiltinContext) -> Option<HashVerificationOutput> {
        let tx = &context.transaction;
        
        let chain_id = context.chain_id?;
        let safe_version = context.safe_version.as_ref()?;
        let nonce = tx.get("nonce").and_then(|n| n.as_u64())?;
        let safe_tx_hash = tx.get("safeTxHash").and_then(|h| h.as_str())?;

        let to = tx.get("to").and_then(|v| v.as_str()).unwrap_or("");
        let value = tx.get("value").and_then(|v| v.as_str()).unwrap_or("0");
        let data = tx.get("data").and_then(|v| v.as_str()).unwrap_or("0x");
        let operation = tx.get("operation").and_then(|v| v.as_u64()).unwrap_or(0) as u8;
        let safe_tx_gas = tx.get("safeTxGas").and_then(|v| v.as_str()).unwrap_or("0");
        let base_gas = tx.get("baseGas").and_then(|v| v.as_str()).unwrap_or("0");
        let gas_price = tx.get("gasPrice").and_then(|v| v.as_str()).unwrap_or("0");
        let gas_token = tx.get("gasToken").and_then(|v| v.as_str()).unwrap_or(ZERO_ADDRESS);
        let refund_receiver = tx.get("refundReceiver").and_then(|v| v.as_str()).unwrap_or(ZERO_ADDRESS);

        let result = hash_verification::verify_transaction_hashes(
            to,
            value,
            data,
            operation,
            safe_tx_gas,
            base_gas,
            gas_price,
            gas_token,
            refund_receiver,
            nonce,
            safe_tx_hash,
            &context.safe_address,
            chain_id,
            safe_version,
        );

        Some(HashVerificationOutput {
            verified: result.verified,
            calculated_hashes: CalculatedHashes {
                domain_hash: result.calculated_hashes.domain_hash,
                message_hash: result.calculated_hashes.message_hash,
                safe_tx_hash: result.calculated_hashes.safe_tx_hash,
            },
            api_hashes: ApiHashes {
                safe_tx_hash: result.api_hashes.safe_tx_hash,
            },
            error: result.error,
        })
    }
}
