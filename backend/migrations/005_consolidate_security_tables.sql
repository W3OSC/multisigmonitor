-- Add assessment JSON column to security_analyses for full Safe reviews
ALTER TABLE security_analyses ADD COLUMN assessment TEXT;

-- Migrate data from safe_reviews to security_analyses
INSERT INTO security_analyses (
    id,
    safe_address,
    network,
    transaction_hash,
    safe_tx_hash,
    is_suspicious,
    risk_level,
    warnings,
    details,
    assessment,
    analyzed_at,
    user_id,
    created_at
)
SELECT 
    id,
    safe_address,
    network,
    NULL as transaction_hash,
    NULL as safe_tx_hash,
    COALESCE(json_extract(assessment, '$.isSuspicious'), 0) as is_suspicious,
    COALESCE(json_extract(assessment, '$.overallRisk'), 'unknown') as risk_level,
    '[]' as warnings,
    '{}' as details,
    assessment,
    reviewed_at as analyzed_at,
    user_id,
    created_at
FROM safe_reviews;

-- Drop safe_reviews table
DROP TABLE IF EXISTS safe_reviews;

-- Add index for assessment queries
CREATE INDEX IF NOT EXISTS idx_security_analyses_assessment ON security_analyses(assessment) WHERE assessment IS NOT NULL;
