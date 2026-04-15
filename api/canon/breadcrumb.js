// POST /api/canon/breadcrumb
// Body: { text }
// Parses the raw breadcrumb via Claude, inserts a row into cyoa.canon_facts,
// returns the inserted row.

import { requireSession } from '../_lib/session.js';
import { admin } from '../_lib/supabase.js';
import { generate } from '../_lib/anthropic.js';

const CATEGORIES = [
  'character_fact', 'world_rule', 'relationship',
  'consequence', 'item', 'location', 'other',
];
const SUBJECTS = ['character', 'world', 'item', 'location'];
const WEIGHTS = ['absolute', 'strong', 'soft'];

const SYSTEM = `You normalize raw story notes ("breadcrumbs") into structured canon facts
for a Choose Your Own Adventure story. Output MUST be a single JSON object with these keys:

{
  "category":   one of ${CATEGORIES.map((c) => `"${c}"`).join(', ')},
  "subject_type": one of ${SUBJECTS.map((s) => `"${s}"`).join(', ')} or null,
  "subject_name": the name of the subject if identifiable (string) or null,
  "content":    a single, normalized declarative sentence capturing the fact,
  "weight":     one of ${WEIGHTS.map((w) => `"${w}"`).join(', ')}

Rules:
- "absolute" = unbreakable facts ("X will kill him", "Y is dead").
- "strong"   = firm but not existential ("X hates Y", "Z is brave").
- "soft"     = preferences / moods ("prefers tea", "feels uneasy around crowds").
- Keep content short, factual, third-person.
- Output JSON only. No prose, no markdown fences.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let wallet;
  try { ({ wallet } = await requireSession(req)); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); return; }

  const { text } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Missing text' });
    return;
  }

  try {
    const { text: out } = await generate({
      system: SYSTEM,
      messages: [{ role: 'user', content: text }],
      max_tokens: 512,
    });

    // Strip optional ```json ... ``` fences before parsing.
    const cleaned = out.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch { res.status(502).json({ error: 'Claude returned non-JSON', raw: out }); return; }

    if (!CATEGORIES.includes(parsed.category)) {
      res.status(502).json({ error: `Invalid category: ${parsed.category}` });
      return;
    }
    if (parsed.subject_type && !SUBJECTS.includes(parsed.subject_type)) {
      res.status(502).json({ error: `Invalid subject_type: ${parsed.subject_type}` });
      return;
    }
    if (!WEIGHTS.includes(parsed.weight)) {
      res.status(502).json({ error: `Invalid weight: ${parsed.weight}` });
      return;
    }

    // Resolve subject_name -> subject_id for characters (best-effort).
    let subject_id = null;
    if (parsed.subject_type === 'character' && parsed.subject_name) {
      const { data } = await admin
        .from('characters')
        .select('id')
        .ilike('name', parsed.subject_name)
        .maybeSingle();
      subject_id = data?.id ?? null;
    }

    const { data: row, error } = await admin
      .from('canon_facts')
      .insert({
        category: parsed.category,
        subject_type: parsed.subject_type,
        subject_id,
        content: parsed.content,
        raw_input: text,
        weight: parsed.weight,
        source: 'breadcrumb',
        added_by: wallet,
      })
      .select()
      .single();

    if (error) { res.status(500).json({ error: error.message }); return; }
    res.status(200).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
