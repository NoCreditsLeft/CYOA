// DELETE /api/chapters/delete?id=<uuid>
// Only proposed chapters can be deleted.

import { requireSession } from '../_lib/session.js';
import { admin } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try { await requireSession(req); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); return; }

  const id = req.query.id;
  if (!id) { res.status(400).json({ error: 'Missing id' }); return; }

  // Only allow deleting proposed chapters
  const { data: ch } = await admin.from('chapters').select('status').eq('id', id).maybeSingle();
  if (!ch) { res.status(404).json({ error: 'Chapter not found' }); return; }
  if (ch.status !== 'proposed') { res.status(409).json({ error: 'Only proposed chapters can be deleted' }); return; }

  const { error } = await admin.from('chapters').delete().eq('id', id);
  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(200).json({ ok: true });
}
