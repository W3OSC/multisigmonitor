-- Remove email verification and alerts features

DROP TABLE IF EXISTS email_verification_tokens;

-- Note: SQLite doesn't support DROP COLUMN easily
-- The email_verified and email_alerts_enabled columns in users table
-- can remain for backward compatibility or be ignored in code
