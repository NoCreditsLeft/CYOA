// POST /api/canon/breadcrumb
//
// Two-phase flow:
//
// Phase 1 — body: { text }
//   Parses breadcrumb via Claude, checks contradictions against active canon,
//   and either inserts directly (no conflicts) or returns 409 with
//   { parsed, conflicts } asking the loremaster to resolve.
//
// Phase 2 — body: { text, parsed, resolution: { mode, targets, explanation } }
//   Writes the new fact with the chosen resolution applied.
//   mode = 'supersede' → targets marked retracted/superseded; new fact wins.
//   mode = 'reconcile' → targets stay active; new fact links them via
//                        `reconciles` and carries the explanation.

import { requireSession } from '../_lib/session.js';
import { admin } from '../_lib/supabase.js';
import { generate } from '../_lib/anthropic.js';

const CATEGORIES = [
  'character_fact', 'world_rule', 'relationship',
  'consequence', 'item', 'location', 'other',
];
const SUBJECTS = ['character', 'world', 'item', 'location'];
const WEIGHTS = ['absolute', 'strong', 'soft'];

const PARSE_SYSTEM = `You normalize raw story notes ("breadcrumbs") into structured canon facts
for a Choose Your Own Adventure story. Output MUST be a single JSON object with these keys:

{
  "category":   one of ${CATEGORIES.map((c) => `"${c}"`).join(', ')},
  "subject_type": one of ${SUBJECTS.map((s) => `"${s}"`).join(', ')} or null,
  "subject_name": the name of the subject if identifiable (string) or null,
  "content":    a single, normalized declarative sentence capturing the fact,
  "weight":     one of ${WEIGHTS.map((w) => `"${w}"`).join(', ')}
}

Rules:
- "absolute" = unbreakable facts ("X will kill him", "Y is dead").
- "strong"   = firm but not existential ("X hates Y", "Z is brave").
- "soft"     = preferences / moods ("prefers tea", "feels uneasy around crowds").
- Keep content short, factual, third-person.
- Output JSON only. No prose, no markdown fences.`;

const CONFLICT_SYSTEM = `You check for contradictions between a proposed new canon fact and an existing set of canon facts.

Return a single JSON object:
{
  "conflicts": [
    { "id": "<uuid of conflicting fact>", "reason": "<one sentence why they contradict>" }
  ]
}

Rules:
- Only flag genuine logical contradictions ("fatally allergic" vs "eats it daily"). Do NOT flag merely adjacent or nuanced differences.
- If no conflicts, return {"conflicts": []}.
- Output JSON only. No prose, no markdown fences.`;

function stripFences(s) {
  return s.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

async function parseBreadcrumb(text) {
  const { text: out } = await generate({
    system: PARSE_SYSTEM,
    messages: [{ role: 'user', content: text }],
    max_tokens: 512,
  });
  const parsed = JSON.parse(stripFences(out));

  if (!CATEGORIES.includes(parsed.category)) throw new Error(`Invalid category: ${parsed.category}`);
  if (parsed.subject_type && !SUBJECTS.includes(parsed.subject_type)) throw new Error(`Invalid subject_type: ${parsed.subject_type}`);
  if (!WEIGHTS.includes(parsed.weight)) throw new Error(`Invalid weight: ${parsed.weight}`);

  return parsed;
}

async function detectConflicts(parsed, activeFacts) {
  if (!activeFacts.length) return [];

  const existingBlock = activeFacts.map((f) =>
    `id: ${f.id}\n[${f.weight.toUpperCase()} · ${f.category}] ${f.content}`
  ).join('\n\n');

  const user = `NEW FACT (proposed)\n[${parsed.weight.toUpperCase()} · ${parsed.category}] ${parsed.content}\n\nEXISTING CANON\n${existingBlock}`;

  const { text: out } = await generate({
    system: CONFLICT_SYSTEM,
    messages: [{ role: 'user', content: user }],
    max_tokens: 512,
  });

  const result = JSON.parse(stripFences(out));
  const conflicts = Array.isArray(result.conflicts) ? result.conflicts : [];
  const validIds = new Set(activeFacts.map((f) => f.id));
  return conflicts
    .filter((c) => c && typeof c.id === 'string' && validIds.has(c.id))
    .map((c) => ({ id: c.id, reason: String(c.reason || '') }));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  let wallet;
  try { ({ wallet } = await requireSession(req)); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); return; }

  const { text, parsed: providedParsed, resolution } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    res.status(400).json({ error: 'Missing text' });
    return;
  }

  try {
    // ── Parse (or reuse) ─────────────────────────────────
    const parsed = providedParsed || await parseBreadcrumb(text);

    // ── Resolve character subject_id if applicable ───────
    let subject_id = null;
    if (parsed.subject_type === 'character' && parsed.subject_name) {
      const { data } = await admin
        .from('characters')
        .select('id')
        .ilike('name', parsed.subject_name)
        .maybeSingle();
      subject_id = data?.id ?? null;
    }

    // ── Load active canon ────────────────────────────────
    const { data: active } = await admin
      .from('canon_facts')
      .select('id, category, weight, content, subject_type, subject_id')
      .eq('status', 'active');

    // ── Phase 1: conflict check (skip if resolution supplied) ─
    if (!resolution) {
      const conflicts = await detectConflicts(parsed, active || []);
      if (conflicts.length) {
        const conflictFacts = (active || [])
          .filter((f) => conflicts.find((c) => c.id === f.id))
          .map((f) => ({
            ...f,
            reason: conflicts.find((c) => c.id === f.id).reason,
          }));
        res.status(409).json({
          needs_resolution: true,
          parsed,
          conflicts: conflictFacts,
        });
        return;
      }
    } else {
      // ── Validate resolution ─────────────────────────────
      if (!['supersede', 'reconcile'].includes(resolution.mode)) {
        res.status(400).json({ error: 'Invalid resolution.mode' });
        return;
      }
      if (!Array.isArray(resolution.targets) || resolution.targets.length === 0) {
        res.status(400).json({ error: 'resolution.targets required' });
        return;
      }
      if (!resolution.explanation || !String(resolution.explanation).trim()) {
        res.status(400).json({ error: 'resolution.explanation required' });
        return;
      }
      const activeIds = new Set((active || []).map((f) => f.id));
      for (const t of resolution.targets) {
        if (!activeIds.has(t)) {
          res.status(400).json({ error: `Target ${t} is not an active canon fact` });
          return;
        }
      }
    }

    // ── Insert the new fact ──────────────────────────────
    const insertBody = {
      category: parsed.category,
      subject_type: parsed.subject_type,
      subject_id,
      content: parsed.content,
      raw_input: text,
      weight: parsed.weight,
      source: 'breadcrumb',
      added_by: wallet,
    };
    if (resolution?.mode === 'reconcile') {
      insertBody.reconciles = resolution.targets;
      insertBody.resolution_note = resolution.explanation.trim();
    }
    if (resolution?.mode === 'supersede') {
      insertBody.resolution_note = resolution.explanation.trim();
    }

    const { data: row, error } = await admin
      .from('canon_facts')
      .insert(insertBody)
      .select()
      .single();
    if (error) { res.status(500).json({ error: error.message }); return; }

    // ── Apply supersede side-effects ─────────────────────
    if (resolution?.mode === 'supersede') {
      const { error: supErr } = await admin
        .from('canon_facts')
        .update({ status: 'superseded', superseded_by: row.id })
        .in('id', resolution.targets);
      if (supErr) { res.status(500).json({ error: supErr.message }); return; }
    }

    res.status(200).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
