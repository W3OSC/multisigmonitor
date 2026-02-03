use super::schema::*;
use super::loader::TemplateLoader;
use super::builtins::{BuiltinRegistry, BuiltinContext, AnalysisDetailInput};

const ZERO_ADDRESS: &str = "0x0000000000000000000000000000000000000000";

pub struct TemplateEngine {
    loader: TemplateLoader,
    builtins: BuiltinRegistry,
}

impl TemplateEngine {
    pub fn new() -> Self {
        Self {
            loader: TemplateLoader::default(),
            builtins: BuiltinRegistry::new(),
        }
    }

    pub fn with_loader(loader: TemplateLoader) -> Self {
        Self { 
            loader,
            builtins: BuiltinRegistry::new(),
        }
    }
    
    pub fn template_count(&self) -> usize {
        self.loader.transaction_templates().len()
    }

    pub fn evaluate_transaction(&self, context: &TransactionContext) -> Vec<TemplateMatch> {
        let mut matches = Vec::new();
        let context_value = context.to_value();

        for template in self.loader.transaction_templates() {
            if let Some(ref builtin_name) = template.builtin {
                let builtin_ctx = BuiltinContext {
                    transaction: context_value.clone(),
                    safe_address: context.safe_address.clone().unwrap_or_default(),
                    chain_id: context.chain_id,
                    safe_version: context.safe_version.clone(),
                    analysis_details: matches.iter().map(|m: &TemplateMatch| AnalysisDetailInput {
                        severity: m.severity.as_str().to_string(),
                        priority: m.priority.clone(),
                    }).collect(),
                };

                if let Some(result) = self.builtins.execute(builtin_name, &builtin_ctx) {
                    if let Some(output) = result.output {
                        matches.push(TemplateMatch {
                            template_id: template.id.clone(),
                            template_name: template.name.clone(),
                            output_type: output.output_type,
                            severity: match output.severity.as_str() {
                                "critical" => Severity::Critical,
                                "high" => Severity::High,
                                "medium" => Severity::Medium,
                                _ => Severity::Low,
                            },
                            priority: output.priority,
                            warning: output.warning.unwrap_or_default(),
                            message: output.message,
                            extra: output.extra,
                        });
                    }
                }
                continue;
            }

            if !template.condition_groups.is_empty() {
                for group in &template.condition_groups {
                    if self.evaluate_condition_group(group, &context_value) {
                        let extra = self.extract_extra_fields(&group.output.extra_fields, &context_value);
                        matches.push(TemplateMatch {
                            template_id: template.id.clone(),
                            template_name: template.name.clone(),
                            output_type: group.output.output_type.clone(),
                            severity: group.severity.clone().unwrap_or(template.severity.clone()),
                            priority: group.priority.clone().or(template.priority.clone()),
                            warning: group.output.warning.clone(),
                            message: self.interpolate_message(&group.output.message, &context_value),
                            extra,
                        });
                    }
                }
            }

            if !template.conditions.is_empty() {
                let all_match = template.conditions.iter()
                    .all(|c| self.evaluate_condition(c, &context_value));
                
                if all_match {
                    let extra = self.extract_extra_fields(&template.output.extra_fields, &context_value);
                    matches.push(TemplateMatch {
                        template_id: template.id.clone(),
                        template_name: template.name.clone(),
                        output_type: template.output.output_type.clone(),
                        severity: template.severity.clone(),
                        priority: template.priority.clone(),
                        warning: template.output.warning.clone(),
                        message: self.interpolate_message(&template.output.message, &context_value),
                        extra,
                    });
                }
            }
        }

        matches
    }

    fn evaluate_condition_group(&self, group: &ConditionGroup, context: &serde_json::Value) -> bool {
        match group.operator {
            LogicalOperator::And => {
                group.conditions.iter().all(|c| self.evaluate_condition(c, context))
            }
            LogicalOperator::Or => {
                group.conditions.iter().any(|c| self.evaluate_condition(c, context))
            }
        }
    }

