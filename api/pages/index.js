// GET /api/pages   — list pages in current active episode, oldest first

import { requireSession } from '../_lib/session.js';
import { admin } from '../_lib/supabase.js';

export default async function handler(req, res) {
  try { await requireSession(req); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); return; }

  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { data: episode, error: epErr } = await admin
    .from('episodes')
    .select('id, number, title, goal, status')
    .eq('status', 'active')
    .order('number', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (epErr) { res.status(500).json({ error: epErr.message }); return; }
  if (!episode) { res.status(200).json({ episode: null, pages: [] }); return; }

  const { data: pages, error: pErr } = await admin
    .from('pages')
    .select('id, sequence, content, options, status, locked_at, created_at, choices(chosen_option)')
    .eq('episode_id', episode.id)
    .order('sequence', { ascending: true });

  if (pErr) { res.status(500).json({ error: pErr.message }); return; }

  res.status(200).json({ episode, pages });
}
