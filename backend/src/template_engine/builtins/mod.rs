mod hash_verification;
mod security_score;

pub use hash_verification::HashVerificationBuiltin;
pub use security_score::SecurityScoreBuiltin;

use std::collections::HashMap;

pub trait BuiltinCheck: Send + Sync {
    fn name(&self) -> &'static str;
    fn execute(&self, context: &BuiltinContext) -> BuiltinResult;
}

#[derive(Debug, Clone)]
pub struct BuiltinContext {
    pub transaction: serde_json::Value,
    pub safe_address: String,
    pub chain_id: Option<u64>,
    pub safe_version: Option<String>,
    pub analysis_details: Vec<AnalysisDetailInput>,
}

#[derive(Debug, Clone)]
pub struct AnalysisDetailInput {
    pub severity: String,
    pub priority: Option<String>,
}

#[derive(Debug, Clone)]
pub struct BuiltinResult {
    pub success: bool,
    pub output: Option<BuiltinOutput>,
    pub error: Option<String>,
}

#[derive(Debug, Clone)]
pub struct BuiltinOutput {
    pub output_type: String,
    pub severity: String,
    pub warning: Option<String>,
    pub message: String,
    pub priority: Option<String>,
    pub extra: serde_json::Value,
}

pub struct BuiltinRegistry {
    checks: HashMap<&'static str, Box<dyn BuiltinCheck>>,
}

impl BuiltinRegistry {
    pub fn new() -> Self {
        let mut checks: HashMap<&'static str, Box<dyn BuiltinCheck>> = HashMap::new();
        checks.insert("verify-transaction-hash", Box::new(HashVerificationBuiltin));
        checks.insert("calculate-security-score", Box::new(SecurityScoreBuiltin));
        Self { checks }
    }

    pub fn get(&self, name: &str) -> Option<&dyn BuiltinCheck> {
        self.checks.get(name).map(|b| b.as_ref())
    }

    pub fn available_builtins(&self) -> Vec<&'static str> {
        self.checks.keys().copied().collect()
    }

    pub fn execute(&self, name: &str, context: &BuiltinContext) -> Option<BuiltinResult> {
        self.get(name).map(|builtin| builtin.execute(context))
    }
}

impl Default for BuiltinRegistry {
    fn default() -> Self {
        Self::new()
    }
}
