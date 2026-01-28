use sqlx::SqlitePool;
use crate::worker::{SafeApiClient, NotificationService, Alert};
use crate::worker::notifications::{AlertType, NotificationChannel};
use crate::services::security_analysis::{SecurityAnalysisService, AnalysisOptions};
use crate::models::security_analysis::{SafeTransaction as ModelTransaction, DataDecoded, Parameter, RiskLevel, AnalysisResponse};
use futures::stream::{self, StreamExt};
use futures::future::join_all;
use uuid;

pub struct MonitorWorker {
    pool: SqlitePool,
    safe_api: SafeApiClient,
    notification_service: NotificationService,
    security_service: SecurityAnalysisService,
    concurrency: usize,
}

impl MonitorWorker {
    pub fn new(
        pool: SqlitePool,
        from_email: String,
        mailjet_api_key: Option<String>,
        mailjet_secret_key: Option<String>,
        concurrency: usize,
    ) -> Self {
        Self {
            pool,
            safe_api: SafeApiClient::new(),
            notification_service: NotificationService::new(from_email, mailjet_api_key, mailjet_secret_key),
            security_service: SecurityAnalysisService::new(),
            concurrency,
        }
    }

    pub async fn run_check(&self) -> Result<(), Box<dyn std::error::Error>> {
        tracing::info!("Starting monitor check cycle");

        let monitors = self.get_active_monitors().await?;
        tracing::info!("Found {} active monitors", monitors.len());

        if monitors.is_empty() {
            return Ok(());
        }

        let address_network_pairs = self.group_monitors_by_address_network(monitors);
        let pairs_vec: Vec<_> = address_network_pairs.into_iter().collect();

        tracing::info!("Processing {} Safe addresses with concurrency limit of {}", pairs_vec.len(), self.concurrency);

        stream::iter(pairs_vec)
            .map(|(key, group)| async move {
                let parts: Vec<&str> = key.split('-').collect();
                let safe_address = parts[0];
                let network = parts[1];

                if let Err(e) = self.process_safe(safe_address, network, &group.monitors).await {
                    tracing::error!("Error processing {} on {}: {}", safe_address, network, e);
                }
            })
            .buffer_unordered(self.concurrency)
            .collect::<Vec<_>>()
            .await;

        tracing::info!("Monitor check cycle completed");
        Ok(())
    }

    async fn get_active_monitors(&self) -> Result<Vec<MonitorData>, Box<dyn std::error::Error>> {
        let monitors = sqlx::query_as::<_, MonitorData>(
            "SELECT id, user_id, safe_address, network, settings FROM monitors WHERE json_extract(settings, '$.active') != false"
        )
        .fetch_all(&self.pool)
        .await?;

        Ok(monitors)
    }

    fn group_monitors_by_address_network(&self, monitors: Vec<MonitorData>) -> std::collections::HashMap<String, MonitorGroup> {
        let mut groups: std::collections::HashMap<String, MonitorGroup> = std::collections::HashMap::new();

        for monitor in monitors {
            let key = format!("{}-{}", monitor.safe_address.to_lowercase(), monitor.network.to_lowercase());
            groups.entry(key).or_insert_with(|| MonitorGroup {
                safe_address: monitor.safe_address.clone(),
                network: monitor.network.clone(),
                monitors: Vec::new(),
            }).monitors.push(monitor);
        }

        groups
    }

