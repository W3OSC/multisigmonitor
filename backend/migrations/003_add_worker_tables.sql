-- Add worker tracking tables
CREATE TABLE IF NOT EXISTS last_checks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    safe_address TEXT NOT NULL,
    network TEXT NOT NULL,
    last_checked_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(safe_address, network)
);

CREATE INDEX IF NOT EXISTS idx_last_checks_safe_network ON last_checks(safe_address, network);

CREATE TABLE IF NOT EXISTS notification_status (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    transaction_hash TEXT NOT NULL,
    safe_address TEXT NOT NULL,
    network TEXT NOT NULL,
    monitor_id TEXT NOT NULL,
    transaction_type TEXT NOT NULL,
    notified_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(transaction_hash, monitor_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_status_tx ON notification_status(transaction_hash);
CREATE INDEX IF NOT EXISTS idx_notification_status_monitor ON notification_status(monitor_id);
