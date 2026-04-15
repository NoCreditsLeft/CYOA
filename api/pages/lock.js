// POST /api/pages/lock
// Body: { id: <page uuid>, chosen_option: string }
// Freezes the page, records the winning choice.
// (State tracker snapshot + checkpoint advancement come later.)

import { requireSession } from '../_lib/session.js';
import { admin } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let wallet;
  try { ({ wallet } = await requireSession(req)); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); return; }

  const { id, chosen_option } = req.body || {};
  if (!id) { res.status(400).json({ error: 'Missing id' }); return; }
  if (!chosen_option || typeof chosen_option !== 'string') {
    res.status(400).json({ error: 'Missing chosen_option' });
    return;
  }

  // Fetch page to validate the chosen_option is one of its options
  const { data: page, error: pErr } = await admin
    .from('pages')
    .select('id, options, status')
    .eq('id', id)
    .maybeSingle();

  if (pErr) { res.status(500).json({ error: pErr.message }); return; }
  if (!page) { res.status(404).json({ error: 'Page not found' }); return; }
  if (page.status !== 'draft') {
    res.status(409).json({ error: `Page is ${page.status}, can only lock drafts` });
    return;
  }
  if (!page.options.includes(chosen_option)) {
    res.status(400).json({ error: 'chosen_option is not one of the page options' });
    return;
  }

  // Lock page
  const { error: lockErr } = await admin
    .from('pages')
    .update({
      status: 'locked',
      locked_at: new Date().toISOString(),
      locked_by: wallet,
    })
    .eq('id', id);
  if (lockErr) { res.status(500).json({ error: lockErr.message }); return; }

  // Record choice
  const { error: chErr } = await admin
    .from('choices')
    .insert({ page_id: id, chosen_option });
  if (chErr) { res.status(500).json({ error: chErr.message }); return; }

  res.status(200).json({ ok: true });
}
