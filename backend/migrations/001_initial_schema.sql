CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL UNIQUE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    google_id TEXT UNIQUE,
    github_id TEXT UNIQUE,
    ethereum_address TEXT UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_github_id ON users(github_id);
CREATE INDEX IF NOT EXISTS idx_users_ethereum_address ON users(ethereum_address);

CREATE TABLE IF NOT EXISTS monitors (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    safe_address TEXT NOT NULL,
    network TEXT NOT NULL,
    settings TEXT NOT NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, safe_address, network)
);

CREATE INDEX IF NOT EXISTS idx_monitors_user_id ON monitors(user_id);
CREATE INDEX IF NOT EXISTS idx_monitors_safe_address ON monitors(safe_address);
CREATE INDEX IF NOT EXISTS idx_monitors_network ON monitors(network);

CREATE TABLE IF NOT EXISTS transactions (
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
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
    UNIQUE(safe_tx_hash, network)
);

CREATE INDEX IF NOT EXISTS idx_transactions_monitor_id ON transactions(monitor_id);
CREATE INDEX IF NOT EXISTS idx_transactions_safe_tx_hash ON transactions(safe_tx_hash);
CREATE INDEX IF NOT EXISTS idx_transactions_safe_address ON transactions(safe_address);
CREATE INDEX IF NOT EXISTS idx_transactions_network ON transactions(network);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    monitor_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    notification_type TEXT NOT NULL,
    channel TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    sent_at DATETIME,
    read_at DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
    FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_monitor_id ON notifications(monitor_id);
CREATE INDEX IF NOT EXISTS idx_notifications_transaction_id ON notifications(transaction_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);

CREATE TABLE IF NOT EXISTS last_checks (
    id TEXT PRIMARY KEY NOT NULL,
    monitor_id TEXT NOT NULL,
    safe_address TEXT NOT NULL,
    network TEXT NOT NULL,
    checked_at DATETIME NOT NULL,
    transaction_last_found DATETIME,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE,
    UNIQUE(monitor_id)
);

CREATE INDEX IF NOT EXISTS idx_last_checks_monitor_id ON last_checks(monitor_id);
CREATE INDEX IF NOT EXISTS idx_last_checks_safe_address ON last_checks(safe_address);
