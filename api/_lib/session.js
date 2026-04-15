// Resolve a wallet from an incoming Authorization: Bearer <token> header.
// Returns { wallet, role } on success, or throws with a status code.

import { admin } from './supabase.js';

export async function requireSession(req) {
  const header = req.headers['authorization'] || req.headers['Authorization'];
  if (!header || !header.startsWith('Bearer ')) {
    const err = new Error('Missing Authorization header');
    err.status = 401;
    throw err;
  }
  const token = header.slice(7);

  const { data: session, error } = await admin
    .from('sessions')
    .select('wallet_address, expires_at')
    .eq('token', token)
    .maybeSingle();

  if (error) {
    const err = new Error(error.message);
    err.status = 500;
    throw err;
  }
  if (!session) {
    const err = new Error('Invalid session');
    err.status = 401;
    throw err;
  }
  if (new Date(session.expires_at) < new Date()) {
    const err = new Error('Session expired');
    err.status = 401;
    throw err;
  }

  // Look up role from allowlist.
  const { data: allow } = await admin
    .from('allowlist')
    .select('role')
    .eq('wallet_address', session.wallet_address)
    .maybeSingle();

  if (!allow) {
    const err = new Error('Wallet no longer allowlisted');
    err.status = 403;
    throw err;
  }

  // Touch last_used_at (fire and forget).
  admin.from('sessions').update({ last_used_at: new Date().toISOString() })
    .eq('token', token).then(() => {});

  return { wallet: session.wallet_address, role: allow.role, token };
}
