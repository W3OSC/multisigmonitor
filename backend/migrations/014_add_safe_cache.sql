CREATE TABLE IF NOT EXISTS safe_cache (
    safe_address TEXT NOT NULL,
    network TEXT NOT NULL,
    last_max_nonce INTEGER,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (safe_address, network)
);

CREATE INDEX IF NOT EXISTS idx_safe_cache_address_network ON safe_cache(safe_address, network);
