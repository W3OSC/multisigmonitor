CREATE TABLE IF NOT EXISTS security_analyses (
    id TEXT PRIMARY KEY NOT NULL,
    safe_address TEXT NOT NULL,
    network TEXT NOT NULL,
    transaction_hash TEXT,
    safe_tx_hash TEXT,
    is_suspicious BOOLEAN NOT NULL DEFAULT 0,
    risk_level TEXT NOT NULL,
    warnings TEXT NOT NULL,
    details TEXT NOT NULL,
    call_type TEXT,
    hash_verification TEXT,
    nonce_check TEXT,
    calldata TEXT,
    analyzed_at DATETIME NOT NULL,
    user_id TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_security_analyses_user_id ON security_analyses(user_id);
CREATE INDEX IF NOT EXISTS idx_security_analyses_safe_address ON security_analyses(safe_address);
CREATE INDEX IF NOT EXISTS idx_security_analyses_network ON security_analyses(network);
CREATE INDEX IF NOT EXISTS idx_security_analyses_risk_level ON security_analyses(risk_level);
CREATE INDEX IF NOT EXISTS idx_security_analyses_analyzed_at ON security_analyses(analyzed_at);
CREATE INDEX IF NOT EXISTS idx_security_analyses_safe_tx_hash ON security_analyses(safe_tx_hash);
