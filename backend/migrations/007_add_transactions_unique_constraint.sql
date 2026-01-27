-- Add unique constraint on (safe_tx_hash, monitor_id) to prevent duplicate transaction entries per monitor

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_unique_safe_tx_monitor 
ON transactions(safe_tx_hash, monitor_id);
