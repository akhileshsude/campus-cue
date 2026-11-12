import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
// Strictly require SERVICE ROLE key on the server so RLS-protected tables work reliably and never fall back to anon key.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (
  process.env.DISABLE_SUPABASE !== 'true' &&
  supabaseUrl &&
  supabaseServiceKey &&
  !supabaseUrl.includes('your-project.supabase.co') &&
  !supabaseServiceKey.includes('your-supabase')
) {
  try {
    supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    console.log('✅ Supabase client initialized with service role key.');
  } catch (error) {
    console.warn('⚠️ Failed to initialize Supabase client:', error.message);
  }
} else {
  console.log('ℹ️ Supabase URL or service role key missing. Running in local disk mode.');
}

export default supabase;

