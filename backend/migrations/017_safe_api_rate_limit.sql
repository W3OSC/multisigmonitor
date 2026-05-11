CREATE TABLE IF NOT EXISTS safe_api_rate_limit (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    reset_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

ALTER TABLE safe_cache ADD COLUMN pending_tx_json TEXT;
ALTER TABLE safe_cache ADD COLUMN pending_tx_cached_at TEXT;
