use crate::template_engine::{
    AssessmentEngine, AssessmentContext, SafeInfoContext, CreationInfoContext,
    SanctionsContext, SanctionResultContext, MultisigInfoContext, CheckEvalResult,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::info;

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

use crate::template_engine::CheckSeverity;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub severity: CheckSeverity,
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

pub struct SafeAssessmentService {
    engine: AssessmentEngine,
}

impl SafeAssessmentService {
    pub fn new() -> Self {
        Self {
            engine: AssessmentEngine::new(),
        }
    }

    pub fn assess_safe(&self, request: SafeAssessmentRequest) -> SafeAssessmentResponse {
        let context = self.build_context(&request);
        
        let template_results = self.engine.evaluate(&context);
        
        info!(
            templates_evaluated = self.engine.template_count(),
            matches_found = template_results.len(),
            "Assessment template engine evaluation complete"
        );
        
        for result in &template_results {
            info!(
                check = %result.check_name,
                severity = %result.severity.as_str(),
                warnings = result.warnings.len(),
                "Assessment check evaluated"
            );
        }
        
        self.build_response(&request, template_results)
    }
    
    fn build_context(&self, request: &SafeAssessmentRequest) -> AssessmentContext {
        AssessmentContext {
            safe_address: request.safe_address.clone(),
            network: request.network.clone(),
            safe_info: SafeInfoContext {
                address: request.safe_info.address.clone(),
                nonce: request.safe_info.nonce,
                threshold: request.safe_info.threshold,
                owners: request.safe_info.owners.clone(),
                master_copy: request.safe_info.master_copy.clone(),
                modules: request.safe_info.modules.clone(),
                fallback_handler: request.safe_info.fallback_handler.clone(),
                guard: request.safe_info.guard.clone(),
                version: request.safe_info.version.clone(),
            },
            creation_info: request.creation_info.as_ref().map(|ci| CreationInfoContext {
                creator: ci.creator.clone(),
                transaction_hash: ci.transaction_hash.clone(),
                factory_address: ci.factory_address.clone(),
            }),
            sanctions_results: request.sanctions_results.as_ref().map(|sr| SanctionsContext {
                overall_sanctioned: sr.overall_sanctioned,
                sanctioned_addresses: sr.sanctioned_addresses.clone(),
                results: sr.results.iter().map(|(k, v)| {
                    (k.clone(), SanctionResultContext {
                        sanctioned: v.sanctioned,
                        data: v.data.clone(),
                    })
                }).collect(),
            }),
            multisig_info: request.multisig_info.as_ref().map(|mi| MultisigInfoContext {
                master_copy: mi.master_copy.clone(),
                initializer: mi.initializer.clone(),
                fallback_handler: mi.fallback_handler.clone(),
                creator: mi.creator.clone(),
                proxy: mi.proxy.clone(),
                proxy_factory: mi.proxy_factory.clone(),
                initiator: mi.initiator.clone(),
                owners: mi.owners.clone(),
                threshold: mi.threshold.clone(),
                guard: mi.guard.clone(),
                fallback_handler_runtime: mi.fallback_handler_runtime.clone(),
                modules: mi.modules.clone(),
                version: mi.version.clone(),
            }),
        }
    }
    
    fn build_response(&self, request: &SafeAssessmentRequest, results: Vec<CheckEvalResult>) -> SafeAssessmentResponse {
        let mut checks = AssessmentChecks {
            address_validation: CheckResult { severity: CheckSeverity::Pass, canonical_name: None, warnings: Vec::new() },
            factory_validation: CheckResult { severity: CheckSeverity::Pass, canonical_name: None, warnings: Vec::new() },
            mastercopy_validation: CheckResult { severity: CheckSeverity::Pass, canonical_name: None, warnings: Vec::new() },
            creation_transaction: CheckResult { severity: CheckSeverity::Pass, canonical_name: None, warnings: Vec::new() },
            safe_configuration: CheckResult { severity: CheckSeverity::Pass, canonical_name: None, warnings: Vec::new() },
            ownership_validation: CheckResult { severity: CheckSeverity::Pass, canonical_name: None, warnings: Vec::new() },
            module_validation: CheckResult { severity: CheckSeverity::Pass, canonical_name: None, warnings: Vec::new() },
            proxy_validation: CheckResult { severity: CheckSeverity::Pass, canonical_name: None, warnings: Vec::new() },
            initializer_validation: CheckResult { severity: CheckSeverity::Pass, canonical_name: None, warnings: Vec::new() },
            fallback_handler_validation: CheckResult { severity: CheckSeverity::Pass, canonical_name: None, warnings: Vec::new() },
            sanctions_validation: CheckResult { severity: CheckSeverity::Pass, canonical_name: None, warnings: Vec::new() },
            multisig_info_validation: CheckResult { severity: CheckSeverity::Pass, canonical_name: None, warnings: Vec::new() },
        };
        
        let mut risk_factors = Vec::new();
        let mut score_modifier: i32 = 0;
        
        for result in &results {
            let check = match result.check_name.as_str() {
                "address_validation" => &mut checks.address_validation,
                "factory_validation" => &mut checks.factory_validation,
                "mastercopy_validation" => &mut checks.mastercopy_validation,
                "ownership_validation" => &mut checks.ownership_validation,
                "module_validation" => &mut checks.module_validation,
                "initializer_validation" => &mut checks.initializer_validation,
                "fallback_handler_validation" => &mut checks.fallback_handler_validation,
                "sanctions_validation" => &mut checks.sanctions_validation,
                "multisig_info_validation" => &mut checks.multisig_info_validation,
                _ => continue,
            };
            
            check.severity = check.severity.merge(&result.severity);
            if result.canonical_name.is_some() {
                check.canonical_name = result.canonical_name.clone();
            }
            check.warnings.extend(result.warnings.clone());
            
            risk_factors.extend(result.risk_factors.clone());
            score_modifier += result.score_modifier;
        }
        
        self.populate_sanctions_canonical_name(request, &mut checks);
        
        let details = self.build_details(request);
        
        let (security_score, overall_risk) = self.calculate_security_score(&checks, score_modifier);
        
        SafeAssessmentResponse {
            safe_address: request.safe_address.clone(),
            network: request.network.clone(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            overall_risk,
            risk_factors,
            security_score,
            checks,
            details,
        }
    }
    
    fn populate_sanctions_canonical_name(&self, request: &SafeAssessmentRequest, checks: &mut AssessmentChecks) {
        if let Some(ref sanctions_results) = request.sanctions_results {
            if !sanctions_results.overall_sanctioned && checks.sanctions_validation.canonical_name.is_none() {
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
                
                checks.sanctions_validation.canonical_name = Some(clear_message);
            }
        } else {
            checks.sanctions_validation.warnings.push("Sanctions check not performed".to_string());
        }
    }
    
    fn build_details(&self, request: &SafeAssessmentRequest) -> AssessmentDetails {
        let mut details = AssessmentDetails {
            creator: request.creation_info.as_ref().map(|ci| ci.creator.clone()),
            factory: request.creation_info.as_ref().and_then(|ci| ci.factory_address.clone()),
            mastercopy: request.safe_info.master_copy.clone(),
            version: request.safe_info.version.clone(),
            owners: request.safe_info.owners.clone(),
            threshold: Some(request.safe_info.threshold),
            modules: request.safe_info.modules.clone().unwrap_or_default(),
            nonce: Some(request.safe_info.nonce),
            creation_tx: request.creation_info.as_ref().map(|ci| ci.transaction_hash.clone()),
            initializer: request.multisig_info.as_ref().and_then(|mi| mi.initializer.clone()),
            fallback_handler: request.safe_info.fallback_handler.clone(),
            guard: request.safe_info.guard.clone(),
            sanctions_data: Vec::new(),
            multisig_info_data: request.multisig_info.clone(),
        };
        
        if let Some(ref sanctions_results) = request.sanctions_results {
            for sanctioned_addr in &sanctions_results.sanctioned_addresses {
                if let Some(result) = sanctions_results.results.get(sanctioned_addr) {
                    if let Some(ref data) = result.data {
                        details.sanctions_data.extend(data.clone());
                    }
                }
            }
        }
        
        details
    }
    
    fn calculate_security_score(&self, checks: &AssessmentChecks, score_modifier: i32) -> (i32, String) {
        if checks.address_validation.severity == CheckSeverity::Critical {
            return (0, "critical".to_string());
        }
        
        if checks.sanctions_validation.severity == CheckSeverity::Critical {
            return (0, "critical".to_string());
        }
        
        let base_score = 70;
        let score = (base_score + score_modifier).max(0).min(100);
        
        let overall_risk = if score >= 85 {
            "low".to_string()
        } else if score >= 70 {
            "medium".to_string()
        } else if score >= 50 {
            "high".to_string()
        } else {
            "critical".to_string()
        };
        
        (score, overall_risk)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_request() -> SafeAssessmentRequest {
        SafeAssessmentRequest {
            safe_address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0".to_string(),
            network: "ethereum".to_string(),
            safe_info: SafeInfo {
                address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0".to_string(),
                nonce: 5,
                threshold: 2,
                owners: vec![
                    "0x1234567890123456789012345678901234567890".to_string(),
                    "0x0987654321098765432109876543210987654321".to_string(),
                ],
                master_copy: Some("0xd9Db270c1B5E3Bd161E8c8503c55cEABeE709552".to_string()),
                modules: None,
                fallback_handler: Some("0xf48f2B2d2a534e402487b3ee7C18c33Aec0Fe5e4".to_string()),
                guard: None,
                version: Some("1.3.0".to_string()),
            },
            creation_info: Some(CreationInfo {
                creator: "0xaaaa567890123456789012345678901234567890".to_string(),
                transaction_hash: "0xbbbb567890123456789012345678901234567890123456789012345678901234".to_string(),
                factory_address: Some("0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2".to_string()),
            }),
            sanctions_results: None,
            multisig_info: None,
        }
    }

    #[test]
    fn test_template_based_assessment() {
        let service = SafeAssessmentService::new();
        let request = create_test_request();
        
        let response = service.assess_safe(request);
        
        assert_eq!(response.checks.address_validation.severity, CheckSeverity::Pass);
        assert_eq!(response.checks.ownership_validation.severity, CheckSeverity::Pass);
        assert!(response.security_score > 0);
    }

    #[test]
    fn test_single_owner_warning() {
        let service = SafeAssessmentService::new();
        let mut request = create_test_request();
        request.safe_info.owners = vec!["0x1234567890123456789012345678901234567890".to_string()];
        request.safe_info.threshold = 1;
        
        let response = service.assess_safe(request);
        
        assert_eq!(response.checks.ownership_validation.severity, CheckSeverity::High);
        assert!(response.risk_factors.iter().any(|r| r.contains("Single owner")));
        assert_eq!(response.overall_risk, "medium");
    }

    #[test]
    fn test_invalid_threshold_detection() {
        let service = SafeAssessmentService::new();
        let mut request = create_test_request();
        request.safe_info.threshold = 0;
        
        let response = service.assess_safe(request);
        
        assert_eq!(response.checks.ownership_validation.severity, CheckSeverity::Critical);
        assert_eq!(response.overall_risk, "critical");
        assert_eq!(response.security_score, 0);
    }

    #[test]
    fn test_canonical_mastercopy_validation() {
        let service = SafeAssessmentService::new();
        let request = create_test_request();
        
        let response = service.assess_safe(request);
        
        assert_eq!(response.checks.mastercopy_validation.severity, CheckSeverity::Pass);
        assert!(response.checks.mastercopy_validation.canonical_name.is_some());
    }
}
