import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env.local');
}

// Scoped to a per-IP schema so every from() / rpc() hits the right tables.
// Defaults to `cyoa` (Nibbles) when VITE_CYOA_SCHEMA is unset.
const schema = import.meta.env.VITE_CYOA_SCHEMA || 'cyoa';

export const supabase = createClient(url, anonKey, {
  db: { schema },
  auth: { persistSession: true, autoRefreshToken: true },
});
