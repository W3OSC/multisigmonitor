# Supabase SQL Setup for Monitoring Service

This README contains all the SQL statements required to set up tables and Row-Level Security (RLS) policies in your Supabase project. Simply copy and paste each section into the Supabase SQL editor.

---

## ✅ Database Schema

### 1. `monitors` Table

```sql
CREATE TABLE monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  safe_address TEXT NOT NULL,
  network TEXT NOT NULL,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);
```

### 2. `results` Table

```sql
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  safe_address TEXT NOT NULL,
  network TEXT NOT NULL,
  result JSONB,
  scanned_at TIMESTAMP DEFAULT now()
);
```

### 3. `last_checks` Table

```sql
CREATE TABLE last_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  safe_address TEXT NOT NULL,
  network TEXT NOT NULL,
  checked_at TIMESTAMP DEFAULT now(),
  unix_timestamp BIGINT
);
```

### Enable Row-Level Security (RLS)

```sql
ALTER TABLE monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE last_checks ENABLE ROW LEVEL SECURITY;
```

### RLS Policies

#### Policies for `monitors`

```sql
CREATE POLICY "Users can view their own monitors"
ON monitors FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own monitors"
ON monitors FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own monitors"
ON monitors FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own monitors"
ON monitors FOR DELETE
USING (auth.uid() = user_id);
```

#### Policies for `results`

```sql
CREATE POLICY "Users can view results for monitors they subscribe to"
ON results FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM monitors
    WHERE monitors.safe_address = results.safe_address
      AND monitors.user_id = auth.uid()
  )
);
```

#### Policies for `last_checks`

```sql
CREATE POLICY "Users can view last_checks for monitors they subscribe to"
ON last_checks FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM monitors
    WHERE monitors.safe_address = last_checks.safe_address
      AND monitors.network = last_checks.network
      AND monitors.user_id = auth.uid()
  )
);

-- Allow service role to insert/update last_checks
CREATE POLICY "Service account can manage last_checks"
ON last_checks FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```
