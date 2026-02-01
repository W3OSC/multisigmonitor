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
async fn test_mailjet_api_keys() {
    load_env();
    
    let api_key = env::var("MAILJET_API_KEY")
        .expect("MAILJET_API_KEY must be set in ../secrets/.env.backend.local");
    assert!(!api_key.is_empty(), "MAILJET_API_KEY cannot be empty");
    
    let secret_key = env::var("MAILJET_SECRET_KEY")
        .expect("MAILJET_SECRET_KEY must be set in ../secrets/.env.backend.local");
    assert!(!secret_key.is_empty(), "MAILJET_SECRET_KEY cannot be empty");
    
    let from_email = env::var("DEFAULT_FROM_EMAIL").unwrap_or_else(|_| "noreply@multisigmonitor.local".to_string());
    
    let payload = serde_json::json!({
        "Messages": [{
            "From": {
                "Email": from_email,
                "Name": "Multisig Monitor Test"
            },
            "To": [{
                "Email": "tomer@auditware.io"
            }],
            "Subject": "Mailjet API Test",
            "TextPart": "This is a test email to verify Mailjet API credentials are working correctly.",
            "HTMLPart": "<h3>Mailjet API Test</h3><p>This is a test email to verify Mailjet API credentials are working correctly.</p>"
        }]
    });
    
    let client = reqwest::Client::new();
    let response = client
        .post("https://api.mailjet.com/v3.1/send")
        .basic_auth(&api_key, Some(&secret_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await
        .expect("Failed to send request to Mailjet");
    
    assert!(
        response.status().is_success(),
        "Mailjet request failed with status: {}. Body: {}",
        response.status(),
        response.text().await.unwrap_or_default()
    );
    
    let result: serde_json::Value = response.json().await.expect("Failed to parse Mailjet response");
    
    assert!(result.get("Messages").is_some(), "Expected 'Messages' field in Mailjet response");
    assert!(result["Messages"].is_array(), "Expected 'Messages' to be an array");
    
    let status = result["Messages"][0]["Status"]
        .as_str()
        .expect("Expected 'Status' field in message");
    
    assert_eq!(status, "success", "Expected message status to be 'success'");
    
    println!("✓ Mailjet API test passed. Email sent successfully.");
    println!("  Message ID: {}", result["Messages"][0]["To"][0]["MessageID"]);
}
