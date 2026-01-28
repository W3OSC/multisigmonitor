-- Add assessment JSON column to security_analyses for full Safe reviews
ALTER TABLE security_analyses ADD COLUMN assessment TEXT;

-- Note: safe_reviews table migration skipped - table never existed in this codebase version

-- Add index for assessment queries
CREATE INDEX IF NOT EXISTS idx_security_analyses_assessment ON security_analyses(assessment) WHERE assessment IS NOT NULL;

-- Add index for assessment queries
CREATE INDEX IF NOT EXISTS idx_security_analyses_assessment ON security_analyses(assessment) WHERE assessment IS NOT NULL;
