-- Fix transactions table unique constraint - should be on (safe_tx_hash, monitor_id) not (safe_tx_hash, network)
-- SQLite doesn't support dropping constraints, so we need to recreate the table

-- Create new table with correct schema
CREATE TABLE transactions_new (
    id TEXT PRIMARY KEY NOT NULL,
    monitor_id TEXT NOT NULL,
    safe_tx_hash TEXT NOT NULL,
    network TEXT NOT NULL,
    safe_address TEXT NOT NULL,
    to_address TEXT,
    value TEXT,
    data TEXT,
    operation INTEGER,
    nonce INTEGER,
    execution_date DATETIME,
    submission_date DATETIME,
    confirmations_required INTEGER,
    confirmations TEXT,
    is_executed BOOLEAN NOT NULL DEFAULT 0,
    is_successful BOOLEAN,
    transaction_hash TEXT,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    transaction_data TEXT,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
    UNIQUE(safe_tx_hash, monitor_id)
);

-- Copy data
INSERT INTO transactions_new SELECT * FROM transactions;

-- Drop old table
DROP TABLE transactions;

-- Rename new table
ALTER TABLE transactions_new RENAME TO transactions;

-- Recreate indexes
CREATE INDEX idx_transactions_monitor_id ON transactions(monitor_id);
CREATE INDEX idx_transactions_safe_tx_hash ON transactions(safe_tx_hash);
CREATE INDEX idx_transactions_safe_address ON transactions(safe_address);
CREATE INDEX idx_transactions_network ON transactions(network);
