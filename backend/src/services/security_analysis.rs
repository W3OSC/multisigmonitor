use crate::models::security_analysis::*;
use std::collections::HashMap;

const ZERO_ADDRESS: &str = "0x0000000000000000000000000000000000000000";

lazy_static::lazy_static! {
    static ref TRUSTED_DELEGATE_CALL_ADDRESSES: HashMap<&'static str, &'static str> = {
        let mut m = HashMap::new();
        m.insert("0x40A2aCCbd92BCA938b02010E17A5b8929b49130D", "MultiSendCallOnly v1.3.0 (canonical)");
        m.insert("0xA1dabEF33b3B82c7814B6D82A79e50F4AC44102B", "MultiSendCallOnly v1.3.0 (eip155)");
        m.insert("0xf220D3b4DFb23C4ade8C88E526C1353AbAcbC38F", "MultiSendCallOnly v1.3.0 (zksync)");
        m.insert("0x9641d764fc13c8B624c04430C7356C1C7C8102e2", "MultiSendCallOnly v1.4.1 (canonical)");
        m.insert("0x0408EF011960d02349d50286D20531229BCef773", "MultiSendCallOnly v1.4.1 (zksync)");
        m.insert("0x526643F69b81B008F46d95CD5ced5eC0edFFDaC6", "SafeMigration v1.4.1 (canonical)");
        m.insert("0x817756C6c555A94BCEE39eB5a102AbC1678b09A7", "SafeMigration v1.4.1 (zksync)");
        m.insert("0xA65387F16B013cf2Af4605Ad8aA5ec25a2cbA3a2", "SignMessageLib v1.3.0 (canonical)");
        m.insert("0x98FFBBF51bb33A056B08ddf711f289936AafF717", "SignMessageLib v1.3.0 (eip155)");
        m.insert("0x357147caf9C0cCa67DfA0CF5369318d8193c8407", "SignMessageLib v1.3.0 (zksync)");
        m.insert("0xd53cd0aB83D845Ac265BE939c57F53AD838012c9", "SignMessageLib v1.4.1 (canonical)");
        m.insert("0xAca1ec0a1A575CDCCF1DC3d5d296202Eb6061888", "SignMessageLib v1.4.1 (zksync)");
        m
    };
}

pub struct SecurityAnalysisService;

impl SecurityAnalysisService {
    pub fn new() -> Self {
        Self
    }

    pub fn analyze_transaction(
        &self,
        transaction: &SafeTransaction,
        _safe_address: &str,
        _options: AnalysisOptions,
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

        self.check_gas_token_attack(transaction, &mut analysis);
        self.check_delegate_call(transaction, &mut analysis);
        self.check_large_value_transfer(transaction, &mut analysis);
        self.check_owner_management(transaction, &mut analysis);
        self.check_unusual_gas_settings(transaction, &mut analysis);
        self.check_external_contracts(transaction, &mut analysis);
        
        self.calculate_risk_level(&mut analysis);

        analysis
    }

