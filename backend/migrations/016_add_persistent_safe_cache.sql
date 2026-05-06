ALTER TABLE safe_cache ADD COLUMN safe_info_json TEXT;
ALTER TABLE safe_cache ADD COLUMN safe_info_cached_at TEXT;
ALTER TABLE safe_cache ADD COLUMN creation_info_json TEXT;

CREATE TABLE IF NOT EXISTS assessment_cache (
    safe_address TEXT NOT NULL,
    network TEXT NOT NULL,
    result_json TEXT NOT NULL,
    cached_at TEXT NOT NULL,
    PRIMARY KEY (safe_address, network)
);
