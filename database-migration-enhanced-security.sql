-- Enhanced Security Analysis Migration
-- Add new columns to the results table for enhanced security analysis

-- Add security analysis columns
ALTER TABLE results 
ADD COLUMN IF NOT EXISTS security_analysis JSONB,
ADD COLUMN IF NOT EXISTS risk_level TEXT,
ADD COLUMN IF NOT EXISTS security_warnings TEXT[],
ADD COLUMN IF NOT EXISTS hash_verification JSONB,
ADD COLUMN IF NOT EXISTS nonce_check JSONB,
ADD COLUMN IF NOT EXISTS calldata_decoded JSONB,
ADD COLUMN IF NOT EXISTS call_type JSONB,
ADD COLUMN IF NOT EXISTS gas_params JSONB;

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_results_risk_level ON results(risk_level);
CREATE INDEX IF NOT EXISTS idx_results_security_warnings ON results USING GIN(security_warnings);
CREATE INDEX IF NOT EXISTS idx_results_security_analysis ON results USING GIN(security_analysis);

-- Add comments for documentation
COMMENT ON COLUMN results.security_analysis IS 'Complete security analysis object with warnings, risk level, and details';
COMMENT ON COLUMN results.risk_level IS 'Overall risk level: low, medium, high, critical';
COMMENT ON COLUMN results.security_warnings IS 'Array of security warning messages';
COMMENT ON COLUMN results.hash_verification IS 'Hash verification results including calculated vs API hashes';
COMMENT ON COLUMN results.nonce_check IS 'Nonce sequence validation results';
COMMENT ON COLUMN results.calldata_decoded IS 'Decoded transaction calldata information';
COMMENT ON COLUMN results.call_type IS 'Call type information (call vs delegate call)';
COMMENT ON COLUMN results.gas_params IS 'Gas parameter values for security validation';