    async fn process_safe(
        &self,
        safe_address: &str,
        network: &str,
        monitors: &[MonitorData],
    ) -> Result<(), Box<dyn std::error::Error>> {
        tracing::info!("Processing Safe {} on {}", safe_address, network);

        for monitor in monitors {
            self.update_last_check(&monitor.id, safe_address, network).await?;
        }

        let all_transactions = self.safe_api.fetch_all_transactions(safe_address, network, 50).await?;
        tracing::info!("Found {} total transactions", all_transactions.len());

        let pending_transactions: Vec<_> = all_transactions.iter()
            .filter(|tx| !tx.is_executed.unwrap_or(false))
            .collect();
        tracing::info!("Found {} pending transactions", pending_transactions.len());

        let safe_info = self.safe_api.fetch_safe_info(safe_address, network).await.ok();
        let safe_version = safe_info.as_ref().and_then(|info| info.version.clone()).unwrap_or_else(|| "1.3.0".to_string());
        let chain_id = self.safe_api.get_chain_id(network).unwrap_or(1);

        tracing::info!("Starting transaction loop for {} transactions", all_transactions.len());
        for (idx, transaction) in all_transactions.iter().enumerate() {
            tracing::info!("Processing transaction {}/{}: {}", idx + 1, all_transactions.len(), transaction.safe_tx_hash);
            
            for monitor in monitors {
                tracing::info!("Storing transaction for monitor {}", monitor.id);
                match self.store_transaction(transaction, &monitor.id, network, safe_address).await {
                    Ok(_) => tracing::info!("Transaction stored successfully"),
                    Err(e) => {
                        tracing::error!("Failed to store transaction: {:?}", e);
                        return Err(e);
                    }
                }
            }
            
            let model_tx = self.convert_to_model_transaction(transaction);
            tracing::info!("Running security analysis");
            let analysis = self.security_service.analyze_transaction(
                &model_tx,
                safe_address,
                AnalysisOptions {
                    chain_id: Some(chain_id),
                    safe_version: Some(safe_version.clone()),
                    previous_nonce: None,
                },
            );

            let user_id = &monitors[0].user_id;
            tracing::info!("Storing security analysis");
            match self.store_security_analysis(safe_address, network, &transaction.safe_tx_hash, &analysis, user_id).await {
                Ok(_) => tracing::info!("Security analysis stored successfully"),
                Err(e) => {
                    tracing::error!("Failed to store security analysis: {:?}", e);
                    return Err(e);
                }
            }
        }
        tracing::info!("Completed transaction loop");

        for transaction in pending_transactions {
            if self.was_notified(&transaction.safe_tx_hash, safe_address, network).await? {
                tracing::debug!("Transaction {} already notified, skipping", transaction.safe_tx_hash);
                continue;
            }

            let model_tx = self.convert_to_model_transaction(transaction);
            let analysis = self.security_service.analyze_transaction(
                &model_tx,
                safe_address,
                AnalysisOptions {
                    chain_id: Some(chain_id),
                    safe_version: Some(safe_version.clone()),
                    previous_nonce: None,
                },
            );

            let alert_type = self.determine_alert_type(&analysis.risk_level, transaction);
            let description = self.generate_description(transaction, &analysis);

            let alert = Alert {
                safe_address: safe_address.to_string(),
                network: network.to_string(),
                transaction_hash: transaction.safe_tx_hash.clone(),
                alert_type: alert_type.clone(),
                description,
                nonce: transaction.nonce,
                is_executed: transaction.is_executed.unwrap_or(false),
            };

            for monitor in monitors {
                if self.should_notify(&alert_type, &monitor.settings) {
                    self.send_notifications(&alert, &monitor).await?;
                    self.record_notification(&transaction.safe_tx_hash, safe_address, network, &monitor.id, &alert_type).await?;
                }
            }
        }

        Ok(())
    }

    async fn update_last_check(&self, monitor_id: &str, safe_address: &str, network: &str) -> Result<(), Box<dyn std::error::Error>> {
        let now = chrono::Utc::now().to_rfc3339();
        let id = uuid::Uuid::new_v4().to_string();

        sqlx::query(
            "INSERT INTO last_checks (id, monitor_id, safe_address, network, checked_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(monitor_id) DO UPDATE SET 
                checked_at = excluded.checked_at,
                updated_at = excluded.updated_at"
        )
        .bind(&id)
        .bind(monitor_id)
        .bind(safe_address)
        .bind(network)
        .bind(&now)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn was_notified(
        &self,
        transaction_hash: &str,
        safe_address: &str,
        network: &str,
    ) -> Result<bool, Box<dyn std::error::Error>> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM notification_status WHERE transaction_hash = ? AND safe_address = ? AND network = ?"
        )
        .bind(transaction_hash)
        .bind(safe_address)
        .bind(network)
        .fetch_one(&self.pool)
        .await?;

