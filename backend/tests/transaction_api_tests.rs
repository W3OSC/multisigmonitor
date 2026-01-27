use axum::{
    body::Body,
    http::{Request, StatusCode},
};
use serde_json::json;
use tower::ServiceExt;
use multisigmonitor_backend::api::create_app;
use sqlx::SqlitePool;

async fn setup_test_db() -> SqlitePool {
    let pool = SqlitePool::connect(":memory:").await.unwrap();
    
    sqlx::query(
        "CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            created_at TEXT NOT NULL
        )"
    )
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS monitors (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            safe_address TEXT NOT NULL,
            network TEXT NOT NULL,
            alias TEXT,
            settings TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )"
    )
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS transactions (
            id TEXT PRIMARY KEY,
            monitor_id TEXT NOT NULL,
            safe_tx_hash TEXT NOT NULL,
            network TEXT NOT NULL,
            safe_address TEXT NOT NULL,
            to_address TEXT NOT NULL,
            value TEXT,
            data TEXT,
            operation INTEGER,
            nonce INTEGER NOT NULL,
            is_executed INTEGER NOT NULL DEFAULT 0,
            submission_date TEXT,
            execution_date TEXT,
            transaction_data TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            UNIQUE(safe_tx_hash, monitor_id),
            FOREIGN KEY (monitor_id) REFERENCES monitors(id)
        )"
    )
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        "CREATE TABLE IF NOT EXISTS security_analyses (
            id TEXT PRIMARY KEY,
            safe_address TEXT NOT NULL,
            network TEXT NOT NULL,
            transaction_hash TEXT NOT NULL,
            safe_tx_hash TEXT,
            is_suspicious INTEGER NOT NULL,
            risk_level TEXT NOT NULL,
            warnings TEXT NOT NULL,
            details TEXT,
            call_type TEXT,
            hash_verification TEXT,
            nonce_check TEXT,
            calldata TEXT,
            priority TEXT,
            created_at TEXT NOT NULL,
            UNIQUE(transaction_hash, safe_address)
        )"
    )
    .execute(&pool)
    .await
    .unwrap();

    let user_id = "test-user-123";
    let now = chrono::Utc::now().to_rfc3339();
    
    sqlx::query("INSERT INTO users (id, email, created_at) VALUES (?, ?, ?)")
        .bind(user_id)
        .bind("test@example.com")
        .bind(&now)
        .execute(&pool)
        .await
        .unwrap();

    let monitor_id = "test-monitor-123";
    let safe_address = "0x1234567890123456789012345678901234567890";
    let network = "sepolia";
    
    sqlx::query(
        "INSERT INTO monitors (id, user_id, safe_address, network, alias, settings, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind(monitor_id)
    .bind(user_id)
    .bind(safe_address)
    .bind(network)
    .bind("Test Safe")
    .bind(r#"{"active":true}"#)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    let transaction_data = json!({
        "safeTxHash": "0xabc123",
        "to": "0x9999999999999999999999999999999999999999",
        "value": "1000000000000000000",
        "data": "0x",
        "operation": 0,
        "gasToken": "0x0000000000000000000000000000000000000000",
        "safeTxGas": "0",
        "baseGas": "0",
        "gasPrice": "0",
        "refundReceiver": "0x0000000000000000000000000000000000000000",
        "nonce": 5,
        "confirmations": [
            {
                "owner": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "submissionDate": "2026-01-25T10:00:00Z",
                "signature": "0xsig1"
            }
        ],
        "confirmationsRequired": 2,
        "proposer": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
    });

    sqlx::query(
        "INSERT INTO transactions (id, monitor_id, safe_tx_hash, network, safe_address, to_address, 
                                   value, data, operation, nonce, is_executed, submission_date, 
                                   transaction_data, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind("tx-1")
    .bind(monitor_id)
    .bind("0xabc123")
    .bind(network)
    .bind(safe_address)
    .bind("0x9999999999999999999999999999999999999999")
    .bind("1000000000000000000")
    .bind("0x")
    .bind(0)
    .bind(5)
    .bind(0)
    .bind("2026-01-25T10:00:00Z")
    .bind(transaction_data.to_string())
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    let warnings = json!(["High value transfer", "Unknown recipient"]);
    
    sqlx::query(
        "INSERT INTO security_analyses (id, safe_address, network, transaction_hash, safe_tx_hash,
                                        is_suspicious, risk_level, warnings, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind("sa-1")
    .bind(safe_address)
    .bind(network)
    .bind("0xabc123")
    .bind("0xabc123")
    .bind(1)
    .bind("high")
    .bind(warnings.to_string())
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    pool
}

#[tokio::test]
async fn test_list_transactions_returns_transaction_data() {
    let pool = setup_test_db().await;
    let app = create_app(pool, "mock_secret".to_string());

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/transactions")
                .header("Cookie", "session_id=mock_session")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let transactions: serde_json::Value = serde_json::from_slice(&body).unwrap();
    
    assert!(transactions.is_array());
    let tx_array = transactions.as_array().unwrap();
    assert_eq!(tx_array.len(), 1);
    
    let tx = &tx_array[0];
    assert_eq!(tx["safe_tx_hash"], "0xabc123");
    assert_eq!(tx["nonce"], 5);
    assert_eq!(tx["value"], "1000000000000000000");
    
    assert!(tx["transaction_data"].is_object());
    let tx_data = &tx["transaction_data"];
    assert_eq!(tx_data["safeTxGas"], "0");
    assert_eq!(tx_data["gasToken"], "0x0000000000000000000000000000000000000000");
    assert_eq!(tx_data["confirmationsRequired"], 2);
    assert!(tx_data["confirmations"].is_array());
    assert_eq!(tx_data["confirmations"].as_array().unwrap().len(), 1);
    assert_eq!(tx_data["proposer"], "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    
    assert!(tx["security_analysis"].is_object());
    let sec_analysis = &tx["security_analysis"];
    assert_eq!(sec_analysis["is_suspicious"], true);
    assert_eq!(sec_analysis["risk_level"], "high");
    assert!(sec_analysis["warnings"].is_array());
}

#[tokio::test]
async fn test_get_transaction_by_id_returns_full_data() {
    let pool = setup_test_db().await;
    let app = create_app(pool, "mock_secret".to_string());

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/transactions/tx-1")
                .header("Cookie", "session_id=mock_session")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let tx: serde_json::Value = serde_json::from_slice(&body).unwrap();
    
    assert_eq!(tx["id"], "tx-1");
    assert_eq!(tx["safe_tx_hash"], "0xabc123");
    
    assert!(tx["transaction_data"].is_object());
    let tx_data = &tx["transaction_data"];
    assert_eq!(tx_data["safeTxGas"], "0");
    assert_eq!(tx_data["refundReceiver"], "0x0000000000000000000000000000000000000000");
    assert_eq!(tx_data["proposer"], "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
}

#[tokio::test]
async fn test_transaction_data_json_deserialization() {
    let transaction_data_str = r#"{
        "safeTxHash": "0xtest",
        "safeTxGas": "100000",
        "gasToken": "0x0000000000000000000000000000000000000000",
        "refundReceiver": "0x1111111111111111111111111111111111111111",
        "confirmations": [
            {"owner": "0xowner1", "signature": "0xsig1"}
        ],
        "proposer": "0xproposer"
    }"#;

    let parsed: Result<serde_json::Value, _> = serde_json::from_str(transaction_data_str);
    assert!(parsed.is_ok());
    
    let json_value = parsed.unwrap();
    assert_eq!(json_value["safeTxGas"], "100000");
    assert_eq!(json_value["gasToken"], "0x0000000000000000000000000000000000000000");
    assert_eq!(json_value["refundReceiver"], "0x1111111111111111111111111111111111111111");
    assert_eq!(json_value["proposer"], "0xproposer");
    assert!(json_value["confirmations"].is_array());
}

#[tokio::test]
async fn test_transaction_without_transaction_data() {
    let pool = setup_test_db().await;
    let monitor_id = "test-monitor-123";
    let now = chrono::Utc::now().to_rfc3339();

    sqlx::query(
        "INSERT INTO transactions (id, monitor_id, safe_tx_hash, network, safe_address, to_address, 
                                   nonce, is_executed, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .bind("tx-no-data")
    .bind(monitor_id)
    .bind("0xnodata")
    .bind("sepolia")
    .bind("0x1234567890123456789012345678901234567890")
    .bind("0x9999999999999999999999999999999999999999")
    .bind(10)
    .bind(0)
    .bind(&now)
    .bind(&now)
    .execute(&pool)
    .await
    .unwrap();

    let app = create_app(pool, "mock_secret".to_string());

    let response = app
        .oneshot(
            Request::builder()
                .uri("/api/transactions")
                .header("Cookie", "session_id=mock_session")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();

    assert_eq!(response.status(), StatusCode::OK);

    let body = axum::body::to_bytes(response.into_body(), usize::MAX)
        .await
        .unwrap();
    let transactions: serde_json::Value = serde_json::from_slice(&body).unwrap();
    
    let tx_array = transactions.as_array().unwrap();
    let tx_no_data = tx_array.iter().find(|tx| tx["id"] == "tx-no-data").unwrap();
    
    assert!(tx_no_data["transaction_data"].is_null());
}
