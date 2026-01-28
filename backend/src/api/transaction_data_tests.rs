#[cfg(test)]
mod tests {
    use sqlx::SqlitePool;
    use serde_json::json;

    #[tokio::test]
    async fn test_store_and_retrieve_transaction_data() {
        let pool = SqlitePool::connect(":memory:").await.unwrap();
        
        sqlx::query(
            "CREATE TABLE transactions (
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
                updated_at TEXT NOT NULL
            )"
        )
        .execute(&pool)
        .await
        .unwrap();

        let transaction_data = json!({
            "safeTxHash": "0xtest123",
            "to": "0x9999999999999999999999999999999999999999",
            "value": "1000000000000000000",
            "safeTxGas": "50000",
            "gasToken": "0x0000000000000000000000000000000000000000",
            "refundReceiver": "0x0000000000000000000000000000000000000000",
            "confirmations": [
                {
                    "owner": "0xaaaa",
                    "submissionDate": "2026-01-25T10:00:00Z"
                }
            ],
            "confirmationsRequired": 2,
            "proposer": "0xbbbb"
        });

        let now = chrono::Utc::now().to_rfc3339();
        
        sqlx::query(
            "INSERT INTO transactions (id, monitor_id, safe_tx_hash, network, safe_address, 
                                       to_address, nonce, is_executed, transaction_data, 
                                       created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind("tx-1")
        .bind("monitor-1")
        .bind("0xtest123")
        .bind("sepolia")
        .bind("0x1234567890123456789012345678901234567890")
        .bind("0x9999999999999999999999999999999999999999")
        .bind(5)
        .bind(0)
        .bind(transaction_data.to_string())
        .bind(&now)
        .bind(&now)
        .execute(&pool)
        .await
        .unwrap();

        #[derive(sqlx::FromRow)]
        struct TransactionRow {
            transaction_data: Option<String>,
        }

        let row: TransactionRow = sqlx::query_as(
            "SELECT transaction_data FROM transactions WHERE id = ?"
        )
        .bind("tx-1")
        .fetch_one(&pool)
        .await
        .unwrap();

        assert!(row.transaction_data.is_some());
        
        let stored_data: serde_json::Value = serde_json::from_str(&row.transaction_data.unwrap()).unwrap();
        assert_eq!(stored_data["safeTxHash"], "0xtest123");
        assert_eq!(stored_data["safeTxGas"], "50000");
        assert_eq!(stored_data["confirmationsRequired"], 2);
        assert_eq!(stored_data["proposer"], "0xbbbb");
        assert!(stored_data["confirmations"].is_array());
        assert_eq!(stored_data["confirmations"].as_array().unwrap().len(), 1);
    }

    #[tokio::test]
    async fn test_transaction_data_serialization_edge_cases() {
        let minimal_data = json!({
            "safeTxHash": "0xminimal"
        });
        let serialized = serde_json::to_string(&minimal_data).unwrap();
        let deserialized: serde_json::Value = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized["safeTxHash"], "0xminimal");

        let complex_data = json!({
            "safeTxHash": "0xcomplex",
            "confirmations": [
                {"owner": "0x1", "signature": "0xsig1"},
                {"owner": "0x2", "signature": "0xsig2"},
                {"owner": "0x3", "signature": "0xsig3"}
            ],
            "dataDecoded": {
                "method": "transfer",
                "parameters": [
                    {"name": "to", "type": "address", "value": "0xrecipient"},
                    {"name": "amount", "type": "uint256", "value": "1000"}
                ]
            }
        });
        let serialized = serde_json::to_string(&complex_data).unwrap();
        let deserialized: serde_json::Value = serde_json::from_str(&serialized).unwrap();
        assert_eq!(deserialized["confirmations"].as_array().unwrap().len(), 3);
        assert!(deserialized["dataDecoded"]["parameters"].is_array());
    }

    #[test]
    fn test_transaction_data_null_handling() {
        let json_with_null: Result<serde_json::Value, _> = serde_json::from_str("null");
        assert!(json_with_null.is_ok());
        assert!(json_with_null.unwrap().is_null());

        let empty_string: Result<serde_json::Value, _> = serde_json::from_str("");
        assert!(empty_string.is_err());
    }
}
