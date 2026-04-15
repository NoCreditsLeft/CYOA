// GET    /api/canon          — list canon facts (newest first)
// DELETE /api/canon?id=<uuid> — delete a canon fact if unused in locked pages

import { requireSession } from '../_lib/session.js';
import { admin } from '../_lib/supabase.js';

export default async function handler(req, res) {
  try { await requireSession(req); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); return; }

  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('canon_facts')
      .select('*')
      .order('added_at', { ascending: false })
      .limit(500);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json(data);
    return;
  }

  if (req.method === 'DELETE') {
    const id = req.query.id;
    if (!id) { res.status(400).json({ error: 'Missing id' }); return; }

    // Block delete if any locked/canonical page was generated using this fact.
    const { data: lockedUses, error: useErr } = await admin
      .from('pages')
      .select('id, sequence, status, episode_id')
      .contains('facts_used', [id])
      .in('status', ['locked', 'canonical']);

    if (useErr) { res.status(500).json({ error: useErr.message }); return; }

    if (lockedUses && lockedUses.length > 0) {
      res.status(409).json({
        error: 'Fact is baked into locked pages',
        locked_uses: lockedUses.map((p) => ({ page_id: p.id, sequence: p.sequence })),
      });
      return;
    }

    const { error } = await admin.from('canon_facts').delete().eq('id', id);
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json({ ok: true });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
