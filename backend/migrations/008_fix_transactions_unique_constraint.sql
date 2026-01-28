-- Migration already applied - transactions table already has correct UNIQUE constraint on (safe_tx_hash, monitor_id)
-- This migration is a no-op to prevent errors on fresh database creation
SELECT 1;
