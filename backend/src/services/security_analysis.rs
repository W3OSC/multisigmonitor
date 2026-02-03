use crate::models::security_analysis::*;
use crate::template_engine::{TemplateEngine, TransactionContext, DataDecodedContext, ParameterContext};
use tracing::info;

pub struct SecurityAnalysisService {
    engine: TemplateEngine,
}

impl SecurityAnalysisService {
    pub fn new() -> Self {
        Self {
            engine: TemplateEngine::new(),
        }
    }

    pub fn analyze_transaction(
        &self,
        transaction: &SafeTransaction,
        safe_address: &str,
        options: AnalysisOptions,
    ) -> AnalysisResponse {
        let mut analysis = AnalysisResponse {
            is_suspicious: false,
            risk_level: RiskLevel::Low,
            warnings: Vec::new(),
            details: Vec::new(),
            call_type: None,
            hash_verification: None,
            nonce_check: None,
            calldata: None,
            priority: None,
        };

        let mut context = self.transaction_to_context(transaction, safe_address);
        context.chain_id = options.chain_id;
        context.safe_version = options.safe_version.clone();
        
        let matches = self.engine.evaluate_transaction(&context);
        
        info!(templates_evaluated = self.engine.template_count(), matches_found = matches.len(), "Template engine evaluation complete");
        
        for m in &matches {
            info!(template = %m.template_id, severity = %m.severity.as_str(), warning = %m.warning, "Template matched");
        }
        
        for m in matches {
            if m.output_type == "security_score" {
                if let Some(risk_level_str) = m.extra.get("risk_level").and_then(|v| v.as_str()) {
                    analysis.risk_level = match risk_level_str {
                        "critical" => RiskLevel::Critical,
                        "high" => RiskLevel::High,
                        "medium" => RiskLevel::Medium,
                        _ => RiskLevel::Low,
                    };
                }
                if let Some(is_suspicious) = m.extra.get("is_suspicious").and_then(|v: &serde_json::Value| v.as_bool()) {
                    analysis.is_suspicious = is_suspicious;
                }
                if let Some(priority) = m.extra.get("priority").and_then(|v: &serde_json::Value| v.as_str()) {
                    analysis.priority = Some(priority.to_string());
                }
            } else if m.output_type == "hash_mismatch" || m.output_type == "hash_verified" {
                if let Ok(hash_verification) = serde_json::from_value::<HashVerification>(m.extra.clone()) {
                    analysis.hash_verification = Some(hash_verification.clone());
                    
                    let (severity, title) = if hash_verification.verified {
                        ("info", "Hash Verified")
                    } else {
                        ("critical", "Hash Mismatch Detected")
                    };
                    
                    let finding_type = if hash_verification.verified {
                        FindingType::HashVerification
                    } else {
                        FindingType::HashMismatch
                    };
                    
                    let message = if hash_verification.verified {
                        "Transaction hash matches the calculated EIP-712 hash".to_string()
                    } else {
                        "Transaction hash does NOT match the calculated hash - potential tampering".to_string()
                    };
                    
                    analysis.details.push(AnalysisDetail {
                        finding_type,
                        category: "hash".to_string(),
                        severity: severity.to_string(),
                        title: title.to_string(),
                        message,
                        priority: if hash_verification.verified { None } else { Some("P0".to_string()) },
                        extra: m.extra.clone(),
                    });
                }
            } else {
                let finding_type = FindingType::from_str(&m.output_type);
                let category = Self::derive_category(&m.output_type);
                let title = if m.warning.is_empty() {
                    Self::derive_title(&m.output_type)
                } else {
                    m.warning.clone()
                };
                
                analysis.details.push(AnalysisDetail {
                    finding_type,
                    category,
                    severity: m.severity.as_str().to_string(),
                    title,
                    message: m.message,
                    priority: m.priority,
                    extra: m.extra,
                });
            }
        }
        
        let call_type_info = self.engine.get_call_type_info(&context);
        
        analysis.call_type = Some(CallType {
            is_call: call_type_info.is_call,
            is_delegate_call: call_type_info.is_delegate_call,
            is_trusted_delegate: call_type_info.is_trusted_delegate,
            contract_address: call_type_info.contract_address,
            contract_name: call_type_info.contract_name,
        });

        for detail in &analysis.details {
            if !detail.title.is_empty() && detail.severity != "info" {
                analysis.warnings.push(detail.title.clone());
            }
        }

        analysis
    }
    
