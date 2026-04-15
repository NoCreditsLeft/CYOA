// GET  /api/style  — read the singleton style guide row
// PUT  /api/style  — update voice, tone, genre_conventions, forbidden, examples

import { requireSession } from './_lib/session.js';
import { admin } from './_lib/supabase.js';

const FIELDS = ['voice', 'tone', 'genre_conventions', 'forbidden', 'examples'];

export default async function handler(req, res) {
  try { await requireSession(req); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); return; }

  if (req.method === 'GET') {
    const { data, error } = await admin.from('style_guide').select('*').eq('id', 1).maybeSingle();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json(data || {});
    return;
  }

  if (req.method === 'PUT') {
    const patch = {};
    for (const f of FIELDS) {
      if (f in (req.body || {})) patch[f] = req.body[f] ?? null;
    }
    if (Object.keys(patch).length === 0) {
      res.status(400).json({ error: 'No editable fields in body' });
      return;
    }

    const { data, error } = await admin
      .from('style_guide')
      .update(patch)
      .eq('id', 1)
      .select()
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json(data);
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
