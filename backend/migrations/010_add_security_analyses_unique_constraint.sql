-- Add UNIQUE constraint to security_analyses to prevent duplicate analyses for same transaction
CREATE UNIQUE INDEX IF NOT EXISTS idx_security_analyses_unique_tx_safe 
ON security_analyses(safe_tx_hash, safe_address);