    fn derive_category(output_type: &str) -> String {
        match output_type {
            "owner_added" | "owner_removed" | "owner_swapped" | "owner_added_with_threshold" | "threshold_changed" => "ownership".to_string(),
            "module_enabled" | "module_disabled" => "module".to_string(),
            "guard_changed" => "guard".to_string(),
            "fallback_handler_changed" => "fallback".to_string(),
            "implementation_changed" => "implementation".to_string(),
            "safe_setup" => "setup".to_string(),
            "delegate_call" | "untrusted_delegate_call" | "trusted_delegate_call" => "delegate".to_string(),
            "gas_params" | "gas_token_attack" | "gas_token_attack_enhanced" | "high_safe_tx_gas" | "high_base_gas" | "zero_gas_with_token" | "custom_gas_token" | "custom_refund_receiver" => "gas".to_string(),
            "large_value_transfer" => "value".to_string(),
            "execution_failure" => "execution".to_string(),
            "unverified_contract" => "contract".to_string(),
            _ => "other".to_string(),
        }
    }
    
    fn derive_title(output_type: &str) -> String {
        match output_type {
            "owner_added" => "Owner Added".to_string(),
            "owner_removed" => "Owner Removed".to_string(),
            "owner_swapped" => "Owner Swapped".to_string(),
            "owner_added_with_threshold" => "Owner Added with Threshold Change".to_string(),
            "threshold_changed" => "Threshold Changed".to_string(),
            "module_enabled" => "Module Enabled".to_string(),
            "module_disabled" => "Module Disabled".to_string(),
            "guard_changed" => "Guard Changed".to_string(),
            "fallback_handler_changed" => "Fallback Handler Changed".to_string(),
            "implementation_changed" => "Implementation Changed".to_string(),
            "safe_setup" => "Safe Setup".to_string(),
            "delegate_call" => "Delegate Call".to_string(),
            "untrusted_delegate_call" => "Untrusted Delegate Call".to_string(),
            "trusted_delegate_call" => "Trusted Delegate Call".to_string(),
            "gas_params" => "Non-Zero Gas Parameters".to_string(),
            "gas_token_attack" => "Gas Token Attack".to_string(),
            "gas_token_attack_enhanced" => "Enhanced Gas Token Attack".to_string(),
            "high_safe_tx_gas" => "High Safe Tx Gas".to_string(),
            "high_base_gas" => "High Base Gas".to_string(),
            "zero_gas_with_token" => "Zero Gas with Token".to_string(),
            "custom_gas_token" => "Custom Gas Token".to_string(),
            "custom_refund_receiver" => "Custom Refund Receiver".to_string(),
            "large_value_transfer" => "Large Value Transfer".to_string(),
            "execution_failure" => "Execution Failure".to_string(),
            "unverified_contract" => "Unverified Contract".to_string(),
            _ => output_type.replace('_', " ").to_string(),
        }
    }
    
    fn transaction_to_context(&self, transaction: &SafeTransaction, safe_address: &str) -> TransactionContext {
        let data_decoded = transaction.data_decoded.as_ref().map(|dd| {
            DataDecodedContext {
                method: dd.method.clone(),
                parameters: dd.parameters.as_ref().map(|params| {
                    params.iter().map(|p| ParameterContext {
                        name: p.name.clone(),
                        param_type: p.r#type.clone(),
                        value: p.value.clone(),
                    }).collect()
                }),
            }
        });
        
        TransactionContext {
            to: transaction.to.clone(),
            value: transaction.value.clone(),
            data: transaction.data.clone(),
            data_decoded,
            operation: transaction.operation,
            safe_tx_gas: transaction.safe_tx_gas.clone(),
            base_gas: transaction.base_gas.clone(),
            gas_price: transaction.gas_price.clone(),
            gas_token: transaction.gas_token.clone(),
            refund_receiver: transaction.refund_receiver.clone(),
            nonce: transaction.nonce,
            safe_tx_hash: transaction.safe_tx_hash.clone(),
            trusted: transaction.trusted,
            safe_address: Some(safe_address.to_string()),
            chain_id: None,
            safe_version: None,
        }
    }

