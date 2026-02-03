use crate::constants::SafeAddressRegistry;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::Path;
use std::sync::OnceLock;

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RegistryFile {
    name: String,
    description: String,
    version: String,
    entries: Vec<RegistryEntry>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RegistryEntry {
    address: String,
    name: String,
}

static LOADED_REGISTRIES: OnceLock<HashMap<String, HashMap<String, String>>> = OnceLock::new();

pub struct RegistryResolver;

impl RegistryResolver {
    fn load_registries() -> HashMap<String, HashMap<String, String>> {
        let mut registries = HashMap::new();
        let registry_path = Path::new("registries");

        if registry_path.exists() {
            let registry_files = vec![
                ("delegate-call-whitelist", "delegate-call-whitelist.yaml"),
                ("canonical-factories", "canonical-factories.yaml"),
                ("canonical-mastercopies", "canonical-mastercopies.yaml"),
                ("canonical-fallback-handlers", "canonical-fallback-handlers.yaml"),
                ("canonical-initializers", "canonical-initializers.yaml"),
            ];

            for (key, filename) in registry_files {
                let file_path = registry_path.join(filename);
                if let Ok(content) = fs::read_to_string(&file_path) {
                    if let Ok(registry_file) = serde_yaml::from_str::<RegistryFile>(&content) {
                        let mut entries = HashMap::new();
                        for entry in registry_file.entries {
                            entries.insert(entry.address.to_lowercase(), entry.name);
                        }
                        let entry_count = entries.len();
                        registries.insert(key.to_string(), entries);
                        tracing::info!("Loaded registry {} with {} entries", key, entry_count);
                    } else {
                        tracing::warn!("Failed to parse registry file: {:?}", file_path);
                    }
                } else {
                    tracing::debug!("Registry file not found: {:?}, will use embedded fallback", file_path);
                }
            }
        }

        registries
    }

    fn get_registries() -> &'static HashMap<String, HashMap<String, String>> {
        LOADED_REGISTRIES.get_or_init(Self::load_registries)
    }

    pub fn lookup(registry_name: &str, address: &str) -> Option<&'static str> {
        let registries = Self::get_registries();
        let addr_lower = address.to_lowercase();

        if let Some(registry) = registries.get(registry_name) {
            if let Some(name) = registry.get(&addr_lower) {
                return Some(Box::leak(name.clone().into_boxed_str()));
            }
        }

        match registry_name {
            "delegate-call-whitelist" => SafeAddressRegistry::is_trusted_delegate_call_target(address),
            "canonical-factories" => SafeAddressRegistry::is_canonical_factory(address),
            "canonical-mastercopies" => SafeAddressRegistry::is_canonical_mastercopy(address),
            "canonical-fallback-handlers" => SafeAddressRegistry::is_canonical_fallback_handler(address),
            "canonical-initializers" => SafeAddressRegistry::is_canonical_initializer(address),
            _ => None,
        }
    }

    pub fn available_registries() -> Vec<&'static str> {
        vec![
            "delegate-call-whitelist",
            "canonical-factories",
            "canonical-mastercopies",
            "canonical-fallback-handlers",
            "canonical-initializers",
        ]
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_delegate_call_whitelist_lookup() {
        let result = RegistryResolver::lookup(
            "delegate-call-whitelist",
            "0x40A2aCCbd92BCA938b02010E17A5b8929b49130D"
        );
        assert!(result.is_some());
        assert!(result.unwrap().contains("MultiSendCallOnly"));
    }

    #[test]
    fn test_canonical_factory_lookup() {
        let result = RegistryResolver::lookup(
            "canonical-factories",
            "0xa6B71E26C5e0845f74c812102Ca7114b6a896AB2"
        );
        assert!(result.is_some());
    }

    #[test]
    fn test_unknown_registry() {
        let result = RegistryResolver::lookup("unknown-registry", "0x1234");
        assert!(result.is_none());
    }

    #[test]
    fn test_case_insensitive_lookup() {
        let result = RegistryResolver::lookup(
            "delegate-call-whitelist",
            "0x40a2accbd92bca938b02010e17a5b8929b49130d"
        );
        assert!(result.is_some());
    }
}
