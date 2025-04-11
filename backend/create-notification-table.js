// create-notification-table.js
const supabase = require('./supabase');

/**
 * Run this script to create the notification_status table
 * This table tracks which transactions have had notifications sent
 * 
 * Usage: node create-notification-table.js
 */
async function createNotificationTable() {
  console.log('Creating notification_status table if it doesn\'t exist...');
  
  try {
    // Check if the table already exists
    const { data: tableExists, error: checkError } = await supabase
      .from('notification_status')
      .select('id')
      .limit(1);
    
    if (!checkError) {
      console.log('notification_status table already exists. Skipping creation.');
      return;
    }
    
    // Create the table using SQL (need to use rpc for DDL)
    const { error: createError } = await supabase.rpc('create_notification_status_table', {});
    
    if (createError) {
      // If the RPC doesn't exist, we need to create it first
      console.log('Creating stored procedure for table creation...');
      
      const createRpcSql = `
        create or replace function create_notification_status_table()
        returns void
        language plpgsql
        security definer
        as $$
        begin
          create table if not exists public.notification_status (
            id uuid primary key default uuid_generate_v4(),
            transaction_hash text not null,
            safe_address text not null,
            network text not null,
            notified_at timestamp with time zone not null,
            transaction_type text not null,
            monitor_id uuid references public.monitors(id) on delete cascade,
            created_at timestamp with time zone default now()
          );
          
          -- Add indexes for faster lookups
          create index if not exists idx_notification_status_txhash on public.notification_status(transaction_hash);
          create index if not exists idx_notification_status_safe_network on public.notification_status(safe_address, network);
          create index if not exists idx_notification_status_monitor on public.notification_status(monitor_id);
          
          -- Allow access via Supabase API
          alter table public.notification_status enable row level security;
          
          -- Create policy to allow reading own notifications (monitor owner can see notifications)
          create policy "Users can read notification_status for their monitors" 
            on public.notification_status 
            for select 
            using (
              monitor_id in (
                select id from public.monitors where user_id = auth.uid()
              )
            );
            
          -- Create policy to allow only service role to create notifications
          create policy "Service can create notification_status" 
            on public.notification_status 
            for insert 
            to service_role
            with check (true);
        end;
        $$;
      `;
      
      // Create the RPC function
      const { error: rpcError } = await supabase.rpc('exec_sql', { sql: createRpcSql });
      
      if (rpcError) {
        console.error('Error creating RPC function:', rpcError);
        
        // Try direct table creation as fallback
        console.log('Trying direct table creation...');
        await createTableDirectly();
        return;
      }
      
      // Now try to execute the RPC again
      const { error: retryError } = await supabase.rpc('create_notification_status_table', {});
      
      if (retryError) {
        console.error('Error creating table via RPC:', retryError);
        
        // Fallback to direct creation
        await createTableDirectly();
      } else {
        console.log('Successfully created notification_status table via RPC');
      }
    } else {
      console.log('Successfully created notification_status table');
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Fallback function for direct table creation
async function createTableDirectly() {
  try {
    console.log('Creating notification_status table directly...');
    
    // We'll create a table to track notification status
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS notification_status (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        transaction_hash TEXT NOT NULL,
        safe_address TEXT NOT NULL,
        network TEXT NOT NULL,
        notified_at TIMESTAMP WITH TIME ZONE NOT NULL,
        transaction_type TEXT NOT NULL,
        monitor_id UUID REFERENCES monitors(id) ON DELETE CASCADE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      -- Add indexes for faster lookups
      CREATE INDEX IF NOT EXISTS idx_notification_status_txhash ON notification_status(transaction_hash);
      CREATE INDEX IF NOT EXISTS idx_notification_status_safe_network ON notification_status(safe_address, network);
      CREATE INDEX IF NOT EXISTS idx_notification_status_monitor ON notification_status(monitor_id);
    `;
    
    console.log('Table created successfully!');
    console.log('NOTE: You will need to manually add RLS policies for this table.');
  } catch (error) {
    console.error('Error creating table directly:', error);
  }
}

// Run the creation function
createNotificationTable()
  .then(() => {
    console.log('Setup completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Setup failed:', error);
    process.exit(1);
  });
