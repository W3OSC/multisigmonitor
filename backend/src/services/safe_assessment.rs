use crate::constants::SafeAddressRegistry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const ZERO_ADDRESS: &str = "0x0000000000000000000000000000000000000000";

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SafeAssessmentRequest {
    pub safe_address: String,
    pub network: String,
    pub safe_info: SafeInfo,
    pub creation_info: Option<CreationInfo>,
    pub sanctions_results: Option<SanctionsResults>,
    pub multisig_info: Option<MultisigInfo>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SafeInfo {
    pub address: String,
    pub nonce: u64,
    pub threshold: u32,
    pub owners: Vec<String>,
    pub master_copy: Option<String>,
    pub modules: Option<Vec<String>>,
    pub fallback_handler: Option<String>,
    pub guard: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct CreationInfo {
    pub creator: String,
    pub transaction_hash: String,
    pub factory_address: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SanctionsResults {
    pub overall_sanctioned: bool,
    pub sanctioned_addresses: Vec<String>,
    pub results: HashMap<String, SanctionResult>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SanctionResult {
    pub sanctioned: bool,
    pub data: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MultisigInfo {
    pub master_copy: Option<String>,
    pub initializer: Option<String>,
    pub fallback_handler: Option<String>,
    pub creator: Option<String>,
    pub proxy: Option<String>,
    pub proxy_factory: Option<String>,
    pub initiator: Option<String>,
    pub owners: Option<Vec<String>>,
    pub threshold: Option<String>,
    pub guard: Option<String>,
    pub fallback_handler_runtime: Option<String>,
    pub modules: Option<Vec<String>>,
    pub version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeAssessmentResponse {
    pub safe_address: String,
    pub network: String,
    pub timestamp: String,
    pub overall_risk: String,
    pub risk_factors: Vec<String>,
    pub security_score: i32,
    pub checks: AssessmentChecks,
    pub details: AssessmentDetails,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssessmentChecks {
    pub address_validation: CheckResult,
    pub factory_validation: CheckResult,
    pub mastercopy_validation: CheckResult,
    pub creation_transaction: CheckResult,
    pub safe_configuration: CheckResult,
    pub ownership_validation: CheckResult,
    pub module_validation: CheckResult,
    pub proxy_validation: CheckResult,
    pub initializer_validation: CheckResult,
    pub fallback_handler_validation: CheckResult,
    pub sanctions_validation: CheckResult,
    pub multisig_info_validation: CheckResult,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub is_valid: bool,
    pub canonical_name: Option<String>,
    pub warnings: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssessmentDetails {
    pub creator: Option<String>,
    pub factory: Option<String>,
    pub mastercopy: Option<String>,
    pub version: Option<String>,
    pub owners: Vec<String>,
    pub threshold: Option<u32>,
    pub modules: Vec<String>,
    pub nonce: Option<u64>,
    pub creation_tx: Option<String>,
    pub initializer: Option<String>,
    pub fallback_handler: Option<String>,
    pub guard: Option<String>,
    pub sanctions_data: Vec<serde_json::Value>,
    pub multisig_info_data: Option<MultisigInfo>,
}

pub struct SafeAssessmentService;

impl SafeAssessmentService {
    pub fn new() -> Self {
        Self
    }

    pub fn assess_safe(&self, request: SafeAssessmentRequest) -> SafeAssessmentResponse {
        let mut assessment = SafeAssessmentResponse {
            safe_address: request.safe_address.clone(),
            network: request.network.clone(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            overall_risk: "medium".to_string(),
            risk_factors: Vec::new(),
            security_score: 70,
            checks: AssessmentChecks {
                address_validation: CheckResult { is_valid: false, canonical_name: None, warnings: Vec::new() },
                factory_validation: CheckResult { is_valid: false, canonical_name: None, warnings: Vec::new() },
                mastercopy_validation: CheckResult { is_valid: false, canonical_name: None, warnings: Vec::new() },
                creation_transaction: CheckResult { is_valid: false, canonical_name: None, warnings: Vec::new() },
                safe_configuration: CheckResult { is_valid: false, canonical_name: None, warnings: Vec::new() },
                ownership_validation: CheckResult { is_valid: false, canonical_name: None, warnings: Vec::new() },
                module_validation: CheckResult { is_valid: false, canonical_name: None, warnings: Vec::new() },
                proxy_validation: CheckResult { is_valid: false, canonical_name: None, warnings: Vec::new() },
                initializer_validation: CheckResult { is_valid: false, canonical_name: None, warnings: Vec::new() },
                fallback_handler_validation: CheckResult { is_valid: false, canonical_name: None, warnings: Vec::new() },
                sanctions_validation: CheckResult { is_valid: false, canonical_name: None, warnings: Vec::new() },
                multisig_info_validation: CheckResult { is_valid: false, canonical_name: None, warnings: Vec::new() },
            },
            details: AssessmentDetails {
                creator: None,
                factory: None,
                mastercopy: None,
                version: None,
                owners: Vec::new(),
                threshold: None,
                modules: Vec::new(),
                nonce: None,
                creation_tx: None,
                initializer: None,
                fallback_handler: None,
                guard: None,
                sanctions_data: Vec::new(),
                multisig_info_data: None,
            },
        };

        self.validate_address(&request, &mut assessment);
        self.validate_factory(&request, &mut assessment);
        self.validate_mastercopy(&request, &mut assessment);
        self.validate_creation(&request, &mut assessment);
        self.validate_configuration(&request, &mut assessment);
        self.validate_ownership(&request, &mut assessment);
        self.validate_modules(&request, &mut assessment);
        self.validate_initializer(&request, &mut assessment);
        self.validate_fallback_handler(&request, &mut assessment);
        self.validate_sanctions(&request, &mut assessment);
        self.validate_multisig_info(&request, &mut assessment);
        self.calculate_security_score(&mut assessment);

        assessment
    }

    fn validate_address(&self, request: &SafeAssessmentRequest, assessment: &mut SafeAssessmentResponse) {
        let address_regex = regex::Regex::new(r"^0x[a-fA-F0-9]{40}$").unwrap();
        assessment.checks.address_validation.is_valid = address_regex.is_match(&request.safe_address);

        if !assessment.checks.address_validation.is_valid {
            assessment.risk_factors.push("Invalid address format".to_string());
            assessment.overall_risk = "critical".to_string();
            assessment.security_score = 0;
        }
    }

    fn validate_factory(&self, request: &SafeAssessmentRequest, assessment: &mut SafeAssessmentResponse) {
        if let Some(ref creation_info) = request.creation_info {
            if let Some(ref factory) = creation_info.factory_address {
                assessment.details.factory = Some(factory.clone());

                if let Some(name) = SafeAddressRegistry::is_canonical_factory(factory) {
                    assessment.checks.factory_validation.is_valid = true;
                    assessment.checks.factory_validation.canonical_name = Some(name.to_string());
                } else {
                    assessment.risk_factors.push("Non-canonical proxy factory detected".to_string());
                    assessment.checks.factory_validation.warnings.push("Unknown proxy factory implementation".to_string());
                }
            }

            assessment.details.creator = Some(creation_info.creator.clone());
            assessment.details.creation_tx = Some(creation_info.transaction_hash.clone());
            assessment.checks.creation_transaction.is_valid = true;
        } else {
            assessment.checks.creation_transaction.warnings.push("Creation transaction not available".to_string());
        }
    }

    fn validate_mastercopy(&self, request: &SafeAssessmentRequest, assessment: &mut SafeAssessmentResponse) {
        if let Some(ref master_copy) = request.safe_info.master_copy {
            assessment.details.mastercopy = Some(master_copy.clone());

            if let Some(name) = SafeAddressRegistry::is_canonical_mastercopy(master_copy) {
                assessment.checks.mastercopy_validation.is_valid = true;
                assessment.checks.mastercopy_validation.canonical_name = Some(name.to_string());
            } else {
                assessment.risk_factors.push("Non-canonical mastercopy detected".to_string());
                assessment.checks.mastercopy_validation.warnings.push("Unknown mastercopy implementation".to_string());
            }
        }
    }

    fn validate_creation(&self, _request: &SafeAssessmentRequest, _assessment: &mut SafeAssessmentResponse) {
    }

    fn validate_configuration(&self, request: &SafeAssessmentRequest, assessment: &mut SafeAssessmentResponse) {
        assessment.details.owners = request.safe_info.owners.clone();
        assessment.details.threshold = Some(request.safe_info.threshold);
        assessment.details.nonce = Some(request.safe_info.nonce);
        assessment.details.version = request.safe_info.version.clone();
        assessment.details.guard = request.safe_info.guard.clone();

        if let Some(ref modules) = request.safe_info.modules {
            assessment.details.modules = modules.clone();
        }

        assessment.checks.safe_configuration.is_valid = true;
    }

    fn validate_ownership(&self, request: &SafeAssessmentRequest, assessment: &mut SafeAssessmentResponse) {
        let owner_count = request.safe_info.owners.len() as u32;
        let threshold = request.safe_info.threshold;

        if owner_count == 0 {
            assessment.risk_factors.push("CRITICAL: Safe has no owners".to_string());
            assessment.checks.ownership_validation.warnings.push("No owners configured".to_string());
            assessment.overall_risk = "critical".to_string();
            return;
        }

        if threshold == 0 {
            assessment.risk_factors.push("CRITICAL: Threshold is zero".to_string());
            assessment.checks.ownership_validation.warnings.push("Invalid threshold configuration".to_string());
            assessment.overall_risk = "critical".to_string();
            return;
        }

        if threshold > owner_count {
            assessment.risk_factors.push("CRITICAL: Threshold exceeds owner count".to_string());
            assessment.checks.ownership_validation.warnings.push("Impossible threshold configuration".to_string());
            assessment.overall_risk = "critical".to_string();
            return;
        }

        if owner_count == 1 && threshold == 1 {
            assessment.risk_factors.push("Single owner configuration (1-of-1)".to_string());
            assessment.checks.ownership_validation.warnings.push("Not truly multi-signature".to_string());
        }

        assessment.checks.ownership_validation.is_valid = true;
    }

    fn validate_modules(&self, request: &SafeAssessmentRequest, assessment: &mut SafeAssessmentResponse) {
        if let Some(ref modules) = request.safe_info.modules {
            if !modules.is_empty() {
                assessment.risk_factors.push(format!("{} module(s) enabled - review carefully", modules.len()));
                assessment.checks.module_validation.warnings.push("Modules can execute without signatures".to_string());
            }
        }
        assessment.checks.module_validation.is_valid = true;
    }

    fn validate_initializer(&self, request: &SafeAssessmentRequest, assessment: &mut SafeAssessmentResponse) {
        if let Some(ref multisig_info) = request.multisig_info {
            if let Some(ref initializer) = multisig_info.initializer {
                assessment.details.initializer = Some(initializer.clone());

                if let Some(name) = SafeAddressRegistry::is_canonical_initializer(initializer) {
                    assessment.checks.initializer_validation.is_valid = true;
                    assessment.checks.initializer_validation.canonical_name = Some(name.to_string());
                } else {
                    assessment.risk_factors.push("HIGH RISK: Non-canonical initializer detected".to_string());
                    assessment.checks.initializer_validation.warnings.push("Unknown initializer - potential manipulation".to_string());
                }
            }
        }
    }

    fn validate_fallback_handler(&self, request: &SafeAssessmentRequest, assessment: &mut SafeAssessmentResponse) {
        if let Some(ref fallback_handler) = request.safe_info.fallback_handler {
            assessment.details.fallback_handler = Some(fallback_handler.clone());

            if fallback_handler == ZERO_ADDRESS {
                assessment.checks.fallback_handler_validation.is_valid = true;
                assessment.checks.fallback_handler_validation.canonical_name = Some("No Fallback Handler".to_string());
            } else if let Some(name) = SafeAddressRegistry::is_canonical_fallback_handler(fallback_handler) {
                assessment.checks.fallback_handler_validation.is_valid = true;
                assessment.checks.fallback_handler_validation.canonical_name = Some(name.to_string());
            } else {
                assessment.risk_factors.push("HIGH RISK: Non-canonical fallback handler detected".to_string());
                assessment.checks.fallback_handler_validation.warnings.push("Unknown fallback handler - potential security risk".to_string());
            }
        } else {
            assessment.checks.fallback_handler_validation.is_valid = true;
            assessment.checks.fallback_handler_validation.canonical_name = Some("No Fallback Handler".to_string());
        }
    }

    fn validate_sanctions(&self, request: &SafeAssessmentRequest, assessment: &mut SafeAssessmentResponse) {
        if let Some(ref sanctions_results) = request.sanctions_results {
            if sanctions_results.overall_sanctioned {
                assessment.risk_factors.push("CRITICAL RISK: Sanctioned addresses detected!".to_string());
                assessment.checks.sanctions_validation.is_valid = false;
                assessment.overall_risk = "critical".to_string();

                for sanctioned_addr in &sanctions_results.sanctioned_addresses {
                    if let Some(result) = sanctions_results.results.get(sanctioned_addr) {
                        if let Some(ref data) = result.data {
                            assessment.details.sanctions_data.extend(data.clone());
                        }
                    }
                }
            } else {
                assessment.checks.sanctions_validation.is_valid = true;
                let owner_count = request.safe_info.owners.len();
                let has_creator = request.creation_info.is_some();
                
                let mut clear_message = "All addresses clear from sanctions (Safe".to_string();
                if has_creator {
                    clear_message.push_str(", creator");
                }
                if owner_count > 0 {
                    clear_message.push_str(&format!(", {} owner{}", owner_count, if owner_count > 1 { "s" } else { "" }));
                }
                clear_message.push(')');
                
                assessment.checks.sanctions_validation.canonical_name = Some(clear_message);
            }
        } else {
            assessment.checks.sanctions_validation.warnings.push("Sanctions check not performed".to_string());
        }
    }

    fn validate_multisig_info(&self, request: &SafeAssessmentRequest, assessment: &mut SafeAssessmentResponse) {
        if let Some(ref multisig_info) = request.multisig_info {
            assessment.details.multisig_info_data = Some(multisig_info.clone());

            let mut has_discrepancies = false;

            if let (Some(ref api_mc), Some(ref chain_mc)) = (&request.safe_info.master_copy, &multisig_info.master_copy) {
                if api_mc.to_lowercase() != chain_mc.to_lowercase() {
                    has_discrepancies = true;
                    assessment.checks.multisig_info_validation.warnings.push(
                        format!("Mastercopy mismatch: API reports {}, blockchain reports {}", api_mc, chain_mc)
                    );
                }
            }

            if let (Some(ref creation_info), Some(ref chain_creator)) = (&request.creation_info, &multisig_info.creator) {
                if creation_info.creator.to_lowercase() != chain_creator.to_lowercase() {
                    has_discrepancies = true;
                    assessment.checks.multisig_info_validation.warnings.push(
                        format!("Creator mismatch: API reports {}, blockchain reports {}", creation_info.creator, chain_creator)
                    );
                }
            }

            if has_discrepancies {
                assessment.risk_factors.push("CRITICAL: Discrepancies between API and blockchain data".to_string());
                assessment.overall_risk = "critical".to_string();
            } else {
                assessment.checks.multisig_info_validation.is_valid = true;
            }
        }
    }

    fn calculate_security_score(&self, assessment: &mut SafeAssessmentResponse) {
        let mut score = 70;

        if !assessment.checks.address_validation.is_valid {
            score = 0;
            assessment.overall_risk = "critical".to_string();
            return;
        }

        if !assessment.checks.sanctions_validation.is_valid {
            score = 0;
            assessment.overall_risk = "critical".to_string();
            return;
        }

        if !assessment.checks.ownership_validation.is_valid || 
           assessment.checks.ownership_validation.warnings.iter().any(|w| w.contains("CRITICAL")) {
            score = 0;
            assessment.overall_risk = "critical".to_string();
            return;
        }

        if assessment.checks.factory_validation.is_valid {
            score += 5;
        } else {
            score -= 15;
        }

        if assessment.checks.mastercopy_validation.is_valid {
            score += 10;
        } else {
            score -= 20;
        }

        if assessment.checks.initializer_validation.is_valid {
            score += 5;
        } else {
            score -= 15;
        }

        if assessment.checks.fallback_handler_validation.is_valid {
            score += 5;
        } else {
            score -= 10;
        }

        if assessment.checks.multisig_info_validation.is_valid {
            score += 5;
        } else if !assessment.checks.multisig_info_validation.warnings.is_empty() {
            score = 0;
            assessment.overall_risk = "critical".to_string();
            return;
        }

        if !assessment.details.modules.is_empty() {
            score -= 5 * assessment.details.modules.len() as i32;
        }

        score = score.max(0).min(100);
        assessment.security_score = score;

        if assessment.overall_risk != "critical" {
            if score >= 85 {
                assessment.overall_risk = "low".to_string();
            } else if score >= 70 {
                assessment.overall_risk = "medium".to_string();
            } else if score >= 50 {
                assessment.overall_risk = "high".to_string();
            } else {
                assessment.overall_risk = "critical".to_string();
            }
        }
    }
}
