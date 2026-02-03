use super::schema::{
    AssessmentTemplate, AssessmentCondition, AssessmentResult, 
    FieldValidationType, NumericRule, CompareOperator, CheckSeverity
};
use super::loader::TemplateLoader;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

const ZERO_ADDRESS: &str = "0x0000000000000000000000000000000000000000";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssessmentContext {
    pub safe_address: String,
    pub network: String,
    pub safe_info: SafeInfoContext,
    pub creation_info: Option<CreationInfoContext>,
    pub sanctions_results: Option<SanctionsContext>,
    pub multisig_info: Option<MultisigInfoContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SafeInfoContext {
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

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreationInfoContext {
    pub creator: String,
    pub transaction_hash: String,
    pub factory_address: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SanctionsContext {
    pub overall_sanctioned: bool,
    pub sanctioned_addresses: Vec<String>,
    pub results: HashMap<String, SanctionResultContext>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SanctionResultContext {
    pub sanctioned: bool,
    pub data: Option<Vec<serde_json::Value>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MultisigInfoContext {
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

#[derive(Debug, Clone)]
pub struct CheckEvalResult {
    pub check_name: String,
    pub severity: CheckSeverity,
    pub canonical_name: Option<String>,
    pub warnings: Vec<String>,
    pub risk_factors: Vec<String>,
    pub score_modifier: i32,
}

pub struct AssessmentEngine {
    loader: TemplateLoader,
}

impl AssessmentEngine {
    pub fn new() -> Self {
        Self {
            loader: TemplateLoader::default(),
        }
    }

    pub fn with_loader(loader: TemplateLoader) -> Self {
        Self { loader }
    }

    pub fn template_count(&self) -> usize {
        self.loader.assessment_templates().len()
    }

    pub fn evaluate(&self, context: &AssessmentContext) -> Vec<CheckEvalResult> {
        let context_value = serde_json::to_value(context).unwrap_or_default();
        let mut results = Vec::new();

        for template in self.loader.assessment_templates() {
            let result = self.evaluate_template(template, &context_value);
            results.push(result);
        }

        results
    }

    fn evaluate_template(&self, template: &AssessmentTemplate, context: &serde_json::Value) -> CheckEvalResult {
        let mut result = CheckEvalResult {
            check_name: template.check_name.clone(),
            severity: CheckSeverity::Pass,
            canonical_name: None,
            warnings: Vec::new(),
            risk_factors: Vec::new(),
            score_modifier: 0,
        };

        for condition in &template.conditions {
            self.evaluate_condition(condition, context, &mut result);
        }

        result
    }

    fn evaluate_condition(&self, condition: &AssessmentCondition, context: &serde_json::Value, result: &mut CheckEvalResult) {
        match condition {
            AssessmentCondition::WhitelistLookup { field, whitelist, on_match, on_no_match } => {
                let field_value = self.get_field_value(context, field);
                if let Some(address) = field_value.as_str() {
                    let normalized_address = address.to_lowercase();
                    if address == ZERO_ADDRESS {
                        if let Some(name) = whitelist.get(ZERO_ADDRESS) {
                            self.apply_result(on_match, result, Some(name));
                        } else {
                            self.apply_result(on_match, result, Some("No Handler Set"));
                        }
                    } else if let Some(name) = whitelist.get(&normalized_address) {
                        self.apply_result(on_match, result, Some(name));
                    } else {
                        self.apply_result(on_no_match, result, None);
                    }
                }
            }
            AssessmentCondition::FieldValidation { field, validation, on_valid, on_invalid } => {
                let field_value = self.get_field_value(context, field);
                let is_valid = self.validate_field(&field_value, validation);
                if is_valid {
                    self.apply_result(on_valid, result, None);
                } else {
                    self.apply_result(on_invalid, result, None);
                }
            }
            AssessmentCondition::NumericValidation { field, rules } => {
                let field_value = self.get_field_value(context, field);
                for rule in rules {
                    if self.evaluate_numeric_rule(&field_value, rule, context) {
                        self.apply_result(&rule.result, result, None);
                    }
                }
            }
            AssessmentCondition::ExternalDataCheck { data_field, flag_field, on_flagged, on_clear } => {
                let data_value = self.get_field_value(context, data_field);
                if !data_value.is_null() {
                    let flag_value = self.get_field_value(&data_value, flag_field);
                    if flag_value.as_bool().unwrap_or(false) {
                        self.apply_result(on_flagged, result, None);
                    } else {
                        self.apply_result(on_clear, result, None);
                    }
                }
            }
            AssessmentCondition::CrossFieldComparison { field_a, field_b, comparison, on_match, on_mismatch } => {
                let value_a = self.get_field_value(context, field_a);
                let value_b = self.get_field_value(context, field_b);
                
                if value_a.is_null() || value_b.is_null() {
                    return;
                }
                
                let matches = self.compare_values(&value_a, &value_b, comparison);
                if matches {
                    self.apply_result(on_match, result, None);
                } else {
                    self.apply_result(on_mismatch, result, None);
                }
            }
        }
    }

    fn apply_result(&self, assessment: &AssessmentResult, result: &mut CheckEvalResult, whitelist_name: Option<&str>) {
        result.severity = result.severity.merge(&assessment.severity);
        
        if let Some(ref name) = assessment.canonical_name {
            let resolved = whitelist_name
                .map(|n| name.replace("{{whitelist_name}}", n))
                .unwrap_or_else(|| name.clone());
            result.canonical_name = Some(resolved);
        }
        
        if let Some(ref warning) = assessment.warning {
            result.warnings.push(warning.clone());
        }
        
        if let Some(ref risk) = assessment.risk_factor {
            result.risk_factors.push(risk.clone());
        }
        
        if let Some(modifier) = assessment.score_modifier {
            result.score_modifier += modifier;
        }
    }

    fn validate_field(&self, value: &serde_json::Value, validation: &FieldValidationType) -> bool {
        match validation {
            FieldValidationType::AddressFormat => {
                value.as_str()
                    .map(|s| s.len() == 42 && s.starts_with("0x"))
                    .unwrap_or(false)
            }
            FieldValidationType::NonEmpty => {
                match value {
                    serde_json::Value::String(s) => !s.is_empty(),
                    serde_json::Value::Array(arr) => !arr.is_empty(),
                    serde_json::Value::Null => false,
                    _ => true,
                }
            }
            FieldValidationType::NonZero => {
                value.as_u64().map(|n| n > 0).unwrap_or(false)
                    || value.as_f64().map(|n| n != 0.0).unwrap_or(false)
            }
            FieldValidationType::IsZeroAddress => {
                value.as_str().map(|s| s == ZERO_ADDRESS).unwrap_or(false)
            }
        }
    }

    fn evaluate_numeric_rule(&self, value: &serde_json::Value, rule: &NumericRule, context: &serde_json::Value) -> bool {
        match rule.condition.as_str() {
            "array-length-zero" => {
                value.as_array().map(|arr| arr.is_empty()).unwrap_or(false)
            }
            "array-length-one" => {
                value.as_array().map(|arr| arr.len() == 1).unwrap_or(false)
            }
            "array-not-empty" => {
                value.as_array().map(|arr| !arr.is_empty()).unwrap_or(false)
            }
            "array-empty" => {
                value.as_array().map(|arr| arr.is_empty()).unwrap_or(true)
            }
            "array-length-equals" => {
                if let Some(threshold) = rule.threshold {
                    value.as_array().map(|arr| arr.len() as f64 == threshold).unwrap_or(false)
                } else {
                    false
                }
            }
            "greater-than-array-length" => {
                if let Some(comparison_field) = &rule.comparison_field {
                    let comparison_value = self.get_field_value(context, comparison_field);
                    if let Some(arr) = comparison_value.as_array() {
                        let array_len = arr.len() as f64;
                        return value.as_f64().map(|n| n > array_len).unwrap_or(false)
                            || value.as_u64().map(|n| n as f64 > array_len).unwrap_or(false);
                    }
                }
                false
            }
            "equals-zero" => {
                value.as_u64().map(|n| n == 0).unwrap_or(false)
                    || value.as_f64().map(|n| n == 0.0).unwrap_or(false)
            }
            "greater-than" => {
                if let Some(threshold) = rule.threshold {
                    value.as_f64().map(|n| n > threshold).unwrap_or(false)
                } else {
                    false
                }
            }
            "less-than" => {
                if let Some(threshold) = rule.threshold {
                    value.as_f64().map(|n| n < threshold).unwrap_or(false)
                } else {
                    false
                }
            }
            _ => false,
        }
    }

    fn compare_values(&self, a: &serde_json::Value, b: &serde_json::Value, op: &CompareOperator) -> bool {
        let a_str = a.as_str().map(|s| s.to_lowercase());
        let b_str = b.as_str().map(|s| s.to_lowercase());
        
        if let (Some(a_s), Some(b_s)) = (a_str, b_str) {
            return match op {
                CompareOperator::Eq => a_s == b_s,
                CompareOperator::Ne => a_s != b_s,
                _ => false,
            };
        }
        
        let a_num = a.as_f64().or_else(|| a.as_u64().map(|n| n as f64));
        let b_num = b.as_f64().or_else(|| b.as_u64().map(|n| n as f64));
        
        if let (Some(a_n), Some(b_n)) = (a_num, b_num) {
            return match op {
                CompareOperator::Eq => (a_n - b_n).abs() < f64::EPSILON,
                CompareOperator::Ne => (a_n - b_n).abs() >= f64::EPSILON,
                CompareOperator::Gt => a_n > b_n,
                CompareOperator::Lt => a_n < b_n,
                CompareOperator::Gte => a_n >= b_n,
                CompareOperator::Lte => a_n <= b_n,
            };
        }
        
        false
    }

    fn get_field_value(&self, context: &serde_json::Value, path: &str) -> serde_json::Value {
        let parts: Vec<&str> = path.split('.').collect();
        let mut current = context.clone();
        
        for part in parts {
            if part == "length" {
                return serde_json::json!(current.as_array().map(|a| a.len()).unwrap_or(0));
            }
            current = current.get(part).cloned().unwrap_or(serde_json::Value::Null);
        }
        
        current
    }
}

impl Default for AssessmentEngine {
    fn default() -> Self {
        Self::new()
    }
}
