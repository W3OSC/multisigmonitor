-- Database Migration: Optimize Results Table Structure (Fixed Version)
-- Run this in your Supabase SQL Editor

-- Step 1: Add new columns to results table (only if they don't exist)
DO $$
BEGIN
    -- Add transaction_hash if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='transaction_hash') THEN
        ALTER TABLE results ADD COLUMN transaction_hash text;
    END IF;
    
    -- Add safe_tx_hash if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='safe_tx_hash') THEN
        ALTER TABLE results ADD COLUMN safe_tx_hash text;
    END IF;
    
    -- Add nonce if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='nonce') THEN
        ALTER TABLE results ADD COLUMN nonce integer;
    END IF;
    
    -- Check if description column exists, if not add it
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='description') THEN
        ALTER TABLE results ADD COLUMN description text;
    END IF;
    
    -- Check if transaction_type column exists, if type column exists rename it
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='type') AND 
       NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='transaction_type') THEN
        ALTER TABLE results RENAME COLUMN type TO transaction_type;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='transaction_type') THEN
        ALTER TABLE results ADD COLUMN transaction_type text DEFAULT 'normal';
    END IF;
    
    -- Add other columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='is_executed') THEN
        ALTER TABLE results ADD COLUMN is_executed boolean;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='execution_tx_hash') THEN
        ALTER TABLE results ADD COLUMN execution_tx_hash text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='submission_date') THEN
        ALTER TABLE results ADD COLUMN submission_date timestamptz;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='execution_date') THEN
        ALTER TABLE results ADD COLUMN execution_date timestamptz;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='to_address') THEN
        ALTER TABLE results ADD COLUMN to_address text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='value_wei') THEN
        ALTER TABLE results ADD COLUMN value_wei text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='proposer') THEN
        ALTER TABLE results ADD COLUMN proposer text;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='confirmations_required') THEN
        ALTER TABLE results ADD COLUMN confirmations_required integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='confirmations_count') THEN
        ALTER TABLE results ADD COLUMN confirmations_count integer;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='trusted') THEN
        ALTER TABLE results ADD COLUMN trusted boolean;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='results' AND column_name='operation_type') THEN
        ALTER TABLE results ADD COLUMN operation_type integer;
    END IF;
END $$;

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
  description = COALESCE(description, (result->>'description')::text),
  transaction_type = COALESCE(transaction_type, (result->>'type')::text, 'normal'),
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
WHERE result IS NOT NULL 
AND (transaction_hash IS NULL OR description IS NULL); -- Only update if not already populated

-- Step 3: Create indexes for efficient querying
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

-- Step 4: Add constraints for data integrity
DO $$
BEGIN
    -- Add transaction_type constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_transaction_type') THEN
        ALTER TABLE results 
        ADD CONSTRAINT chk_transaction_type 
        CHECK (transaction_type IN ('normal', 'suspicious'));
    END IF;
    
    -- Add operation_type constraint if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.check_constraints WHERE constraint_name = 'chk_operation_type') THEN
        ALTER TABLE results 
        ADD CONSTRAINT chk_operation_type 
        CHECK (operation_type IS NULL OR operation_type IN (0, 1, 2));
    END IF;
END $$;

-- Verification query to check migration success
SELECT 
  COUNT(*) as total_rows,
  COUNT(transaction_hash) as rows_with_tx_hash,
  COUNT(safe_tx_hash) as rows_with_safe_tx_hash,
  COUNT(nonce) as rows_with_nonce,
  COUNT(description) as rows_with_description,
  COUNT(CASE WHEN safe_address IS NOT NULL THEN 1 END) as rows_with_safe_address,
  COUNT(CASE WHEN network IS NOT NULL THEN 1 END) as rows_with_network
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