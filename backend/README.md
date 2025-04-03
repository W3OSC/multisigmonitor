# Supabase SQL Setup for Monitoring Service

This README contains all the SQL statements required to set up tables and Row-Level Security (RLS) policies in your Supabase project. Simply copy and paste each section into the Supabase SQL editor.

---

## ✅ Database Schema

### 1. `monitors` Table

```sql
CREATE TABLE monitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users ON DELETE CASCADE,
  transaction_string TEXT NOT NULL,
  notify BOOLEAN DEFAULT TRUE,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now()
);
```

### 2. `results` Table

```sql
CREATE TABLE results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  result JSONB,
  scanned_at TIMESTAMP DEFAULT now()
);
```

3. `profiles` Table

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT now()
);
```

### ✅ Enable Row-Level Security (RLS)

```sql
ALTER TABLE monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
```

### ✅ RLS Policies

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
CREATE POLICY "Users can view results from their monitors"
ON results FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM monitors
    WHERE monitors.id = results.monitor_id
      AND monitors.user_id = auth.uid()
  )
);
```

### Policies for `profiles`

```sql
CREATE POLICY "Users can read their own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile"
ON profiles FOR INSERT
WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);
```
