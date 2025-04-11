# Supabase SQL Setup for Monitoring Service

This README contains all the SQL statements required to set up tables and Row-Level Security (RLS) policies in your Supabase project. Simply copy and paste each section into the Supabase SQL editor.

> **New Features**: 
> - Telegram Notifications - See [README-telegram.md](./README-telegram.md) for setup instructions
> - Email Notifications - See [README-email.md](./README-email.md) for setup instructions

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

### 4. `notification_status` Table

```sql
CREATE TABLE notification_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_hash TEXT NOT NULL,
  safe_address TEXT NOT NULL,
  network TEXT NOT NULL,
  notified_at TIMESTAMP WITH TIME ZONE NOT NULL,
  transaction_type TEXT NOT NULL,
  monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add indexes for faster lookups
CREATE INDEX idx_notification_status_txhash ON notification_status(transaction_hash);
CREATE INDEX idx_notification_status_safe_network ON notification_status(safe_address, network);
CREATE INDEX idx_notification_status_monitor ON notification_status(monitor_id);
```

### Enable Row-Level Security (RLS)

```sql
ALTER TABLE monitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE results ENABLE ROW LEVEL SECURITY;
ALTER TABLE last_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_status ENABLE ROW LEVEL SECURITY;
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

#### Policies for `notification_status`

```sql
-- Allow users to view notifications for their own monitors
CREATE POLICY "Users can read notification_status for their monitors" 
ON notification_status 
FOR SELECT 
USING (
  monitor_id IN (
    SELECT id FROM monitors WHERE user_id = auth.uid()
  )
);

-- Allow only service role to create notifications (not anon or authenticated)
CREATE POLICY "Service can create notification_status" 
ON notification_status 
FOR INSERT 
TO service_role
WITH CHECK (true);

-- Allow service to manage notifications
CREATE POLICY "Service can manage notification_status" 
ON notification_status 
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
```

## Testing Notifications

The system includes utilities to test notifications without having to create actual Safe transactions:

### Insert Test Transaction Script

The `insert-test-transaction.js` script allows you to create a mock transaction directly in the database:

```bash
node insert-test-transaction.js
```

This interactive script will:
1. Let you choose a monitor from your existing monitors
2. Create a mock transaction with customizable parameters
3. Insert the transaction into the database
4. The regular monitoring service will detect this transaction on its next check cycle
5. Notifications will be sent according to your monitor's notification settings

This approach is ideal for testing your notification setup without having to create real blockchain transactions.

### Features

- Generates random transaction hashes for testing
- Works with any notification method (Telegram, webhooks, etc.)
- Allows testing both normal and suspicious transactions
- Can simulate both pending and executed transactions
- Shows you the exact links that will be included in notifications
- Option to mark the test transaction as already notified
