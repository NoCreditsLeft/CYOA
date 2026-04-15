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

    // Check if any locked/canonical page's generation referenced this fact.
    const { data: uses, error: useErr } = await admin
      .from('generations')
      .select('id, page_id, pages(status)')
      .contains('facts_used', [id])
      .limit(50);

    if (useErr) { res.status(500).json({ error: useErr.message }); return; }

    const lockedUses = (uses || []).filter(
      (u) => u.pages && (u.pages.status === 'locked' || u.pages.status === 'canonical')
    );

    if (lockedUses.length > 0) {
      res.status(409).json({
        error: 'Fact is referenced by locked pages',
        locked_uses: lockedUses.map((u) => ({ page_id: u.page_id })),
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
