// supabase.js
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Load .env file explicitly with path
const envPath = path.resolve(__dirname, '.env');

// Use dotenv to load environment variables
dotenv.config({ path: envPath });


// Check if environment variables are defined
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL and Key must be defined in .env file or hardcoded for development');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

module.exports = supabase;
