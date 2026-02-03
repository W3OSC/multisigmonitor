use super::{BuiltinCheck, BuiltinContext, BuiltinResult};
use std::collections::HashMap;

pub struct SecurityScoreBuiltin;

impl BuiltinCheck for SecurityScoreBuiltin {
    fn name(&self) -> &'static str {
        "calculate-security-score"
    }

    fn execute(&self, context: &BuiltinContext) -> BuiltinResult {
        let mut severity_counts: HashMap<&str, usize> = HashMap::new();
        let mut has_p0_priority = false;

        for detail in &context.analysis_details {
            *severity_counts.entry(detail.severity.as_str()).or_insert(0) += 1;
            
            if let Some(ref priority) = detail.priority {
                if priority == "P0" {
                    has_p0_priority = true;
                }
            }
        }

        let critical = *severity_counts.get("critical").unwrap_or(&0);
        let high = *severity_counts.get("high").unwrap_or(&0);
        let medium = *severity_counts.get("medium").unwrap_or(&0);

        let (risk_level, is_suspicious, priority) = if critical > 0 || has_p0_priority {
            ("critical", true, Some("P0".to_string()))
        } else if high > 0 {
            ("high", true, None)
        } else if medium > 1 {
            ("medium", true, None)
        } else if medium > 0 {
            ("medium", false, None)
        } else {
            ("low", false, None)
        };

        let extra = serde_json::json!({
            "risk_level": risk_level,
            "is_suspicious": is_suspicious,
            "priority": priority,
            "severity_counts": {
                "critical": critical,
                "high": high,
                "medium": medium,
            }
        });

        BuiltinResult {
            success: true,
            output: Some(super::BuiltinOutput {
                output_type: "security_score".to_string(),
                severity: risk_level.to_string(),
                warning: None,
                message: format!("Risk level: {}, Suspicious: {}", risk_level, is_suspicious),
                priority,
                extra,
            }),
            error: None,
        }
    }
}

#[allow(dead_code)]
#[derive(Debug, Clone)]
pub struct RiskCalculation {
    pub risk_level: RiskLevel,
    pub is_suspicious: bool,
    pub priority: Option<String>,
}

#[allow(dead_code)]
#[derive(Debug, Clone, PartialEq)]
pub enum RiskLevel {
    Low,
    Medium,
    High,
    Critical,
}

#[allow(dead_code)]
impl RiskLevel {
    pub fn as_str(&self) -> &'static str {
        match self {
            RiskLevel::Low => "low",
            RiskLevel::Medium => "medium",
            RiskLevel::High => "high",
            RiskLevel::Critical => "critical",
        }
    }
}

#[allow(dead_code)]
impl SecurityScoreBuiltin {
    pub fn calculate_risk(details: &[super::AnalysisDetailInput]) -> RiskCalculation {
        let mut severity_counts: HashMap<&str, usize> = HashMap::new();
        let mut has_p0_priority = false;

        for detail in details {
            *severity_counts.entry(detail.severity.as_str()).or_insert(0) += 1;
            
            if let Some(ref priority) = detail.priority {
                if priority == "P0" {
                    has_p0_priority = true;
                }
            }
        }

        let critical = *severity_counts.get("critical").unwrap_or(&0);
        let high = *severity_counts.get("high").unwrap_or(&0);
        let medium = *severity_counts.get("medium").unwrap_or(&0);

        if critical > 0 || has_p0_priority {
            RiskCalculation {
                risk_level: RiskLevel::Critical,
                is_suspicious: true,
                priority: Some("P0".to_string()),
            }
        } else if high > 0 {
            RiskCalculation {
                risk_level: RiskLevel::High,
                is_suspicious: true,
                priority: None,
            }
        } else if medium > 1 {
            RiskCalculation {
                risk_level: RiskLevel::Medium,
                is_suspicious: true,
                priority: None,
            }
        } else if medium > 0 {
            RiskCalculation {
                risk_level: RiskLevel::Medium,
                is_suspicious: false,
                priority: None,
            }
        } else {
            RiskCalculation {
                risk_level: RiskLevel::Low,
                is_suspicious: false,
                priority: None,
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::template_engine::builtins::AnalysisDetailInput;

    #[test]
    fn test_critical_risk_calculation() {
        let details = vec![
            AnalysisDetailInput {
                severity: "critical".to_string(),
                priority: Some("P0".to_string()),
            },
        ];

        let result = SecurityScoreBuiltin::calculate_risk(&details);
        
        assert_eq!(result.risk_level, RiskLevel::Critical);
        assert!(result.is_suspicious);
        assert_eq!(result.priority, Some("P0".to_string()));
    }

    #[test]
    fn test_high_risk_calculation() {
        let details = vec![
            AnalysisDetailInput {
                severity: "high".to_string(),
                priority: None,
            },
        ];

        let result = SecurityScoreBuiltin::calculate_risk(&details);
        
        assert_eq!(result.risk_level, RiskLevel::High);
        assert!(result.is_suspicious);
    }

    #[test]
    fn test_low_risk_calculation() {
        let details = vec![
            AnalysisDetailInput {
                severity: "low".to_string(),
                priority: None,
            },
        ];

        let result = SecurityScoreBuiltin::calculate_risk(&details);
        
        assert_eq!(result.risk_level, RiskLevel::Low);
        assert!(!result.is_suspicious);
    }

    #[test]
    fn test_multiple_medium_makes_suspicious() {
        let details = vec![
            AnalysisDetailInput {
                severity: "medium".to_string(),
                priority: None,
            },
            AnalysisDetailInput {
                severity: "medium".to_string(),
                priority: None,
            },
        ];

        let result = SecurityScoreBuiltin::calculate_risk(&details);
        
        assert_eq!(result.risk_level, RiskLevel::Medium);
        assert!(result.is_suspicious);
    }
}
