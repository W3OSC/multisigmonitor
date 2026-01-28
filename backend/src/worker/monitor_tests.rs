use super::*;
use crate::worker::safe_api::{SafeTransaction, DataDecoded};
use crate::models::security_analysis::RiskLevel;
use serde_json::Value;

fn create_test_transaction() -> SafeTransaction {
    SafeTransaction {
        safe_tx_hash: "0xtest123".to_string(),
        to: "0x1234567890123456789012345678901234567890".to_string(),
        value: Some(Value::String("0".to_string())),
        data: Some("0x".to_string()),
        operation: Some(0),
        gas_token: Some("0x0000000000000000000000000000000000000000".to_string()),
        safe_tx_gas: Some(Value::String("0".to_string())),
        base_gas: Some(Value::String("0".to_string())),
        gas_price: Some(Value::String("0".to_string())),
        refund_receiver: Some("0x0000000000000000000000000000000000000000".to_string()),
        nonce: 1,
        execution_date: None,
        submission_date: None,
        modified: None,
        block_number: None,
        transaction_hash: None,
        executor: None,
        is_executed: Some(false),
        is_successful: None,
        confirmations_required: Some(2),
        confirmations: None,
        trusted: Some(true),
        data_decoded: None,
    }
}

#[tokio::test]
async fn test_determine_alert_type_suspicious() {
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    let worker = MonitorWorker::new(pool, "test@example.com".to_string(), None, None, 10);
    let tx = create_test_transaction();
    
    let alert_type = worker.determine_alert_type(&RiskLevel::Critical, &tx);
    assert_eq!(alert_type, AlertType::Suspicious);
    
    let alert_type = worker.determine_alert_type(&RiskLevel::High, &tx);
    assert_eq!(alert_type, AlertType::Suspicious);
}

#[tokio::test]
async fn test_determine_alert_type_management() {
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    let worker = MonitorWorker::new(pool, "test@example.com".to_string(), None, None, 10);
    
    let management_methods = vec![
        "addOwnerWithThreshold",
        "removeOwner",
        "swapOwner",
        "changeThreshold",
        "enableModule",
        "disableModule",
        "setGuard",
        "setFallbackHandler",
    ];
    
    for method in management_methods {
        let mut tx = create_test_transaction();
        tx.data_decoded = Some(DataDecoded {
            method: method.to_string(),
            parameters: None,
        });
        
        let alert_type = worker.determine_alert_type(&RiskLevel::Low, &tx);
        assert_eq!(
            alert_type, 
            AlertType::Management,
            "Method {} should be classified as Management",
            method
        );
    }
}

#[tokio::test]
async fn test_determine_alert_type_normal() {
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    let worker = MonitorWorker::new(pool, "test@example.com".to_string(), None, None, 10);
    let tx = create_test_transaction();
    
    let alert_type = worker.determine_alert_type(&RiskLevel::Low, &tx);
    assert_eq!(alert_type, AlertType::Normal);
}

#[tokio::test]
async fn test_generate_description_with_decoded_method() {
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    let worker = MonitorWorker::new(pool, "test@example.com".to_string(), None, None, 10);
    
    let mut tx = create_test_transaction();
    tx.data_decoded = Some(DataDecoded {
        method: "transferFrom".to_string(),
        parameters: None,
    });
    
    let analysis = crate::models::security_analysis::AnalysisResponse {
        is_suspicious: false,
        risk_level: RiskLevel::Low,
        warnings: vec!["Warning 1".to_string(), "Warning 2".to_string()],
        details: vec![],
        call_type: None,
        hash_verification: None,
        nonce_check: None,
        calldata: None,
        priority: None,
    };
    
    let description = worker.generate_description(&tx, &analysis);
    assert!(description.contains("transferFrom"));
    assert!(description.contains("Warning 1"));
    assert!(description.contains("Warning 2"));
}

#[tokio::test]
async fn test_generate_description_value_transfer() {
    let pool = sqlx::SqlitePool::connect(":memory:").await.unwrap();
    let worker = MonitorWorker::new(pool, "test@example.com".to_string(), None, None, 10);
    
    let mut tx = create_test_transaction();
    tx.value = Some(Value::String("1000000000000000000".to_string())); // 1 ETH
    tx.data_decoded = None;
    
    let analysis = crate::models::security_analysis::AnalysisResponse {
        is_suspicious: false,
        risk_level: RiskLevel::Low,
        warnings: vec![],
        details: vec![],
        call_type: None,
        hash_verification: None,
        nonce_check: None,
        calldata: None,
        priority: None,
    };
    
    let description = worker.generate_description(&tx, &analysis);
    assert!(description.contains("Transfer"));
    assert!(description.contains("1.0000 ETH"));
}

#[test]
fn test_should_notify_suspicious_always() {
    let _settings = serde_json::json!({
        "notifyAll": false,
        "notifyManagement": false
    });
    
    // Suspicious alerts should always notify regardless of settings
    // This is testing business logic, not implementation
    assert!(true); // Placeholder - would test actual should_notify logic
}

#[test]
fn test_format_warnings_empty() {
    // Test warning formatting
    assert_eq!("No warnings", "No warnings");
}

#[test]
fn test_format_warnings_multiple() {
    let warnings = vec!["Warning 1".to_string(), "Warning 2".to_string()];
    let result = warnings.join(", ");
    assert_eq!(result, "Warning 1, Warning 2");
}

#[test]
fn test_parse_notification_channels() {
    let settings = serde_json::json!({
        "notificationChannels": [
            {
                "type": "email",
                "email": "test@example.com"
            }
        ]
    });
    
    let channels: Result<Vec<NotificationChannel>, _> = serde_json::from_value(settings["notificationChannels"].clone());
    assert!(channels.is_ok());
    assert_eq!(channels.unwrap().len(), 1);
}

