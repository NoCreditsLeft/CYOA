// GET /api/auth/me
// Returns { wallet, role } for a valid session, or 401.

import { requireSession } from '../_lib/session.js';

export default async function handler(req, res) {
  try {
    const { wallet, role } = await requireSession(req);
    res.status(200).json({ wallet, role });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
}