    fn check_gas_token_attack(&self, transaction: &SafeTransaction, analysis: &mut AnalysisResponse) {
        let gas_price = transaction.gas_price.as_deref().unwrap_or("0");
        let gas_token = transaction.gas_token.as_deref().unwrap_or(ZERO_ADDRESS);
        let refund_receiver = transaction.refund_receiver.as_deref().unwrap_or(ZERO_ADDRESS);
        let safe_tx_gas = transaction.safe_tx_gas.as_deref().unwrap_or("0");
        let base_gas = transaction.base_gas.as_deref().unwrap_or("0");

        let has_non_zero_gas_params = gas_price != "0" 
            || gas_token != ZERO_ADDRESS 
            || refund_receiver != ZERO_ADDRESS
            || safe_tx_gas != "0"
            || base_gas != "0";

        if has_non_zero_gas_params {
            analysis.warnings.push("Non-Zero Gas Parameters".to_string());
            analysis.details.push(AnalysisDetail {
                r#type: "non_zero_gas_params".to_string(),
                severity: "high".to_string(),
                message: "Transaction has non-zero gas parameters. This could indicate gas manipulation or refund attacks.".to_string(),
                priority: Some("P1".to_string()),
                extra: serde_json::json!({
                    "safeTxGas": safe_tx_gas,
                    "baseGas": base_gas,
                    "gasPrice": gas_price,
                    "gasToken": gas_token,
                    "refundReceiver": refund_receiver
                }),
            });
        }

        if gas_token != ZERO_ADDRESS && refund_receiver != ZERO_ADDRESS {
            analysis.warnings.push("Gas Token Attack Risk".to_string());
            analysis.details.push(AnalysisDetail {
                r#type: "gas_token_attack".to_string(),
                severity: "high".to_string(),
                message: "Transaction uses both a custom gas token and custom refund receiver. This combination can hide fund rerouting through gas refunds.".to_string(),
                priority: None,
                extra: serde_json::json!({
                    "gasToken": gas_token,
                    "refundReceiver": refund_receiver,
                    "gasPrice": gas_price
                }),
            });

            if gas_price != "0" {
                analysis.details.push(AnalysisDetail {
                    r#type: "gas_token_attack_enhanced".to_string(),
                    severity: "critical".to_string(),
                    message: "Non-zero gas price increases potential for hidden value transfers through gas refunds.".to_string(),
                    priority: None,
                    extra: serde_json::json!({
                        "gasPrice": gas_price
                    }),
                });
            }
        } else if gas_token != ZERO_ADDRESS {
            analysis.warnings.push("Custom Gas Token".to_string());
            analysis.details.push(AnalysisDetail {
                r#type: "custom_gas_token".to_string(),
                severity: "medium".to_string(),
                message: "Transaction uses a custom gas token. Verify this is intended.".to_string(),
                priority: None,
                extra: serde_json::json!({
                    "gasToken": gas_token
                }),
            });
        } else if refund_receiver != ZERO_ADDRESS {
            analysis.warnings.push("Custom Refund Receiver".to_string());
            analysis.details.push(AnalysisDetail {
                r#type: "custom_refund_receiver".to_string(),
                severity: "medium".to_string(),
                message: "Transaction uses a custom refund receiver. Verify this is intended.".to_string(),
                priority: None,
                extra: serde_json::json!({
                    "refundReceiver": refund_receiver
                }),
            });
        }
    }

    fn check_delegate_call(&self, transaction: &SafeTransaction, analysis: &mut AnalysisResponse) {
        let operation = transaction.operation.unwrap_or(0);
        let to_address = &transaction.to;

        if operation == 1 {
            let trusted_address = TRUSTED_DELEGATE_CALL_ADDRESSES.get(to_address.as_str());

            if let Some(&trusted_name) = trusted_address {
                analysis.details.push(AnalysisDetail {
                    r#type: "trusted_delegate_call".to_string(),
                    severity: "low".to_string(),
                    message: format!("Transaction includes a delegate call to trusted address: {}", trusted_name),
                    priority: None,
                    extra: serde_json::json!({
                        "toAddress": to_address,
                        "trustedName": trusted_name
                    }),
                });
            } else {
                analysis.warnings.push("Untrusted Delegate Call".to_string());
                analysis.details.push(AnalysisDetail {
                    r#type: "untrusted_delegate_call".to_string(),
                    severity: "critical".to_string(),
                    message: format!("CRITICAL: Transaction includes an untrusted delegate call to address {}. This may lead to unexpected behavior or complete Safe compromise.", to_address),
                    priority: Some("P0".to_string()),
                    extra: serde_json::json!({
                        "toAddress": to_address,
                        "operation": operation
                    }),
                });
            }
        }

        analysis.call_type = Some(CallType {
            is_call: operation == 0,
            is_delegate_call: operation == 1,
            is_trusted_delegate: operation == 1 && TRUSTED_DELEGATE_CALL_ADDRESSES.contains_key(to_address.as_str()),
            contract_address: to_address.clone(),
            contract_name: TRUSTED_DELEGATE_CALL_ADDRESSES.get(to_address.as_str()).map(|s| s.to_string()),
        });
    }

