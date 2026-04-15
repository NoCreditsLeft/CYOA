// POST /api/auth/verify
// Body: { wallet, message, signature }
// Verifies the EVM signature, checks allowlist, creates a session.
// Returns: { token, expiresAt, role }

import crypto from 'node:crypto';
import { verifyMessage } from 'viem';
import { admin } from '../_lib/supabase.js';

const SESSION_DAYS = 7;
const MESSAGE_MAX_AGE_MS = 5 * 60 * 1000; // 5 min

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { wallet, message, signature } = req.body || {};
    if (!wallet || !message || !signature) {
      res.status(400).json({ error: 'Missing wallet, message, or signature' });
      return;
    }

    const addr = String(wallet).toLowerCase();

    // Message must include an ISO timestamp within the last MESSAGE_MAX_AGE_MS.
    const tsMatch = message.match(/Timestamp:\s*(\d+)/);
    if (!tsMatch) {
      res.status(400).json({ error: 'Message missing Timestamp' });
      return;
    }
    const ts = Number(tsMatch[1]);
    if (!Number.isFinite(ts) || Date.now() - ts > MESSAGE_MAX_AGE_MS) {
      res.status(400).json({ error: 'Message expired' });
      return;
    }

    // Verify EVM signature.
    const ok = await verifyMessage({ address: addr, message, signature });
    if (!ok) {
      res.status(401).json({ error: 'Bad signature' });
      return;
    }

    // Check allowlist.
    const { data: allow, error: allowErr } = await admin
      .from('allowlist')
      .select('role')
      .eq('wallet_address', addr)
      .maybeSingle();
    if (allowErr) {
      res.status(500).json({ error: allowErr.message });
      return;
    }
    if (!allow) {
      res.status(403).json({ error: 'Wallet not allowlisted' });
      return;
    }

    // Issue session.
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);

    const { error: insErr } = await admin.from('sessions').insert({
      token,
      wallet_address: addr,
      expires_at: expiresAt.toISOString(),
    });
    if (insErr) {
      res.status(500).json({ error: insErr.message });
      return;
    }

    res.status(200).json({
      token,
      expiresAt: expiresAt.toISOString(),
      role: allow.role,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
