use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
pub enum TemplateType {
    TransactionAnalysis,
    SafeAssessment,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "kebab-case")]
pub enum Builtin {
    SafeApiInfo,
    SafeApiCreation,
    BlockchainInfoOwners,
    BlockchainInfoModules,
    BlockchainInfoGuard,
    BlockchainInfoFallbackHandler,
    BlockchainInfoThreshold,
    SanctionsSafeAddress,
    SanctionsOwners,
    SanctionsFactory,
    SanctionsMastercopy,
    SanctionsModules,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct UnifiedOutput {
    pub severity: CheckSeverity,
    #[serde(default)]
    pub score_modifier: i32,
    #[serde(default)]
    pub warnings: Vec<String>,
    #[serde(default)]
    pub canonical_name: Option<String>,
    #[serde(default)]
    pub details: Option<serde_json::Value>,
}

impl Default for UnifiedOutput {
    fn default() -> Self {
        Self {
            severity: CheckSeverity::Pass,
            score_modifier: 0,
            warnings: Vec::new(),
            canonical_name: None,
            details: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum Severity {
    Info,
    Low,
    Medium,
    High,
    Critical,
}

impl Severity {
    pub fn as_str(&self) -> &'static str {
        match self {
            Severity::Info => "info",
            Severity::Low => "low",
            Severity::Medium => "medium",
            Severity::High => "high",
            Severity::Critical => "critical",
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord)]
#[serde(rename_all = "lowercase")]
pub enum CheckSeverity {
    Pass,
    Info,
    Low,
    Medium,
    High,
    Critical,
}

impl Default for CheckSeverity {
    fn default() -> Self {
        CheckSeverity::Pass
    }
}

impl CheckSeverity {
    pub fn as_str(&self) -> &'static str {
        match self {
            CheckSeverity::Pass => "pass",
            CheckSeverity::Info => "info",
            CheckSeverity::Low => "low",
            CheckSeverity::Medium => "medium",
            CheckSeverity::High => "high",
            CheckSeverity::Critical => "critical",
        }
    }
    
    pub fn merge(&self, other: &CheckSeverity) -> CheckSeverity {
        if *other > *self { *other } else { *self }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct Template {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub template_type: TemplateType,
    pub severity: Severity,
    #[serde(default)]
    pub priority: Option<String>,
    #[serde(default)]
    pub conditions: Vec<Condition>,
    #[serde(default)]
    pub condition_groups: Vec<ConditionGroup>,
    pub output: TemplateOutput,
    #[serde(default)]
    pub builtin: Option<String>,
    #[serde(default)]
    pub metadata: Option<TemplateMetadata>,
}


#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct TemplateMetadata {
    #[serde(default)]
    pub author: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub references: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct ConditionGroup {
    pub id: String,
    pub operator: LogicalOperator,
    pub conditions: Vec<Condition>,
    pub output: TemplateOutput,
    #[serde(default)]
    pub severity: Option<Severity>,
    #[serde(default)]
    pub priority: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum LogicalOperator {
    And,
    Or,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum Condition {
    FieldEquals {
        field: String,
        value: serde_json::Value,
    },
    FieldNotEquals {
        field: String,
        value: serde_json::Value,
    },
    FieldExists {
        field: String,
    },
    FieldNotExists {
        field: String,
    },
    FieldIn {
        field: String,
        values: Vec<serde_json::Value>,
    },
    FieldNotIn {
        field: String,
        values: Vec<serde_json::Value>,
    },
    NumericGreaterThan {
        field: String,
        threshold: f64,
        #[serde(default)]
        unit: Option<NumericUnit>,
    },
    NumericLessThan {
        field: String,
        threshold: f64,
        #[serde(default)]
        unit: Option<NumericUnit>,
    },
    NumericEquals {
        field: String,
        value: f64,
    },
    MethodMatch {
        field: String,
        methods: Vec<String>,
    },
    WhitelistLookup {
        field: String,
        whitelist: std::collections::HashMap<String, String>,
        expect: RegistryExpectation,
    },
    StringContains {
        field: String,
        substring: String,
    },
    StringNotEmpty {
        field: String,
    },
    ArrayNotEmpty {
        field: String,
    },
    ArrayEmpty {
        field: String,
    },
    ArrayLength {
        field: String,
        operator: CompareOperator,
        value: usize,
    },
    BoolEquals {
        field: String,
        value: bool,
    },
    AddressEquals {
        field: String,
        address: String,
    },
    AddressNotEquals {
        field: String,
        address: String,
    },
    And {
        conditions: Vec<Condition>,
    },
    Or {
        conditions: Vec<Condition>,
    },
    Not {
        condition: Box<Condition>,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum NumericUnit {
    Wei,
    Gwei,
    Ether,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RegistryExpectation {
    Present,
    Missing,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum CompareOperator {
    Eq,
    Ne,
    Gt,
    Lt,
    Gte,
    Lte,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct TemplateOutput {
    pub warning: String,
    pub message: String,
    #[serde(rename = "type")]
    pub output_type: String,
    #[serde(default)]
    pub extra_fields: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct TemplateMatch {
    pub template_id: String,
    pub template_name: String,
    pub output_type: String,
    pub severity: Severity,
    pub priority: Option<String>,
    pub warning: String,
    pub message: String,
    pub extra: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct AssessmentTemplate {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub template_type: TemplateType,
    pub check_name: String,
    #[serde(default)]
    pub conditions: Vec<AssessmentCondition>,
    #[serde(default)]
    pub validation_rules: Vec<ValidationRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "kebab-case")]
pub enum AssessmentCondition {
    WhitelistLookup {
        field: String,
        whitelist: std::collections::HashMap<String, String>,
        on_match: AssessmentResult,
        on_no_match: AssessmentResult,
    },
    FieldValidation {
        field: String,
        validation: FieldValidationType,
        on_valid: AssessmentResult,
        on_invalid: AssessmentResult,
    },
    NumericValidation {
        field: String,
        rules: Vec<NumericRule>,
    },
    ExternalDataCheck {
        data_field: String,
        flag_field: String,
        on_flagged: AssessmentResult,
        on_clear: AssessmentResult,
    },
    CrossFieldComparison {
        field_a: String,
        field_b: String,
        comparison: CompareOperator,
        on_match: AssessmentResult,
        on_mismatch: AssessmentResult,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum FieldValidationType {
    AddressFormat,
    NonEmpty,
    NonZero,
    IsZeroAddress,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct NumericRule {
    pub condition: String,
    pub threshold: Option<f64>,
    pub comparison_field: Option<String>,
    pub result: AssessmentResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct ValidationRule {
    pub condition: Condition,
    pub result: AssessmentResult,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub struct AssessmentResult {
    #[serde(default)]
    pub severity: CheckSeverity,
    #[serde(default)]
    pub canonical_name: Option<String>,
    #[serde(default)]
    pub warning: Option<String>,
    #[serde(default)]
    pub risk_factor: Option<String>,
    #[serde(default)]
    pub score_modifier: Option<i32>,
}
