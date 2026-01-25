# Database Optimization Plan

## Current Issue
- Fetching entire JSON blob (5-50KB per transaction) for list view
- Client-side filtering, sorting, and pagination
- No database-level limits causing full table scans

## Proposed Solution: Column-Based Optimization

### New Results Table Structure

```sql
-- Optimized results table with extracted fields
ALTER TABLE results 
ADD COLUMN transaction_hash text,
ADD COLUMN safe_tx_hash text,
ADD COLUMN nonce integer,
ADD COLUMN description text,
ADD COLUMN transaction_type text, -- 'normal' or 'suspicious'
ADD COLUMN is_executed boolean,
ADD COLUMN execution_tx_hash text,
ADD COLUMN submission_date timestamptz,
ADD COLUMN execution_date timestamptz,
ADD COLUMN to_address text,
ADD COLUMN value_wei text,
ADD COLUMN network text, -- extracted from monitor relationship
ADD COLUMN safe_address text, -- extracted from monitor relationship
ADD COLUMN proposer text,
ADD COLUMN confirmations_required integer,
ADD COLUMN confirmations_count integer,
ADD COLUMN trusted boolean,
ADD COLUMN operation_type integer; -- 0=Call, 1=DelegateCall, 2=ContractCreation

-- Keep result JSON for detail view only (will contain full Safe API response)
-- result JSON field remains for backward compatibility and detail views
```

### Query Optimization Benefits

**List View Query (Optimized):**
```sql
SELECT 
  id,
  transaction_hash,
  safe_address,
  network,
  nonce,
  description,
  transaction_type,
  is_executed,
  submission_date,
  scanned_at
FROM results 
WHERE (safe_address, network) IN (user_monitored_addresses)
ORDER BY submission_date DESC
LIMIT 50 OFFSET 0;
```

**Detail View Query:**
```sql
SELECT 
  id,
  transaction_hash,
  safe_tx_hash,
  result -- Full JSON blob only when needed
FROM results 
WHERE id = $1;
```

### Estimated Bandwidth Reduction

**Before:** ~10-50KB per transaction × 100 transactions = 1-5MB per page load
**After:** ~200-500 bytes per transaction × 100 transactions = 20-50KB per page load

**Reduction: 95-99% bandwidth savings for list views**

### Implementation Steps

1. **Add new columns** to results table
2. **Migrate existing data** - extract JSON fields to columns
3. **Update backend** - populate columns on insert/update
4. **Update frontend** - use columns for list, JSON for detail
5. **Add database indexes** for efficient sorting/filtering
6. **Implement proper pagination** at database level

### Indexes for Performance

```sql
-- Composite index for user's transaction list
CREATE INDEX idx_results_user_list ON results (safe_address, network, submission_date DESC);

-- Index for transaction type filtering
CREATE INDEX idx_results_type ON results (transaction_type) WHERE transaction_type = 'suspicious';

-- Index for execution status filtering  
CREATE INDEX idx_results_execution ON results (is_executed);

-- Index for transaction hash lookups
CREATE INDEX idx_results_tx_hash ON results (transaction_hash);
```

### Backward Compatibility

- Keep existing `result` JSON field for detail views
- Gradually deprecate JSON field access in list views
- Maintain current API structure during transition