    fn evaluate_condition(&self, condition: &Condition, context: &serde_json::Value) -> bool {
        match condition {
            Condition::FieldEquals { field, value } => {
                let field_value = self.get_field_value(context, field);
                self.values_equal(&field_value, value)
            }
            Condition::FieldNotEquals { field, value } => {
                let field_value = self.get_field_value(context, field);
                !self.values_equal(&field_value, value)
            }
            Condition::FieldExists { field } => {
                !self.get_field_value(context, field).is_null()
            }
            Condition::FieldNotExists { field } => {
                self.get_field_value(context, field).is_null()
            }
            Condition::FieldIn { field, values } => {
                let field_value = self.get_field_value(context, field);
                values.iter().any(|v| self.values_equal(&field_value, v))
            }
            Condition::FieldNotIn { field, values } => {
                let field_value = self.get_field_value(context, field);
                !values.iter().any(|v| self.values_equal(&field_value, v))
            }
            Condition::NumericGreaterThan { field, threshold, unit } => {
                let field_value = self.get_field_value(context, field);
                self.parse_numeric(&field_value, unit.as_ref())
                    .map(|v| v > *threshold)
                    .unwrap_or(false)
            }
            Condition::NumericLessThan { field, threshold, unit } => {
                let field_value = self.get_field_value(context, field);
                self.parse_numeric(&field_value, unit.as_ref())
                    .map(|v| v < *threshold)
                    .unwrap_or(false)
            }
            Condition::NumericEquals { field, value } => {
                let field_value = self.get_field_value(context, field);
                self.parse_numeric(&field_value, None)
                    .map(|v| (v - value).abs() < f64::EPSILON)
                    .unwrap_or(false)
            }
            Condition::MethodMatch { field, methods } => {
                let field_value = self.get_field_value(context, field);
                if let Some(method_str) = field_value.as_str() {
                    methods.iter().any(|m| m == method_str)
                } else {
                    false
                }
            }
            Condition::WhitelistLookup { field, whitelist, expect } => {
                let field_value = self.get_field_value(context, field);
                if let Some(address) = field_value.as_str() {
                    let normalized_address = address.to_lowercase();
                    let found = whitelist.contains_key(&normalized_address);
                    match expect {
                        RegistryExpectation::Present => found,
                        RegistryExpectation::Missing => !found,
                    }
                } else {
                    *expect == RegistryExpectation::Missing
                }
            }
            Condition::StringContains { field, substring } => {
                let field_value = self.get_field_value(context, field);
                field_value.as_str()
                    .map(|s| s.contains(substring))
                    .unwrap_or(false)
            }
            Condition::StringNotEmpty { field } => {
                let field_value = self.get_field_value(context, field);
                field_value.as_str()
                    .map(|s| !s.is_empty() && s != "0x")
                    .unwrap_or(false)
            }
            Condition::ArrayNotEmpty { field } => {
                let field_value = self.get_field_value(context, field);
                field_value.as_array()
                    .map(|arr| !arr.is_empty())
                    .unwrap_or(false)
            }
            Condition::ArrayEmpty { field } => {
                let field_value = self.get_field_value(context, field);
                field_value.as_array()
                    .map(|arr| arr.is_empty())
                    .unwrap_or(true)
            }
            Condition::ArrayLength { field, operator, value } => {
                let field_value = self.get_field_value(context, field);
                field_value.as_array()
                    .map(|arr| self.compare_values(arr.len(), *value, operator))
                    .unwrap_or(false)
            }
            Condition::BoolEquals { field, value } => {
                let field_value = self.get_field_value(context, field);
                field_value.as_bool() == Some(*value)
            }
            Condition::AddressEquals { field, address } => {
                let field_value = self.get_field_value(context, field);
                if let Some(addr) = field_value.as_str() {
                    addr.to_lowercase() == address.to_lowercase()
                } else {
                    address.to_lowercase() == ZERO_ADDRESS
                }
            }
            Condition::AddressNotEquals { field, address } => {
                let field_value = self.get_field_value(context, field);
                if let Some(addr) = field_value.as_str() {
                    addr.to_lowercase() != address.to_lowercase()
                } else {
                    address.to_lowercase() != ZERO_ADDRESS
                }
            }
            Condition::And { conditions } => {
                conditions.iter().all(|c| self.evaluate_condition(c, context))
            }
            Condition::Or { conditions } => {
                conditions.iter().any(|c| self.evaluate_condition(c, context))
            }
            Condition::Not { condition } => {
                !self.evaluate_condition(condition, context)
            }
        }
    }