    fn check_large_value_transfer(&self, transaction: &SafeTransaction, analysis: &mut AnalysisResponse) {
        if let Some(value) = &transaction.value {
            if let Ok(value_u128) = value.parse::<u128>() {
                let value_in_eth = value_u128 as f64 / 1e18;
                
                if value_in_eth > 5000.0 {
                    analysis.warnings.push("Large Value Transfer".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "large_value_transfer".to_string(),
                        severity: "high".to_string(),
                        message: format!("Transaction transfers {:.4} ETH, which is above the threshold for review.", value_in_eth),
                        priority: None,
                        extra: serde_json::json!({
                            "valueEth": value_in_eth,
                            "valueWei": value
                        }),
                    });
                }
            }
        }
    }

    fn check_owner_management(&self, transaction: &SafeTransaction, analysis: &mut AnalysisResponse) {
        if let Some(data_decoded) = &transaction.data_decoded {
            let method = &data_decoded.method;
            let parameters = &data_decoded.parameters;

            match method.as_str() {
                "addOwner" | "AddedOwner" => {
                    analysis.warnings.push("Owner Added".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "owner_added".to_string(),
                        severity: "critical".to_string(),
                        message: "CRITICAL: New owner added to Safe. Verify this action is authorized.".to_string(),
                        priority: Some("P0".to_string()),
                        extra: serde_json::json!({
                            "method": method,
                            "parameters": parameters
                        }),
                    });
                }
                "removeOwner" | "RemovedOwner" => {
                    analysis.warnings.push("Owner Removed".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "owner_removed".to_string(),
                        severity: "critical".to_string(),
                        message: "CRITICAL: Owner removed from Safe. This affects Safe control.".to_string(),
                        priority: Some("P0".to_string()),
                        extra: serde_json::json!({
                            "method": method,
                            "parameters": parameters
                        }),
                    });
                }
                "swapOwner" => {
                    analysis.warnings.push("Owner Replaced".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "owner_swapped".to_string(),
                        severity: "critical".to_string(),
                        message: "CRITICAL: Safe owner replaced. Verify the new owner address.".to_string(),
                        priority: Some("P0".to_string()),
                        extra: serde_json::json!({
                            "method": method,
                            "parameters": parameters
                        }),
                    });
                }
                "addOwnerWithThreshold" => {
                    analysis.warnings.push("Owner Added with Threshold Change".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "owner_added_with_threshold".to_string(),
                        severity: "critical".to_string(),
                        message: "CRITICAL: New owner added and threshold changed. Double verification required.".to_string(),
                        priority: Some("P0".to_string()),
                        extra: serde_json::json!({
                            "method": method,
                            "parameters": parameters
                        }),
                    });
                }
                "changeThreshold" | "ChangedThreshold" => {
                    let new_threshold = parameters.as_ref().and_then(|params| {
                        params.iter().find(|p| p.name == "_threshold" || p.name == "threshold")
                            .map(|p| &p.value)
                    });
                    
                    analysis.warnings.push("Threshold Changed".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "threshold_changed".to_string(),
                        severity: "critical".to_string(),
                        message: format!("CRITICAL: Signature threshold changed to {:?}. This affects Safe security.", new_threshold),
                        priority: Some("P0".to_string()),
                        extra: serde_json::json!({
                            "method": method,
                            "newThreshold": new_threshold,
                            "parameters": parameters
                        }),
                    });
                }
                "enableModule" | "EnabledModule" => {
                    analysis.warnings.push("Module Enabled".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "module_enabled".to_string(),
                        severity: "critical".to_string(),
                        message: "CRITICAL: New module enabled. Modules can execute transactions without signatures.".to_string(),
                        priority: Some("P0".to_string()),
                        extra: serde_json::json!({
                            "method": method,
                            "parameters": parameters
                        }),
                    });
                }
                "disableModule" | "DisabledModule" => {
                    analysis.warnings.push("Module Disabled".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "module_disabled".to_string(),
                        severity: "critical".to_string(),
                        message: "CRITICAL: Module disabled. Verify this doesn't break existing automations.".to_string(),
                        priority: Some("P0".to_string()),
                        extra: serde_json::json!({
                            "method": method,
                            "parameters": parameters
                        }),
                    });
                }
                "setGuard" | "ChangedGuard" => {
                    analysis.warnings.push("Guard Changed".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "guard_changed".to_string(),
                        severity: "critical".to_string(),
                        message: "CRITICAL: Transaction guard changed. Guards can block all transactions.".to_string(),
                        priority: Some("P0".to_string()),
                        extra: serde_json::json!({
                            "method": method,
                            "parameters": parameters
                        }),
                    });
                }
                "setFallbackHandler" | "ChangedFallbackHandler" => {
                    analysis.warnings.push("Fallback Handler Changed".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "fallback_handler_changed".to_string(),
                        severity: "critical".to_string(),
                        message: "CRITICAL: Fallback handler changed. This affects how Safe handles unknown calls.".to_string(),
                        priority: Some("P0".to_string()),
                        extra: serde_json::json!({
                            "method": method,
                            "parameters": parameters
                        }),
                    });
                }
                "changeMasterCopy" | "ChangedMasterCopy" => {
                    analysis.warnings.push("Implementation Changed".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "implementation_changed".to_string(),
                        severity: "critical".to_string(),
                        message: "CRITICAL: Safe implementation upgraded/changed. Verify the new implementation.".to_string(),
                        priority: Some("P0".to_string()),
                        extra: serde_json::json!({
                            "method": method,
                            "parameters": parameters
                        }),
                    });
                }
                "setup" => {
                    analysis.warnings.push("Safe Setup Changed".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "safe_setup".to_string(),
                        severity: "critical".to_string(),
                        message: "CRITICAL: Safe setup modified. This is a fundamental configuration change.".to_string(),
                        priority: Some("P0".to_string()),
                        extra: serde_json::json!({
                            "method": method,
                            "parameters": parameters
                        }),
                    });
                }
                "ExecutionFailure" => {
                    analysis.warnings.push("Execution Failed".to_string());
                    analysis.details.push(AnalysisDetail {
                        r#type: "execution_failure".to_string(),
                        severity: "medium".to_string(),
                        message: "Transaction execution failed. Review the failure reason.".to_string(),
                        priority: None,
                        extra: serde_json::json!({
                            "method": method,
                            "parameters": parameters
                        }),
                    });
                }
                _ => {}
            }
        }
    }

    fn check_unusual_gas_settings(&self, transaction: &SafeTransaction, analysis: &mut AnalysisResponse) {
        let safe_tx_gas = transaction.safe_tx_gas.as_ref()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        
        let base_gas = transaction.base_gas.as_ref()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);
        
        let gas_price = transaction.gas_price.as_ref()
            .and_then(|s| s.parse::<u64>().ok())
            .unwrap_or(0);

        if safe_tx_gas > 1_000_000 {
            analysis.details.push(AnalysisDetail {
                r#type: "high_safe_tx_gas".to_string(),
                severity: "medium".to_string(),
                message: format!("Transaction has unusually high safeTxGas: {}", safe_tx_gas),
                priority: None,
                extra: serde_json::json!({
                    "safeTxGas": safe_tx_gas
                }),
            });
        }

        if base_gas > 1_000_000 {
            analysis.details.push(AnalysisDetail {
                r#type: "high_base_gas".to_string(),
                severity: "medium".to_string(),
                message: format!("Transaction has unusually high baseGas: {}", base_gas),
                priority: None,
                extra: serde_json::json!({
                    "baseGas": base_gas
                }),
            });
        }

        if gas_price == 0 && transaction.gas_token.as_deref().unwrap_or(ZERO_ADDRESS) != ZERO_ADDRESS {
            analysis.warnings.push("Zero Gas Price with Token".to_string());
            analysis.details.push(AnalysisDetail {
                r#type: "zero_gas_with_token".to_string(),
                severity: "medium".to_string(),
                message: "Transaction uses zero gas price with a gas token. This could indicate gas manipulation.".to_string(),
                priority: None,
                extra: serde_json::json!({
                    "gasPrice": gas_price,
                    "gasToken": transaction.gas_token
                }),
            });
        }
    }

    fn check_external_contracts(&self, transaction: &SafeTransaction, analysis: &mut AnalysisResponse) {
        let to_address = &transaction.to;
        
        if let Some(data) = &transaction.data {
            if !data.is_empty() && data != "0x" {
                if let Some(data_decoded) = &transaction.data_decoded {
                    analysis.details.push(AnalysisDetail {
                        r#type: "contract_interaction".to_string(),
                        severity: "low".to_string(),
                        message: format!("Transaction interacts with contract at {}", to_address),
                        priority: None,
                        extra: serde_json::json!({
                            "toAddress": to_address,
                            "method": data_decoded.method
                        }),
                    });

                    if transaction.trusted != Some(true) {
                        analysis.warnings.push("Unverified Contract Interaction".to_string());
                        analysis.details.push(AnalysisDetail {
                            r#type: "unverified_contract".to_string(),
                            severity: "medium".to_string(),
                            message: "Transaction interacts with an unverified or untrusted contract.".to_string(),
                            priority: None,
                            extra: serde_json::json!({
                                "toAddress": to_address
                            }),
                        });
                    }
                }
            }
        }
    }

    fn calculate_risk_level(&self, analysis: &mut AnalysisResponse) {
        let mut severity_counts = HashMap::new();
        let mut has_p0_priority = false;

        for detail in &analysis.details {
            *severity_counts.entry(detail.severity.as_str()).or_insert(0) += 1;
            
            if let Some(priority) = &detail.priority {
                if priority == "P0" {
                    has_p0_priority = true;
                }
            }
        }

        let critical = *severity_counts.get("critical").unwrap_or(&0);
        let high = *severity_counts.get("high").unwrap_or(&0);
        let medium = *severity_counts.get("medium").unwrap_or(&0);

        if critical > 0 || has_p0_priority {
            analysis.risk_level = RiskLevel::Critical;
            analysis.is_suspicious = true;
            analysis.priority = Some("P0".to_string());
        } else if high > 0 {
            analysis.risk_level = RiskLevel::High;
            analysis.is_suspicious = true;
        } else if medium > 1 {
            analysis.risk_level = RiskLevel::Medium;
            analysis.is_suspicious = true;
        } else if medium > 0 {
            analysis.risk_level = RiskLevel::Medium;
        } else {
            analysis.risk_level = RiskLevel::Low;
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

    #[test]
    fn test_risk_level_calculation() {
        let service = SecurityAnalysisService::new();
        let mut analysis = AnalysisResponse {
            is_suspicious: false,
            risk_level: RiskLevel::Low,
            warnings: Vec::new(),
            details: vec![
                AnalysisDetail {
                    r#type: "test_critical".to_string(),
                    severity: "critical".to_string(),
                    message: "Test".to_string(),
                    priority: Some("P0".to_string()),
                    extra: serde_json::json!({}),
                },
            ],
            call_type: None,
            hash_verification: None,
            nonce_check: None,
            calldata: None,
            priority: None,
        };

        service.calculate_risk_level(&mut analysis);

        assert_eq!(analysis.risk_level, RiskLevel::Critical);
        assert!(analysis.is_suspicious);
        assert_eq!(analysis.priority, Some("P0".to_string()));
    }
}

#[cfg(test)]
#[path = "security_analysis_tests.rs"]
mod analysis_tests;


