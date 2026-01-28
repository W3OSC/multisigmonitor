use ethers::types::{Address, U256};
use ethers::utils::keccak256;
use ethers::abi::{encode, Token};
use serde::{Deserialize, Serialize};

const DOMAIN_SEPARATOR_TYPEHASH: [u8; 32] = hex_literal::hex!("47e79534a245952e8b16893a336b85a3d9ea9fa8c573f3d803afb92a79469218");
const DOMAIN_SEPARATOR_TYPEHASH_OLD: [u8; 32] = hex_literal::hex!("035aff83d86937d35b32e04f0ddc6ff469290eef2f1b692d8a815c89404d4749");
const SAFE_TX_TYPEHASH: [u8; 32] = hex_literal::hex!("bb8310d486368db6bd6f849402fdd73ad53d316b5a4b2644ad6efe0f941286d8");
const SAFE_TX_TYPEHASH_OLD: [u8; 32] = hex_literal::hex!("14d461bc7412367e924637b363c7bf29b8f47e2f84869f4426e5633d8af47b20");

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HashVerificationResult {
    pub verified: bool,
    pub calculated_hashes: CalculatedHashes,
    pub api_hashes: ApiHashes,
    pub chain_id: Option<u64>,
    pub safe_address: String,
    pub safe_version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CalculatedHashes {
    pub domain_hash: String,
    pub message_hash: String,
    pub safe_tx_hash: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiHashes {
    pub safe_tx_hash: String,
}

pub fn verify_transaction_hashes(
    to: &str,
    value: &str,
    data: &str,
    operation: u8,
    safe_tx_gas: &str,
    base_gas: &str,
    gas_price: &str,
    gas_token: &str,
    refund_receiver: &str,
    nonce: u64,
    api_safe_tx_hash: &str,
    safe_address: &str,
    chain_id: u64,
    safe_version: &str,
) -> HashVerificationResult {
    match calculate_all_hashes(
        to,
        value,
        data,
        operation,
        safe_tx_gas,
        base_gas,
        gas_price,
        gas_token,
        refund_receiver,
        nonce,
        safe_address,
        chain_id,
        safe_version,
    ) {
        Ok((domain_hash, message_hash, calculated_safe_tx_hash)) => {
            let calculated_hash_hex = format!("0x{}", hex::encode(calculated_safe_tx_hash));
            let verified = calculated_hash_hex.eq_ignore_ascii_case(api_safe_tx_hash);
            
            HashVerificationResult {
                verified,
                calculated_hashes: CalculatedHashes {
                    domain_hash: format!("0x{}", hex::encode(domain_hash)),
                    message_hash: format!("0x{}", hex::encode(message_hash)),
                    safe_tx_hash: format!("0x{}", hex::encode(calculated_safe_tx_hash)),
                },
                api_hashes: ApiHashes {
                    safe_tx_hash: api_safe_tx_hash.to_string(),
                },
                chain_id: Some(chain_id),
                safe_address: safe_address.to_string(),
                safe_version: Some(safe_version.to_string()),
                error: if !verified {
                    Some("CRITICAL: Safe transaction hash mismatch! Transaction may have been tampered with.".to_string())
                } else {
                    None
                },
            }
        }
        Err(e) => HashVerificationResult {
            verified: false,
            calculated_hashes: CalculatedHashes {
                domain_hash: String::new(),
                message_hash: String::new(),
                safe_tx_hash: String::new(),
            },
            api_hashes: ApiHashes {
                safe_tx_hash: api_safe_tx_hash.to_string(),
            },
            chain_id: Some(chain_id),
            safe_address: safe_address.to_string(),
            safe_version: Some(safe_version.to_string()),
            error: Some(format!("Hash verification failed: {}", e)),
        },
    }
}

fn calculate_all_hashes(
    to: &str,
    value: &str,
    data: &str,
    operation: u8,
    safe_tx_gas: &str,
    base_gas: &str,
    gas_price: &str,
    gas_token: &str,
    refund_receiver: &str,
    nonce: u64,
    safe_address: &str,
    chain_id: u64,
    safe_version: &str,
) -> Result<([u8; 32], [u8; 32], [u8; 32]), String> {
    let domain_hash = calculate_domain_hash(safe_version, chain_id, safe_address)?;
    let message_hash = calculate_message_hash(
        to,
        value,
        data,
        operation,
        safe_tx_gas,
        base_gas,
        gas_price,
        gas_token,
        refund_receiver,
        nonce,
        safe_version,
    )?;
    let safe_tx_hash = calculate_safe_tx_hash(&domain_hash, &message_hash)?;

    Ok((domain_hash, message_hash, safe_tx_hash))
}

fn calculate_domain_hash(version: &str, chain_id: u64, safe_address: &str) -> Result<[u8; 32], String> {
    let address = safe_address
        .parse::<Address>()
        .map_err(|e| format!("Invalid Safe address: {}", e))?;

    let clean_version = parse_version(version);
    
    let domain_data = if compare_versions(&clean_version, "1.2.0") <= 0 {
        encode(&[
            Token::FixedBytes(DOMAIN_SEPARATOR_TYPEHASH_OLD.to_vec()),
            Token::Address(address),
        ])
    } else {
        encode(&[
            Token::FixedBytes(DOMAIN_SEPARATOR_TYPEHASH.to_vec()),
            Token::Uint(U256::from(chain_id)),
            Token::Address(address),
        ])
    };

    Ok(keccak256(&domain_data))
}

fn calculate_message_hash(
    to: &str,
    value: &str,
    data: &str,
    operation: u8,
    safe_tx_gas: &str,
    base_gas: &str,
    gas_price: &str,
    gas_token: &str,
    refund_receiver: &str,
    nonce: u64,
    version: &str,
) -> Result<[u8; 32], String> {
    let to_address = to.parse::<Address>().map_err(|e| format!("Invalid to address: {}", e))?;
    let value_uint = parse_uint_string(value)?;
    let data_bytes = hex::decode(data.trim_start_matches("0x")).map_err(|e| format!("Invalid data hex: {}", e))?;
    let data_hash = keccak256(&data_bytes);
    let safe_tx_gas_uint = parse_uint_string(safe_tx_gas)?;
    let base_gas_uint = parse_uint_string(base_gas)?;
    let gas_price_uint = parse_uint_string(gas_price)?;
    let gas_token_address = gas_token.parse::<Address>().map_err(|e| format!("Invalid gas token: {}", e))?;
    let refund_receiver_address = refund_receiver.parse::<Address>().map_err(|e| format!("Invalid refund receiver: {}", e))?;

    let clean_version = parse_version(version);
    let safe_tx_typehash = if compare_versions(&clean_version, "1.0.0") < 0 {
        SAFE_TX_TYPEHASH_OLD
    } else {
        SAFE_TX_TYPEHASH
    };

    let encoded = encode(&[
        Token::FixedBytes(safe_tx_typehash.to_vec()),
        Token::Address(to_address),
        Token::Uint(value_uint),
        Token::FixedBytes(data_hash.to_vec()),
        Token::Uint(U256::from(operation)),
        Token::Uint(safe_tx_gas_uint),
        Token::Uint(base_gas_uint),
        Token::Uint(gas_price_uint),
        Token::Address(gas_token_address),
        Token::Address(refund_receiver_address),
        Token::Uint(U256::from(nonce)),
    ]);

    Ok(keccak256(&encoded))
}

fn calculate_safe_tx_hash(domain_hash: &[u8; 32], message_hash: &[u8; 32]) -> Result<[u8; 32], String> {
    let mut data = Vec::with_capacity(66);
    data.push(0x19);
    data.push(0x01);
    data.extend_from_slice(domain_hash);
    data.extend_from_slice(message_hash);
    
    Ok(keccak256(&data))
}

fn parse_version(version: &str) -> String {
    version
        .trim()
        .replace(['v', 'V'], "")
        .split('+')
        .next()
        .unwrap_or("1.3.0")
        .to_string()
}

fn compare_versions(v1: &str, v2: &str) -> i32 {
    let v1_parts: Vec<u32> = v1.split('.').filter_map(|s| s.parse().ok()).collect();
    let v2_parts: Vec<u32> = v2.split('.').filter_map(|s| s.parse().ok()).collect();

    for i in 0..v1_parts.len().max(v2_parts.len()) {
        let p1 = v1_parts.get(i).copied().unwrap_or(0);
        let p2 = v2_parts.get(i).copied().unwrap_or(0);
        
        match p1.cmp(&p2) {
            std::cmp::Ordering::Greater => return 1,
            std::cmp::Ordering::Less => return -1,
            std::cmp::Ordering::Equal => continue,
        }
    }
    
    0
}

fn parse_uint_string(s: &str) -> Result<U256, String> {
    if s.is_empty() || s == "0x" || s == "0x0" {
        return Ok(U256::zero());
    }
    
    let cleaned = s.trim_start_matches("0x");
    U256::from_str_radix(cleaned, if s.starts_with("0x") { 16 } else { 10 })
        .map_err(|e| format!("Failed to parse uint: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_version_comparison() {
        assert_eq!(compare_versions("1.3.0", "1.2.0"), 1);
        assert_eq!(compare_versions("1.2.0", "1.3.0"), -1);
        assert_eq!(compare_versions("1.3.0", "1.3.0"), 0);
    }

    #[test]
    fn test_parse_version() {
        assert_eq!(parse_version("v1.3.0"), "1.3.0");
        assert_eq!(parse_version("1.3.0+L2"), "1.3.0");
        assert_eq!(parse_version("V1.4.1"), "1.4.1");
    }
}