    fn get_field_value<'a>(&self, context: &'a serde_json::Value, field: &str) -> serde_json::Value {
        let parts: Vec<&str> = field.split('.').collect();
        let mut current = context.clone();
        
        for part in parts {
            if let Some(obj) = current.as_object() {
                if let Some(val) = obj.get(part) {
                    current = val.clone();
                } else {
                    let snake_case = to_snake_case(part);
                    if let Some(val) = obj.get(&snake_case) {
                        current = val.clone();
                    } else {
                        return serde_json::Value::Null;
                    }
                }
            } else if let Some(arr) = current.as_array() {
                if let Ok(idx) = part.parse::<usize>() {
                    if let Some(val) = arr.get(idx) {
                        current = val.clone();
                    } else {
                        return serde_json::Value::Null;
                    }
                } else {
                    return serde_json::Value::Null;
                }
            } else {
                return serde_json::Value::Null;
            }
        }
        
        current
    }

    fn values_equal(&self, a: &serde_json::Value, b: &serde_json::Value) -> bool {
        match (a, b) {
            (serde_json::Value::String(s1), serde_json::Value::String(s2)) => {
                if s1.starts_with("0x") && s2.starts_with("0x") {
                    s1.to_lowercase() == s2.to_lowercase()
                } else {
                    s1 == s2
                }
            }
            (serde_json::Value::Number(n1), serde_json::Value::Number(n2)) => n1 == n2,
            (serde_json::Value::Number(n), serde_json::Value::String(s)) |
            (serde_json::Value::String(s), serde_json::Value::Number(n)) => {
                if let Some(n_val) = n.as_u64() {
                    s.parse::<u64>().map(|sv| sv == n_val).unwrap_or(false)
                } else if let Some(n_val) = n.as_i64() {
                    s.parse::<i64>().map(|sv| sv == n_val).unwrap_or(false)
                } else {
                    false
                }
            }
            (serde_json::Value::Bool(b1), serde_json::Value::Bool(b2)) => b1 == b2,
            (serde_json::Value::Null, serde_json::Value::Null) => true,
            _ => a == b,
        }
    }

    fn parse_numeric(&self, value: &serde_json::Value, unit: Option<&NumericUnit>) -> Option<f64> {
        let raw = match value {
            serde_json::Value::Number(n) => n.as_f64(),
            serde_json::Value::String(s) => {
                if s.is_empty() || s == "0x" {
                    Some(0.0)
                } else if s.starts_with("0x") {
                    u128::from_str_radix(s.trim_start_matches("0x"), 16)
                        .map(|v| v as f64)
                        .ok()
                } else {
                    s.parse::<f64>().ok()
                        .or_else(|| s.parse::<u128>().map(|v| v as f64).ok())
                }
            }
            _ => None,
        }?;

        Some(match unit {
            Some(NumericUnit::Wei) => raw,
            Some(NumericUnit::Gwei) => raw / 1e9,
            Some(NumericUnit::Ether) => raw / 1e18,
            None => raw,
        })
    }

    fn compare_values(&self, a: usize, b: usize, op: &CompareOperator) -> bool {
        match op {
            CompareOperator::Eq => a == b,
            CompareOperator::Ne => a != b,
            CompareOperator::Gt => a > b,
            CompareOperator::Lt => a < b,
            CompareOperator::Gte => a >= b,
            CompareOperator::Lte => a <= b,
        }
    }

    fn extract_extra_fields(&self, fields: &[String], context: &serde_json::Value) -> serde_json::Value {
        let mut extra = serde_json::Map::new();
        
        for field in fields {
            let value = self.get_field_value(context, field);
            if !value.is_null() {
                let key = field.split('.').last().unwrap_or(field);
                extra.insert(key.to_string(), value);
            }
        }
        
        serde_json::Value::Object(extra)
    }

    fn interpolate_message(&self, message: &str, context: &serde_json::Value) -> String {
        let mut result = message.to_string();
        
        let re = regex::Regex::new(r"\{\{\s*(\w+(?:\.\w+)*)\s*\}\}").unwrap();
        for cap in re.captures_iter(message) {
            let field = &cap[1];
            let value = self.get_field_value(context, field);
            let replacement = match &value {
                serde_json::Value::String(s) => s.clone(),
                serde_json::Value::Number(n) => n.to_string(),
                serde_json::Value::Bool(b) => b.to_string(),
                serde_json::Value::Null => "null".to_string(),
                _ => value.to_string(),
            };
            result = result.replace(&cap[0], &replacement);
        }
        
        result
    }

    pub fn get_call_type_info(&self, context: &TransactionContext) -> CallTypeInfo {
        let operation = context.operation.unwrap_or(0);
        let to_address = &context.to;
        
        let trusted_delegates: std::collections::HashMap<&str, &str> = [
            ("0x40a2accbd92bca938b02010e17a5b8929b49130d", "MultiSendCallOnly v1.3.0 (canonical)"),
            ("0xa1dabef33b3b82c7814b6d82a79e50f4ac44102b", "MultiSendCallOnly v1.3.0 (eip155)"),
            ("0xf220d3b4dfb23c4ade8c88e526c1353abacbc38f", "MultiSendCallOnly v1.3.0 (zksync)"),
            ("0x9641d764fc13c8b624c04430c7356c1c7c8102e2", "MultiSendCallOnly v1.4.1 (canonical)"),
            ("0x0408ef011960d02349d50286d20531229bcef773", "MultiSendCallOnly v1.4.1 (zksync)"),
            ("0x526643f69b81b008f46d95cd5ced5ec0edffdac6", "SafeMigration v1.4.1 (canonical)"),
            ("0x817756c6c555a94bcee39eb5a102abc1678b09a7", "SafeMigration v1.4.1 (zksync)"),
            ("0xa65387f16b013cf2af4605ad8aa5ec25a2cba3a2", "SignMessageLib v1.3.0 (canonical)"),
            ("0x98ffbbf51bb33a056b08ddf711f289936aff717", "SignMessageLib v1.3.0 (eip155)"),
            ("0x357147caf9c0cca67dfa0cf5369318d8193c8407", "SignMessageLib v1.3.0 (zksync)"),
            ("0xd53cd0ab83d845ac265be939c57f53ad838012c9", "SignMessageLib v1.4.1 (canonical)"),
            ("0xaca1ec0a1a575cdccf1dc3d5d296202eb6061888", "SignMessageLib v1.4.1 (zksync)"),
        ].iter().cloned().collect();
        
        let trusted_name = if operation == 1 {
            let normalized = to_address.to_lowercase();
            trusted_delegates.get(normalized.as_str()).map(|s| s.to_string())
        } else {
            None
        };

        CallTypeInfo {
            is_call: operation == 0,
            is_delegate_call: operation == 1,
            is_trusted_delegate: trusted_name.is_some(),
            contract_address: to_address.clone(),
            contract_name: trusted_name,
        }
    }
}

