// Service-role Supabase client for serverless functions.
// Bypasses RLS. Never import this from src/ — server-only.

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SECRET_KEY');
}

export const admin = createClient(url, secret, {
  db: { schema: 'cyoa' },
  auth: { persistSession: false, autoRefreshToken: false },
});
