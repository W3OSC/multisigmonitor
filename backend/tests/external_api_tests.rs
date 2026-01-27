use reqwest;
use serde_json;
use std::env;
use dotenvy;

fn load_env() {
    let env_path = "../secrets/.env.backend.local";
    if let Err(e) = dotenvy::from_filename(env_path) {
        eprintln!("Warning: Could not load {}: {}", env_path, e);
    }
}

#[tokio::test]
async fn test_infura_connectivity() {
    load_env();
    
    let api_key = match env::var("INFURA_API_KEY") {
        Ok(key) if !key.is_empty() => key,
        _ => {
            println!("Infura API key not configured - skipping test");
            return;
        }
    };
    
    let client = reqwest::Client::new();
    let url = format!(
        "https://mainnet.infura.io/v3/{}",
        api_key
    );
    
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_blockNumber",
        "params": [],
        "id": 1
    });
    
    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .expect("Failed to send request to Infura");
    
    assert!(response.status().is_success(), "Infura request failed with status: {}", response.status());
    
    let result: serde_json::Value = response.json().await.expect("Failed to parse response");
    
    assert!(result.get("result").is_some(), "Expected 'result' field in Infura response");
    println!("Infura connectivity test passed. Block number: {:?}", result["result"]);
}

#[tokio::test]
async fn test_infura_transaction_receipt() {
    load_env();
    
    let api_key = match env::var("INFURA_API_KEY") {
        Ok(key) if !key.is_empty() => key,
        _ => {
            println!("Infura API key not configured - skipping test");
            return;
        }
    };
    
    let client = reqwest::Client::new();
    let url = format!(
        "https://mainnet.infura.io/v3/{}",
        api_key
    );
    
    let tx_hash = "0x5c504ed432cb51138bcf09aa5e8a410dd4a1e204ef84bfed1be16dfba1b22060";
    
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_getTransactionReceipt",
        "params": [tx_hash],
        "id": 1
    });
    
    let response = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .expect("Failed to send request to Infura");
    
    assert!(response.status().is_success(), "Infura request failed");
    
    let result: serde_json::Value = response.json().await.expect("Failed to parse response");
    
    assert!(result.get("result").is_some(), "Expected 'result' field in transaction receipt response");
    println!("Transaction receipt test passed. Receipt: {:?}", result["result"]);
}

#[tokio::test]
async fn test_infura_rate_limits() {
    load_env();
    
    let api_key = match env::var("INFURA_API_KEY") {
        Ok(key) if !key.is_empty() => key,
        _ => {
            println!("Infura API key not configured - skipping test");
            return;
        }
    };
    
    let client = reqwest::Client::new();
    let url = format!(
        "https://mainnet.infura.io/v3/{}",
        api_key
    );
    
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_blockNumber",
        "params": [],
        "id": 1
    });
    
    let mut rate_limit_headers_found = false;
    let mut rate_limited = false;
    
    for i in 0..5 {
        let response = client
            .post(&url)
            .json(&body)
            .send()
            .await
            .expect("Failed to send request");
        
        let status = response.status();
        let headers = response.headers();
        
        if headers.contains_key("x-ratelimit-limit") || headers.contains_key("x-rate-limit-limit") {
            rate_limit_headers_found = true;
            println!("Rate limit headers found on request {}: {:?}", i + 1, headers);
        }
        
        if status == reqwest::StatusCode::TOO_MANY_REQUESTS {
            rate_limited = true;
            println!("Request {} rate limited (429) - expected behavior", i + 1);
            break;
        }
        
        assert!(status.is_success(), "Request {} failed with unexpected status: {}", i + 1, status);
        
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }
    
    if rate_limit_headers_found {
        println!("Rate limit monitoring test passed - headers detected");
    } else if rate_limited {
        println!("Rate limit test passed - 429 response received");
    } else {
        println!("Note: No explicit rate limit headers found, but requests completed");
    }
}

#[tokio::test]
async fn test_chainalysis_connectivity() {
    load_env();
    
    let api_key = match env::var("CHAINALYSIS_API_KEY") {
        Ok(key) if !key.is_empty() => key,
        _ => {
            println!("Chainalysis API key not configured - skipping test");
            return;
        }
    };
    
    let client = reqwest::Client::new();
    
    let test_address = "0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4dff";
    let url = format!(
        "https://public.chainalysis.com/api/v1/address/{}",
        test_address
    );
    
    let response = client
        .get(&url)
        .header("X-API-Key", api_key)
        .header("Accept", "application/json")
        .send()
        .await
        .expect("Failed to send request to Chainalysis");
    
    let status = response.status();
    println!("Chainalysis response status: {}", status);
    
    assert!(
        status.is_success() || status == 404,
        "Expected success or 404 for unknown address, got: {}",
        status
    );
    
    if status.is_success() {
        let result: serde_json::Value = response.json().await.expect("Failed to parse response");
        println!("Chainalysis connectivity test passed. Response: {:?}", result);
    } else {
        println!("Chainalysis returned 404 - address not in their database (expected for test address)");
    }
}