impl Default for TemplateEngine {
    fn default() -> Self {
        Self::new()
    }
}

fn to_snake_case(s: &str) -> String {
    let mut result = String::new();
    for (i, c) in s.chars().enumerate() {
        if c.is_uppercase() {
            if i > 0 {
                result.push('_');
            }
            result.push(c.to_lowercase().next().unwrap());
        } else {
            result.push(c);
        }
    }
    result
}

#[derive(Debug, Clone)]
pub struct TransactionContext {
    pub to: String,
    pub value: Option<String>,
    pub data: Option<String>,
    pub data_decoded: Option<DataDecodedContext>,
    pub operation: Option<u8>,
    pub gas_token: Option<String>,
    pub safe_tx_gas: Option<String>,
    pub base_gas: Option<String>,
    pub gas_price: Option<String>,
    pub refund_receiver: Option<String>,
    pub nonce: Option<u64>,
    pub safe_tx_hash: Option<String>,
    pub trusted: Option<bool>,
    pub chain_id: Option<u64>,
    pub safe_version: Option<String>,
    pub safe_address: Option<String>,
}

#[derive(Debug, Clone)]
pub struct DataDecodedContext {
    pub method: String,
    pub parameters: Option<Vec<ParameterContext>>,
}

#[derive(Debug, Clone)]
pub struct ParameterContext {
    pub name: String,
    pub param_type: String,
    pub value: serde_json::Value,
}