        Ok(count.0 > 0)
    }

    async fn record_notification(
        &self,
        transaction_hash: &str,
        safe_address: &str,
        network: &str,
        monitor_id: &str,
        alert_type: &AlertType,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let now = chrono::Utc::now().to_rfc3339();
        let tx_type = match alert_type {
            AlertType::Suspicious => "suspicious",
            AlertType::Management => "management",
            AlertType::Normal => "normal",
        };

        sqlx::query(
            "INSERT INTO notification_status (transaction_hash, safe_address, network, monitor_id, transaction_type, notified_at)
             VALUES (?, ?, ?, ?, ?, ?)"
        )
        .bind(transaction_hash)
        .bind(safe_address)
        .bind(network)
        .bind(monitor_id)
        .bind(tx_type)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn store_transaction(
        &self,
        transaction: &crate::worker::safe_api::SafeTransaction,
        monitor_id: &str,
        network: &str,
        safe_address: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        
        let transaction_data = serde_json::to_string(transaction)?;
        
        let value_str = transaction.value.as_ref().and_then(|v| {
            v.as_str().map(|s| s.to_string())
                .or_else(|| v.as_u64().map(|n| n.to_string()))
                .or_else(|| v.as_i64().map(|n| n.to_string()))
        });

        sqlx::query(
            "INSERT INTO transactions (id, monitor_id, safe_tx_hash, network, safe_address, 
                                      to_address, value, data, operation, nonce, 
                                      is_executed, submission_date, execution_date, 
                                      transaction_data, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(safe_tx_hash, monitor_id) DO UPDATE SET 
                is_executed = excluded.is_executed,
                execution_date = excluded.execution_date,
                transaction_data = excluded.transaction_data,
                updated_at = excluded.updated_at"
        )
        .bind(&id)
        .bind(monitor_id)
        .bind(&transaction.safe_tx_hash)
        .bind(network)
        .bind(safe_address)
        .bind(&transaction.to)
        .bind(value_str.as_deref())
        .bind(transaction.data.as_deref())
        .bind(transaction.operation.map(|o| o as i64))
        .bind(transaction.nonce as i64)
        .bind(transaction.is_executed.unwrap_or(false))
        .bind(transaction.submission_date.as_deref())
        .bind(transaction.execution_date.as_deref())
        .bind(&transaction_data)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    async fn store_security_analysis(
        &self,
        safe_address: &str,
        network: &str,
        transaction_hash: &str,
        analysis: &AnalysisResponse,
        user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let id = uuid::Uuid::new_v4().to_string();
        let now = chrono::Utc::now().to_rfc3339();
        
        let risk_level_str = match analysis.risk_level {
            RiskLevel::Low => "low",
            RiskLevel::Medium => "medium",
            RiskLevel::High => "high",
            RiskLevel::Critical => "critical",
        };

        let warnings_json = serde_json::to_string(&analysis.warnings)?;
        let details_json = serde_json::to_string(&analysis.details)?;

        let result = sqlx::query(
            "INSERT INTO security_analyses (id, safe_address, network, transaction_hash, safe_tx_hash,
                                           is_suspicious, risk_level, warnings, details, call_type,
                                           hash_verification, nonce_check, calldata, user_id, analyzed_at, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
        )
        .bind(&id)
        .bind(safe_address)
        .bind(network)
        .bind(transaction_hash)
        .bind(transaction_hash)
        .bind(analysis.is_suspicious)
        .bind(risk_level_str)
        .bind(&warnings_json)
        .bind(&details_json)
        .bind(analysis.call_type.as_ref().map(|ct| serde_json::to_string(ct).unwrap_or_else(|_| "null".to_string())))
        .bind(analysis.hash_verification.as_ref().map(|hv| serde_json::to_string(hv).unwrap()))
        .bind(analysis.nonce_check.as_ref().map(|nc| serde_json::to_string(nc).unwrap()))
        .bind(analysis.calldata.as_ref().map(|cd| serde_json::to_string(cd).unwrap()))
        .bind(user_id)
        .bind(&now)
        .bind(&now)
        .execute(&self.pool)
        .await;
        
        match result {
            Ok(_) => {},
            Err(e) => {
                if !e.to_string().contains("UNIQUE constraint failed") {
                    return Err(e.into());
                }
            }
        }

        Ok(())
    }

    fn convert_to_model_transaction(&self, tx: &crate::worker::safe_api::SafeTransaction) -> ModelTransaction {
        let value_as_string = tx.value.as_ref().and_then(|v| {
            v.as_str().map(|s| s.to_string())
                .or_else(|| v.as_u64().map(|n| n.to_string()))
                .or_else(|| v.as_i64().map(|n| n.to_string()))
        });

        let safe_tx_gas_as_string = tx.safe_tx_gas.as_ref().and_then(|v| {
            v.as_str().map(|s| s.to_string())
                .or_else(|| v.as_u64().map(|n| n.to_string()))
                .or_else(|| v.as_i64().map(|n| n.to_string()))
        });

        let base_gas_as_string = tx.base_gas.as_ref().and_then(|v| {
            v.as_str().map(|s| s.to_string())
                .or_else(|| v.as_u64().map(|n| n.to_string()))
                .or_else(|| v.as_i64().map(|n| n.to_string()))
        });

        let gas_price_as_string = tx.gas_price.as_ref().and_then(|v| {
            v.as_str().map(|s| s.to_string())
                .or_else(|| v.as_u64().map(|n| n.to_string()))
                .or_else(|| v.as_i64().map(|n| n.to_string()))
        });

        ModelTransaction {
            to: tx.to.clone(),
            value: value_as_string,
            data: tx.data.clone(),
            data_decoded: tx.data_decoded.as_ref().map(|dd| DataDecoded {
                method: dd.method.clone(),
                parameters: dd.parameters.as_ref().map(|params| {
                    params.iter().map(|p| Parameter {
                        name: p.name.clone(),
                        r#type: p.r#type.clone(),
                        value: p.value.clone(),
                    }).collect()
                }),
            }),
            operation: tx.operation,
            gas_token: tx.gas_token.clone(),
            safe_tx_gas: safe_tx_gas_as_string,
            base_gas: base_gas_as_string,
            gas_price: gas_price_as_string,
            refund_receiver: tx.refund_receiver.clone(),
            nonce: Some(tx.nonce),
            safe_tx_hash: Some(tx.safe_tx_hash.clone()),
            trusted: tx.trusted,
        }
    }

    fn determine_alert_type(&self, risk_level: &RiskLevel, tx: &crate::worker::safe_api::SafeTransaction) -> AlertType {
        if matches!(risk_level, RiskLevel::Critical | RiskLevel::High) {
            return AlertType::Suspicious;
        }

        if let Some(data_decoded) = &tx.data_decoded {
            let management_methods = [
                "addOwnerWithThreshold", "removeOwner", "swapOwner", "changeThreshold",
                "enableModule", "disableModule", "setGuard", "setFallbackHandler",
                "changeMasterCopy", "setup"
            ];

            if management_methods.contains(&data_decoded.method.as_str()) {
                return AlertType::Management;
            }
        }

        AlertType::Normal
    }

    fn generate_description(&self, tx: &crate::worker::safe_api::SafeTransaction, analysis: &AnalysisResponse) -> String {
        if let Some(data_decoded) = &tx.data_decoded {
            return format!("{} - {}", data_decoded.method, self.format_warnings(&analysis.warnings));
        }

        if let Some(value) = &tx.value {
            let value_str = value.as_str()
                .map(|s| s.to_string())
                .or_else(|| value.as_u64().map(|n| n.to_string()))
                .or_else(|| value.as_i64().map(|n| n.to_string()));
            
            if let Some(value_str) = value_str {
                if let Ok(value_u128) = value_str.parse::<u128>() {
                    let value_eth = value_u128 as f64 / 1e18;
                    if value_eth > 0.0 {
                        return format!("Transfer {:.4} ETH to {}", value_eth, tx.to);
                    }
                }
            }
        }

        format!("Transaction to {}", tx.to)
    }

    fn format_warnings(&self, warnings: &[String]) -> String {
        if warnings.is_empty() {
            return "No warnings".to_string();
        }
        warnings.join(", ")
    }

    fn should_notify(&self, alert_type: &AlertType, settings: &serde_json::Value) -> bool {
        match alert_type {
            AlertType::Suspicious => true,
            AlertType::Management => settings.get("notifyManagement").and_then(|v| v.as_bool()).unwrap_or(true),
            AlertType::Normal => settings.get("notifyAll").and_then(|v| v.as_bool()).unwrap_or(false),
        }
    }

    async fn send_notifications(&self, alert: &Alert, monitor: &MonitorData) -> Result<(), Box<dyn std::error::Error>> {
        let channels = self.parse_notification_channels(&monitor.settings)?;

        let notification_futures: Vec<_> = channels.iter()
            .map(|channel| async move {
                match self.notification_service.send_notification(alert, channel).await {
                    Ok(_) => {
                        tracing::info!("Notification sent to monitor {} for transaction {}", monitor.id, alert.transaction_hash);
                    }
                    Err(e) => {
                        tracing::error!("Failed to send notification to monitor {}: {}", monitor.id, e);
                    }
                }
            })
            .collect();

        join_all(notification_futures).await;

        Ok(())
    }

    fn parse_notification_channels(&self, settings: &serde_json::Value) -> Result<Vec<NotificationChannel>, Box<dyn std::error::Error>> {
        let channels_value = settings.get("notificationChannels")
            .ok_or("No notification channels configured")?;

        let channels: Vec<NotificationChannel> = serde_json::from_value(channels_value.clone())?;
        Ok(channels)
    }
}

#[derive(sqlx::FromRow)]
struct MonitorData {
    id: String,
    user_id: String,
    safe_address: String,
    network: String,
    settings: serde_json::Value,
}

struct MonitorGroup {
    safe_address: String,
    network: String,
    monitors: Vec<MonitorData>,
}

#[cfg(test)]
#[path = "monitor_tests.rs"]
mod tests;
