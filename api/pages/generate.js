// POST /api/pages/generate
// Body: { steering?: string }
// Generates a new draft page for the current active episode.
// Uses: active canon facts + all prior pages & choices in the episode
// + optional loremaster steering text.

import { requireSession } from '../_lib/session.js';
import { admin } from '../_lib/supabase.js';
import { generate } from '../_lib/anthropic.js';

const SYSTEM = `You are the narrative engine for a Choose Your Own Adventure story told live on X Spaces.

Rules:
- Output must be a single JSON object with exactly these keys: "content" (string), "options" (array of 2 or 3 short strings).
- "content" is the next page of narrative. A few paragraphs, suitable to read aloud in 1–2 minutes. No headings.
- "options" are the distinct directions the community will vote on. Each option is one short sentence.
- Never contradict any Absolute canon fact. Treat Strong facts as firmly established. Treat Soft facts as tendencies.
- Respect the locked story so far as immutable history.
- Do not name the player ("you"). The community steers characters from the outside.
- Output JSON only. No markdown fences, no prose outside the JSON.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try { await requireSession(req); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); return; }

  const { steering = '' } = req.body || {};

  // Current active episode
  const { data: episode, error: epErr } = await admin
    .from('episodes')
    .select('id, number, title, checkpoints, status')
    .eq('status', 'active')
    .order('number', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (epErr) { res.status(500).json({ error: epErr.message }); return; }
  if (!episode) { res.status(400).json({ error: 'No active episode' }); return; }

  // Active canon
  const { data: facts } = await admin
    .from('canon_facts')
    .select('id, category, content, weight')
    .eq('status', 'active');

  // Prior pages (locked + canonical) for this episode, with winning choices
  const { data: priorPages } = await admin
    .from('pages')
    .select('id, sequence, content, options, status, choices(chosen_option)')
    .eq('episode_id', episode.id)
    .in('status', ['locked', 'canonical'])
    .order('sequence', { ascending: true });

  // Style guide
  const { data: style } = await admin.from('style_guide').select('*').eq('id', 1).maybeSingle();

  // Build user message
  const factBlock = (facts || []).length === 0 ? '(none yet)' :
    facts.map((f) => `- [${f.weight.toUpperCase()} · ${f.category}] ${f.content}`).join('\n');

  const storySoFar = (priorPages || []).length === 0 ? '(this is the first page)' :
    priorPages.map((p, i) => {
      const chosen = p.choices?.[0]?.chosen_option;
      return `--- Page ${p.sequence} ---\n${p.content}${chosen ? `\n\nCommunity chose: "${chosen}"` : ''}`;
    }).join('\n\n');

  const styleBlock = style && (style.voice || style.tone || style.genre_conventions) ?
    [
      style.voice && `Voice: ${style.voice}`,
      style.tone && `Tone: ${style.tone}`,
      style.genre_conventions && `Genre conventions: ${style.genre_conventions}`,
      style.forbidden && `Forbidden: ${style.forbidden}`,
    ].filter(Boolean).join('\n') :
    '(no style guide yet — use clear, vivid, slightly cinematic prose)';

  const userMsg = `STYLE
${styleBlock}

CANON (facts that must hold)
${factBlock}

STORY SO FAR
${storySoFar}

${steering ? `LOREMASTER STEERING\n${steering}\n\n` : ''}Generate the next page.`;

  try {
    const { text } = await generate({
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
      max_tokens: 2048,
      factsUsed: (facts || []).map((f) => f.id),
    });

    // Strip fences, parse JSON
    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch { res.status(502).json({ error: 'Claude returned non-JSON', raw: text }); return; }

    if (typeof parsed.content !== 'string' || !Array.isArray(parsed.options)) {
      res.status(502).json({ error: 'Bad shape', raw: parsed }); return;
    }
    if (parsed.options.length < 2 || parsed.options.length > 3) {
      res.status(502).json({ error: `Options must be 2–3, got ${parsed.options.length}`, raw: parsed }); return;
    }

    // Determine next sequence number
    const { data: lastPage } = await admin
      .from('pages')
      .select('sequence')
      .eq('episode_id', episode.id)
      .order('sequence', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextSeq = (lastPage?.sequence ?? 0) + 1;

    const { data: row, error: insErr } = await admin
      .from('pages')
      .insert({
        episode_id: episode.id,
        sequence: nextSeq,
        content: parsed.content,
        options: parsed.options,
        status: 'draft',
        facts_used: (facts || []).map((f) => f.id),
      })
      .select()
      .single();

    if (insErr) { res.status(500).json({ error: insErr.message }); return; }
    res.status(200).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
