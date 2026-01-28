-- Fix last_checks table schema to match code expectations
DROP TABLE IF EXISTS last_checks;

CREATE TABLE IF NOT EXISTS last_checks (
    id TEXT PRIMARY KEY NOT NULL,
    monitor_id TEXT NOT NULL,
    safe_address TEXT NOT NULL,
    network TEXT NOT NULL,
    checked_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(monitor_id),
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_last_checks_monitor_id ON last_checks(monitor_id);
CREATE INDEX IF NOT EXISTS idx_last_checks_safe_network ON last_checks(safe_address, network);
