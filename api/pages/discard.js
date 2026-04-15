// POST /api/pages/discard
// Body: { id }
// Deletes a draft page. Only drafts can be discarded.

import { requireSession } from '../_lib/session.js';
import { admin } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try { await requireSession(req); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); return; }

  const { id } = req.body || {};
  if (!id) { res.status(400).json({ error: 'Missing id' }); return; }

  const { data: page, error: pErr } = await admin
    .from('pages')
    .select('id, status')
    .eq('id', id)
    .maybeSingle();
  if (pErr) { res.status(500).json({ error: pErr.message }); return; }
  if (!page) { res.status(404).json({ error: 'Page not found' }); return; }
  if (page.status !== 'draft') {
    res.status(409).json({ error: `Page is ${page.status}, only drafts can be discarded` });
    return;
  }

  const { error } = await admin.from('pages').delete().eq('id', id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(200).json({ ok: true });
}
