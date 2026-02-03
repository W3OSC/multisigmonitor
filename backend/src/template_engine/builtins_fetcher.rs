use super::schema::Builtin;
use async_trait::async_trait;
use std::collections::HashMap;
use std::sync::Arc;

#[derive(Debug, Clone)]
pub struct BuiltinData {
    cache: HashMap<Builtin, serde_json::Value>,
}

impl BuiltinData {
    pub fn new() -> Self {
        Self {
            cache: HashMap::new(),
        }
    }

    pub fn insert(&mut self, builtin: Builtin, data: serde_json::Value) {
        self.cache.insert(builtin, data);
    }

    pub fn get(&self, builtin: &Builtin) -> Option<&serde_json::Value> {
        self.cache.get(builtin)
    }

    pub fn has(&self, builtin: &Builtin) -> bool {
        self.cache.contains_key(builtin)
    }
}

#[async_trait]
pub trait BuiltinFetcher: Send + Sync {
    async fn fetch(&self, builtin: &Builtin, context: &FetchContext) -> Result<serde_json::Value, BuiltinError>;
}

#[derive(Debug)]
pub enum BuiltinError {
    NotFound(String),
    NetworkError(String),
    ParseError(String),
    UnsupportedNetwork(String),
}

impl std::fmt::Display for BuiltinError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::NotFound(msg) => write!(f, "Not found: {}", msg),
            Self::NetworkError(msg) => write!(f, "Network error: {}", msg),
            Self::ParseError(msg) => write!(f, "Parse error: {}", msg),
            Self::UnsupportedNetwork(msg) => write!(f, "Unsupported network: {}", msg),
        }
    }
}

impl std::error::Error for BuiltinError {}

#[derive(Debug, Clone)]
pub struct FetchContext {
    pub safe_address: String,
    pub network: String,
}

pub struct DefaultBuiltinFetcher {
    safe_api_fetcher: Arc<dyn Fn(&str, &str) -> Result<serde_json::Value, BuiltinError> + Send + Sync>,
    blockchain_fetcher: Arc<dyn Fn(&str, &str) -> Result<serde_json::Value, BuiltinError> + Send + Sync>,
    sanctions_fetcher: Arc<dyn Fn(&str) -> Result<serde_json::Value, BuiltinError> + Send + Sync>,
}

impl DefaultBuiltinFetcher {
    pub fn new(
        safe_api_fetcher: Arc<dyn Fn(&str, &str) -> Result<serde_json::Value, BuiltinError> + Send + Sync>,
        blockchain_fetcher: Arc<dyn Fn(&str, &str) -> Result<serde_json::Value, BuiltinError> + Send + Sync>,
        sanctions_fetcher: Arc<dyn Fn(&str) -> Result<serde_json::Value, BuiltinError> + Send + Sync>,
    ) -> Self {
        Self {
            safe_api_fetcher,
            blockchain_fetcher,
            sanctions_fetcher,
        }
    }
}

#[async_trait]
impl BuiltinFetcher for DefaultBuiltinFetcher {
    async fn fetch(&self, builtin: &Builtin, context: &FetchContext) -> Result<serde_json::Value, BuiltinError> {
        match builtin {
            Builtin::SafeApiInfo | Builtin::SafeApiCreation => {
                (self.safe_api_fetcher)(&context.safe_address, &context.network)
            }
            Builtin::BlockchainInfoOwners
            | Builtin::BlockchainInfoModules
            | Builtin::BlockchainInfoGuard
            | Builtin::BlockchainInfoFallbackHandler
            | Builtin::BlockchainInfoThreshold => {
                (self.blockchain_fetcher)(&context.safe_address, &context.network)
            }
            Builtin::SanctionsSafeAddress
            | Builtin::SanctionsOwners
            | Builtin::SanctionsFactory
            | Builtin::SanctionsMastercopy
            | Builtin::SanctionsModules => {
                (self.sanctions_fetcher)(&context.safe_address)
            }
        }
    }
}