#[tokio::test]
async fn test_chainalysis_rate_limits() {
    load_env();
    
    let api_key = match env::var("CHAINALYSIS_API_KEY") {
        Ok(key) if !key.is_empty() => key,
        _ => {
            println!("Chainalysis API key not configured - skipping test");
            return;
        }
    };
    
    let client = reqwest::Client::new();
    let test_address = "0x19aa5fe80d33a56d56c78e82ea5e50e5d80b4dff";
    let url = format!(
        "https://public.chainalysis.com/api/v1/address/{}",
        test_address
    );
    
    let mut rate_limit_headers_found = false;
    
    for i in 0..3 {
        let response = client
            .get(&url)
            .header("X-API-Key", &api_key)
            .header("Accept", "application/json")
            .send()
            .await
            .expect("Failed to send request");
        
        let headers = response.headers();
        let status = response.status();
        
        println!("Request {} status: {}", i + 1, status);
        
        if headers.contains_key("x-ratelimit-limit") || 
           headers.contains_key("x-rate-limit-limit") ||
           headers.contains_key("ratelimit-limit") {
            rate_limit_headers_found = true;
            println!("Rate limit headers found on request {}: ", i + 1);
            for (key, value) in headers.iter() {
                let key_str = key.as_str();
                if key_str.to_lowercase().contains("rate") || key_str.to_lowercase().contains("limit") {
                    println!("  {}: {:?}", key, value);
                }
            }
        }
        
        assert!(
            status.is_success() || status == 404 || status == 429,
            "Request {} failed unexpectedly with status: {}",
            i + 1,
            status
        );
        
        if status == 429 {
            println!("Rate limit hit on request {} - this is expected behavior", i + 1);
            break;
        }
        
        tokio::time::sleep(tokio::time::Duration::from_millis(500)).await;
    }
    
    if rate_limit_headers_found {
        println!("Rate limit monitoring test passed - headers detected");
    } else {
        println!("Note: No explicit rate limit headers found, but requests completed");
    }
}

#[tokio::test]
async fn test_infura_error_handling() {
    load_env();
    
    let client = reqwest::Client::new();
    let url = "https://mainnet.infura.io/v3/INVALID_KEY_FOR_TESTING";
    
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": "eth_blockNumber",
        "params": [],
        "id": 1
    });
    
    let response = client
        .post(url)
        .json(&body)
        .send()
        .await
        .expect("Failed to send request");
    
    let status = response.status();
    
    let text = response.text().await.expect("Failed to read response");
    
    if text.contains("error") || text.contains("invalid") || !status.is_success() {
        println!("Infura properly returns errors for invalid API keys");
        println!("  Status: {}", status);
        println!("  Response snippet: {}", &text[..text.len().min(100)]);
    } else {
        println!("Warning: Unexpected response for invalid key");
    }
    
    assert!(
        !status.is_success() || text.contains("error"),
        "Expected error status or error in response for invalid key"
    );
}

#[tokio::test]
async fn test_infura_health_check() {
    load_env();
    
    let api_key = match env::var("INFURA_API_KEY") {
        Ok(key) if !key.is_empty() => key,
        _ => {
            println!("Infura API key not configured - skipping test");
            return;
        }
    };
    
    let client = reqwest::Client::new();
    let url = format!(
        "https://mainnet.infura.io/v3/{}",
        api_key
    );
    
    let mut success_count = 0;
    for _ in 0..3 {
        let body = serde_json::json!({
            "jsonrpc": "2.0",
            "method": "eth_blockNumber",
            "params": [],
            "id": 1
        });
        
        let response = client
            .post(&url)
            .json(&body)
            .send()
            .await;
        
        if let Ok(resp) = response {
            if resp.status().is_success() {
                success_count += 1;
            }
        }
        
        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
    }
    
    assert!(success_count >= 2, "Infura health check failed - only {} of 3 requests succeeded", success_count);
    println!("Infura health check passed: {}/3 requests succeeded", success_count);
}
