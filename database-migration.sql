-- Database Migration: Optimize Results Table Structure
-- Run this in your Supabase SQL Editor

-- Step 1: Add new columns to results table
ALTER TABLE results 
ADD COLUMN IF NOT EXISTS transaction_hash text,
ADD COLUMN IF NOT EXISTS safe_tx_hash text,
ADD COLUMN IF NOT EXISTS nonce integer,
ADD COLUMN IF NOT EXISTS description text,
ADD COLUMN IF NOT EXISTS transaction_type text DEFAULT 'normal',
ADD COLUMN IF NOT EXISTS is_executed boolean,
ADD COLUMN IF NOT EXISTS execution_tx_hash text,
ADD COLUMN IF NOT EXISTS submission_date timestamptz,
ADD COLUMN IF NOT EXISTS execution_date timestamptz,
ADD COLUMN IF NOT EXISTS to_address text,
ADD COLUMN IF NOT EXISTS value_wei text,
ADD COLUMN IF NOT EXISTS network text,
ADD COLUMN IF NOT EXISTS safe_address text,
ADD COLUMN IF NOT EXISTS proposer text,
ADD COLUMN IF NOT EXISTS confirmations_required integer,
ADD COLUMN IF NOT EXISTS confirmations_count integer,
ADD COLUMN IF NOT EXISTS trusted boolean,
ADD COLUMN IF NOT EXISTS operation_type integer;

-- Step 2: Migrate existing data from JSON to columns
UPDATE results 
SET 
  transaction_hash = (result->>'transaction_hash')::text,
  safe_tx_hash = (result->'transaction_data'->>'safeTxHash')::text,
  nonce = CASE 
    WHEN result->'transaction_data'->>'nonce' IS NOT NULL 
    THEN (result->'transaction_data'->>'nonce')::integer 
    ELSE NULL 
  END,
  description = (result->>'description')::text,
  transaction_type = COALESCE((result->>'type')::text, 'normal'),
  is_executed = CASE 
    WHEN result->'transaction_data'->>'isExecuted' = 'true' THEN true
    WHEN result->'transaction_data'->>'isExecuted' = 'false' THEN false
    ELSE NULL
  END,
  execution_tx_hash = (result->'transaction_data'->>'transactionHash')::text,
  submission_date = CASE 
    WHEN result->'transaction_data'->>'submissionDate' IS NOT NULL 
    THEN (result->'transaction_data'->>'submissionDate')::timestamptz 
    ELSE NULL 
  END,
  execution_date = CASE 
    WHEN result->'transaction_data'->>'executionDate' IS NOT NULL 
    THEN (result->'transaction_data'->>'executionDate')::timestamptz 
    ELSE NULL 
  END,
  to_address = (result->'transaction_data'->>'to')::text,
  value_wei = (result->'transaction_data'->>'value')::text,
  proposer = (result->'transaction_data'->>'proposer')::text,
  confirmations_required = CASE 
    WHEN result->'transaction_data'->>'confirmationsRequired' IS NOT NULL 
    THEN (result->'transaction_data'->>'confirmationsRequired')::integer 
    ELSE NULL 
  END,
  confirmations_count = CASE 
    WHEN result->'transaction_data'->'confirmations' IS NOT NULL 
    THEN jsonb_array_length(result->'transaction_data'->'confirmations') 
    ELSE 0 
  END,
  trusted = CASE 
    WHEN result->'transaction_data'->>'trusted' = 'true' THEN true
    WHEN result->'transaction_data'->>'trusted' = 'false' THEN false
    ELSE NULL
  END,
  operation_type = CASE 
    WHEN result->'transaction_data'->>'operation' IS NOT NULL 
    THEN (result->'transaction_data'->>'operation')::integer 
    ELSE NULL 
  END
WHERE result IS NOT NULL;

-- Step 3: Populate network and safe_address from monitor relationship
UPDATE results 
SET 
  network = m.network,
  safe_address = m.safe_address
FROM monitors m 
WHERE results.monitor_id = m.id
AND (results.network IS NULL OR results.safe_address IS NULL);

-- Step 4: Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_results_user_list 
ON results (safe_address, network, submission_date DESC NULLS LAST);

CREATE INDEX IF NOT EXISTS idx_results_scanned_at 
ON results (safe_address, network, scanned_at DESC);

CREATE INDEX IF NOT EXISTS idx_results_type 
ON results (transaction_type) WHERE transaction_type = 'suspicious';

CREATE INDEX IF NOT EXISTS idx_results_execution 
ON results (is_executed);

CREATE INDEX IF NOT EXISTS idx_results_tx_hash 
ON results (transaction_hash) WHERE transaction_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_results_safe_tx_hash 
ON results (safe_tx_hash) WHERE safe_tx_hash IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_results_nonce 
ON results (safe_address, network, nonce DESC);

-- Step 5: Add constraints for data integrity
ALTER TABLE results 
ADD CONSTRAINT chk_transaction_type 
CHECK (transaction_type IN ('normal', 'suspicious'));

ALTER TABLE results 
ADD CONSTRAINT chk_operation_type 
CHECK (operation_type IS NULL OR operation_type IN (0, 1, 2));

-- Step 6: Update RLS policies if needed (check existing policies first)
-- Note: You may need to update existing RLS policies to include the new columns
-- This depends on your current policy structure

-- Verification query to check migration success
SELECT 
  COUNT(*) as total_rows,
  COUNT(transaction_hash) as rows_with_tx_hash,
  COUNT(safe_tx_hash) as rows_with_safe_tx_hash,
  COUNT(nonce) as rows_with_nonce,
  COUNT(description) as rows_with_description,
  COUNT(network) as rows_with_network,
  COUNT(safe_address) as rows_with_safe_address
FROM results;

-- Sample query to test new structure
SELECT 
  id,
  safe_address,
  network,
  transaction_hash,
  nonce,
  description,
  transaction_type,
  is_executed,
  submission_date,
  scanned_at
FROM results 
WHERE safe_address IS NOT NULL 
  AND network IS NOT NULL
ORDER BY COALESCE(submission_date, scanned_at) DESC
LIMIT 10;