    pub fn generate_summary(&self, analysis: &AnalysisResponse) -> String {
        if analysis.warnings.is_empty() {
            return "No security concerns detected.".to_string();
        }

        format!(
            "Security analysis found {} potential concern(s): {}. Risk level: {}.",
            analysis.warnings.len(),
            analysis.warnings.join(", "),
            analysis.risk_level.to_string().to_uppercase()
        )
    }
}

pub struct AnalysisOptions {
    pub chain_id: Option<u64>,
    pub safe_version: Option<String>,
    pub previous_nonce: Option<u64>,
}

impl Default for AnalysisOptions {
    fn default() -> Self {
        Self {
            chain_id: None,
            safe_version: None,
            previous_nonce: None,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_transaction() -> SafeTransaction {
        SafeTransaction {
            to: "0x1234567890123456789012345678901234567890".to_string(),
            value: Some("0".to_string()),
            data: None,
            data_decoded: None,
            operation: Some(0),
            gas_token: None,
            safe_tx_gas: None,
            base_gas: None,
            gas_price: None,
            refund_receiver: None,
            nonce: Some(0),
            safe_tx_hash: None,
            trusted: None,
        }
    }

    #[test]
    fn test_trusted_delegate_call_detection() {
        let service = SecurityAnalysisService::new();
        let mut transaction = create_test_transaction();
        transaction.operation = Some(1);
        transaction.to = "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D".to_string();

        let analysis = service.analyze_transaction(&transaction, "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", AnalysisOptions::default());

        assert_eq!(analysis.risk_level, RiskLevel::Low);
        assert!(!analysis.is_suspicious);
        assert!(analysis.call_type.as_ref().unwrap().is_trusted_delegate);
    }

    #[test]
    fn test_untrusted_delegate_call_detection() {
        let service = SecurityAnalysisService::new();
        let mut transaction = create_test_transaction();
        transaction.operation = Some(1);
        transaction.to = "0x9999999999999999999999999999999999999999".to_string();

        let analysis = service.analyze_transaction(&transaction, "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", AnalysisOptions::default());

        assert_eq!(analysis.risk_level, RiskLevel::Critical);
        assert!(analysis.is_suspicious);
        assert!(analysis.warnings.contains(&"Untrusted Delegate Call".to_string()));
        assert!(!analysis.call_type.as_ref().unwrap().is_trusted_delegate);
    }

    #[test]
    fn test_gas_token_attack_detection() {
        let service = SecurityAnalysisService::new();
        let mut transaction = create_test_transaction();
        transaction.gas_token = Some("0x1111111111111111111111111111111111111111".to_string());
        transaction.refund_receiver = Some("0x2222222222222222222222222222222222222222".to_string());
        transaction.gas_price = Some("1000000000".to_string());

        let analysis = service.analyze_transaction(&transaction, "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", AnalysisOptions::default());

        assert!(analysis.is_suspicious);
        assert!(analysis.warnings.contains(&"Gas Token Attack Risk".to_string()));
        assert!(analysis.warnings.contains(&"Non-Zero Gas Parameters".to_string()));
    }

    #[test]
    fn test_owner_added_detection() {
        let service = SecurityAnalysisService::new();
        let mut transaction = create_test_transaction();
        transaction.data_decoded = Some(DataDecoded {
            method: "addOwner".to_string(),
            parameters: Some(vec![Parameter {
                name: "owner".to_string(),
                r#type: "address".to_string(),
                value: serde_json::json!("0x3333333333333333333333333333333333333333"),
            }]),
        });

        let analysis = service.analyze_transaction(&transaction, "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0", AnalysisOptions::default());

        assert_eq!(analysis.risk_level, RiskLevel::Critical);
        assert!(analysis.is_suspicious);
        assert!(analysis.warnings.contains(&"Owner Added".to_string()));
        assert_eq!(analysis.priority, Some("P0".to_string()));
    }
}
