// PUT /api/episodes/goal — set the goal for the active episode
// Body: { goal: string }

import { requireSession } from '../_lib/session.js';
import { admin } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'PUT') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try { await requireSession(req); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); return; }

  const { goal } = req.body || {};
  if (!goal?.trim()) { res.status(400).json({ error: 'Missing goal' }); return; }

  const { data: episode } = await admin
    .from('episodes')
    .select('id')
    .eq('status', 'active')
    .order('number', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!episode) { res.status(400).json({ error: 'No active episode' }); return; }

  const { data, error } = await admin
    .from('episodes')
    .update({ goal: goal.trim() })
    .eq('id', episode.id)
    .select()
    .single();

  if (error) { res.status(500).json({ error: error.message }); return; }
  res.status(200).json(data);
}