impl TransactionContext {
    pub fn to_value(&self) -> serde_json::Value {
        let mut map = serde_json::Map::new();
        
        map.insert("to".to_string(), serde_json::json!(self.to));
        
        if let Some(ref v) = self.value {
            map.insert("value".to_string(), serde_json::json!(v));
        }
        if let Some(ref v) = self.data {
            map.insert("data".to_string(), serde_json::json!(v));
        }
        if let Some(ref v) = self.data_decoded {
            let mut dd_map = serde_json::Map::new();
            dd_map.insert("method".to_string(), serde_json::json!(v.method));
            if let Some(ref params) = v.parameters {
                let params_json: Vec<serde_json::Value> = params.iter().map(|p| {
                    serde_json::json!({
                        "name": p.name,
                        "type": p.param_type,
                        "value": p.value
                    })
                }).collect();
                dd_map.insert("parameters".to_string(), serde_json::json!(params_json));
            }
            map.insert("dataDecoded".to_string(), serde_json::Value::Object(dd_map));
        }
        if let Some(v) = self.operation {
            map.insert("operation".to_string(), serde_json::json!(v));
        }
        if let Some(ref v) = self.gas_token {
            map.insert("gasToken".to_string(), serde_json::json!(v));
        } else {
            map.insert("gasToken".to_string(), serde_json::json!(ZERO_ADDRESS));
        }
        if let Some(ref v) = self.safe_tx_gas {
            map.insert("safeTxGas".to_string(), serde_json::json!(v));
        } else {
            map.insert("safeTxGas".to_string(), serde_json::json!("0"));
        }
        if let Some(ref v) = self.base_gas {
            map.insert("baseGas".to_string(), serde_json::json!(v));
        } else {
            map.insert("baseGas".to_string(), serde_json::json!("0"));
        }
        if let Some(ref v) = self.gas_price {
            map.insert("gasPrice".to_string(), serde_json::json!(v));
        } else {
            map.insert("gasPrice".to_string(), serde_json::json!("0"));
        }
        if let Some(ref v) = self.refund_receiver {
            map.insert("refundReceiver".to_string(), serde_json::json!(v));
        } else {
            map.insert("refundReceiver".to_string(), serde_json::json!(ZERO_ADDRESS));
        }
        if let Some(v) = self.nonce {
            map.insert("nonce".to_string(), serde_json::json!(v));
        }
        if let Some(ref v) = self.safe_tx_hash {
            map.insert("safeTxHash".to_string(), serde_json::json!(v));
        }
        if let Some(v) = self.trusted {
            map.insert("trusted".to_string(), serde_json::json!(v));
        }
        
        serde_json::Value::Object(map)
    }
}

#[derive(Debug, Clone)]
pub struct CallTypeInfo {
    pub is_call: bool,
    pub is_delegate_call: bool,
    pub is_trusted_delegate: bool,
    pub contract_address: String,
    pub contract_name: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn create_test_context() -> TransactionContext {
        TransactionContext {
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
            chain_id: None,
            safe_version: None,
            safe_address: None,
        }
    }

    #[test]
    fn test_gas_token_attack_detection() {
        let engine = TemplateEngine::new();
        let mut context = create_test_context();
        context.gas_token = Some("0x1111111111111111111111111111111111111111".to_string());
        context.refund_receiver = Some("0x2222222222222222222222222222222222222222".to_string());

        let matches = engine.evaluate_transaction(&context);
        
        assert!(matches.iter().any(|m| m.output_type == "gas_token_attack"));
    }

    #[test]
    fn test_untrusted_delegate_call_detection() {
        let engine = TemplateEngine::new();
        let mut context = create_test_context();
        context.operation = Some(1);
        context.to = "0x9999999999999999999999999999999999999999".to_string();

        let matches = engine.evaluate_transaction(&context);
        
        assert!(matches.iter().any(|m| m.output_type == "untrusted_delegate_call"));
    }

    #[test]
    fn test_trusted_delegate_call_detection() {
        let engine = TemplateEngine::new();
        let mut context = create_test_context();
        context.operation = Some(1);
        context.to = "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D".to_string();

        let matches = engine.evaluate_transaction(&context);
        
        assert!(matches.iter().any(|m| m.output_type == "trusted_delegate_call"));
        assert!(!matches.iter().any(|m| m.output_type == "untrusted_delegate_call"));
    }

    #[test]
    fn test_owner_added_detection() {
        let engine = TemplateEngine::new();
        let mut context = create_test_context();
        context.data_decoded = Some(DataDecodedContext {
            method: "addOwner".to_string(),
            parameters: Some(vec![ParameterContext {
                name: "owner".to_string(),
                param_type: "address".to_string(),
                value: serde_json::json!("0x3333333333333333333333333333333333333333"),
            }]),
        });

        let matches = engine.evaluate_transaction(&context);
        
        assert!(matches.iter().any(|m| m.output_type == "owner_added"));
    }

    #[test]
    fn test_large_value_transfer() {
        let engine = TemplateEngine::new();
        let mut context = create_test_context();
        context.value = Some("6000000000000000000000".to_string());

        let matches = engine.evaluate_transaction(&context);
        
        assert!(matches.iter().any(|m| m.output_type == "large_value_transfer"));
    }

    #[test]
    fn test_no_false_positives_clean_transaction() {
        let engine = TemplateEngine::new();
        let context = create_test_context();

        let matches = engine.evaluate_transaction(&context);
        
        let critical_matches: Vec<_> = matches.iter()
            .filter(|m| matches!(m.severity, Severity::Critical))
            .collect();
        assert!(critical_matches.is_empty());
    }
}
