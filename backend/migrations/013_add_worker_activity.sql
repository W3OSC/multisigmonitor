CREATE TABLE IF NOT EXISTS worker_activity (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    monitor_id TEXT,
    event_type TEXT NOT NULL,
    safe_address TEXT,
    network TEXT,
    message TEXT NOT NULL,
    metadata TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (monitor_id) REFERENCES monitors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_worker_activity_user_id ON worker_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_worker_activity_created_at ON worker_activity(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_worker_activity_event_type ON worker_activity(event_type);
