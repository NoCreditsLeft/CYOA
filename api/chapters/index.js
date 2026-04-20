// GET  /api/chapters           — list chapters for the active episode
// POST /api/chapters           — activate a proposed chapter (body: { id })
// PUT  /api/chapters           — complete the active chapter (body: { id, summary? })

import { requireSession } from '../_lib/session.js';
import { admin } from '../_lib/supabase.js';

export default async function handler(req, res) {
  try { await requireSession(req); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); return; }

  // Active episode
  const { data: episode } = await admin
    .from('episodes')
    .select('id')
    .eq('status', 'active')
    .order('number', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!episode) { res.status(400).json({ error: 'No active episode' }); return; }

  // ---------- GET ----------
  if (req.method === 'GET') {
    const { data, error } = await admin
      .from('chapters')
      .select('*')
      .eq('episode_id', episode.id)
      .order('sequence', { ascending: true });
    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json(data);
    return;
  }

  // ---------- POST: activate ----------
  if (req.method === 'POST') {
    const { id } = req.body || {};
    if (!id) { res.status(400).json({ error: 'Missing chapter id' }); return; }

    // Ensure no other chapter is already active
    const { data: active } = await admin
      .from('chapters')
      .select('id')
      .eq('episode_id', episode.id)
      .eq('status', 'active')
      .maybeSingle();

    if (active) { res.status(409).json({ error: 'Another chapter is already active. Complete it first.' }); return; }

    const { data, error } = await admin
      .from('chapters')
      .update({ status: 'active', activated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'proposed')
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json(data);
    return;
  }

  // ---------- PUT: complete (commit to lore) ----------
  if (req.method === 'PUT') {
    const { id, summary } = req.body || {};
    if (!id) { res.status(400).json({ error: 'Missing chapter id' }); return; }

    // Build lore_text from all locked/canonical pages in this chapter
    const { data: chapterPages } = await admin
      .from('pages')
      .select('sequence, content, choices(chosen_option)')
      .eq('chapter_id', id)
      .in('status', ['locked', 'canonical'])
      .order('sequence', { ascending: true });

    const loreText = (chapterPages || []).map((p) => {
      const chosen = p.choices?.[0]?.chosen_option;
      return p.content + (chosen ? `\n\n> The community chose: "${chosen}"` : '');
    }).join('\n\n---\n\n');

    const updates = {
      status: 'complete',
      completed_at: new Date().toISOString(),
      lore_text: loreText || null,
    };
    if (summary) updates.summary = summary;

    const { data, error } = await admin
      .from('chapters')
      .update(updates)
      .eq('id', id)
      .eq('status', 'active')
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json(data);
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
