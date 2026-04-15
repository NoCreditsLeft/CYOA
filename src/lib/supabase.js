import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
}

// Scoped to the `cyoa` schema so every from() / rpc() hits our tables.
export const supabase = createClient(url, anonKey, {
  db: { schema: 'cyoa' },
  auth: { persistSession: true, autoRefreshToken: true },
});
