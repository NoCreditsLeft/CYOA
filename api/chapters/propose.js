// POST /api/chapters/propose
// Body: { steering?: string }
// Claude proposes the next chapter goal based on:
//   episode goal, completed chapters, current canon, story so far

import { requireSession } from '../_lib/session.js';
import { admin } from '../_lib/supabase.js';
import { generate } from '../_lib/anthropic.js';

const SYSTEM = `You are the story architect for a Choose Your Own Adventure series.

Your job: propose the NEXT chapter — a milestone that moves the story one step closer to the episode's final goal.

Rules:
- Consider how many chapters remain and pace accordingly.
- Early chapters: build tension, introduce mysteries, widen the world.
- Middle chapters: raise stakes, test characters, create hard choices.
- Late chapters: converge threads, force consequences, approach the climax.
- The final chapter must credibly deliver (or subvert) the episode goal.
- Each chapter goal should be specific enough to know when it's achieved.
- Output JSON only: { "title": string, "goal": string }
- No markdown fences, no extra prose.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

  try { await requireSession(req); }
  catch (e) { res.status(e.status || 500).json({ error: e.message }); return; }

  const { steering = '' } = req.body || {};

  // Active episode
  const { data: episode } = await admin
    .from('episodes')
    .select('id, number, title, goal')
    .eq('status', 'active')
    .order('number', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!episode) { res.status(400).json({ error: 'No active episode' }); return; }
  if (!episode.goal) { res.status(400).json({ error: 'Episode has no goal set. Set it first.' }); return; }

  // Existing chapters
  const { data: chapters } = await admin
    .from('chapters')
    .select('sequence, title, goal, summary, status')
    .eq('episode_id', episode.id)
    .order('sequence', { ascending: true });

  // Check there's no pending proposed chapter
  const pending = (chapters || []).find((c) => c.status === 'proposed');
  if (pending) {
    res.status(409).json({ error: 'A proposed chapter already exists. Approve or delete it first.', chapter: pending });
    return;
  }

  const nextSeq = ((chapters || []).length) + 1;
  const totalTarget = 10; // target ~10 chapters
  const remaining = totalTarget - nextSeq + 1;

  // Active canon
  const { data: facts } = await admin
    .from('canon_facts')
    .select('category, content, weight')
    .eq('status', 'active');

  // Recent story (last chapter's pages if any)
  const lastComplete = [...(chapters || [])].reverse().find((c) => c.status === 'complete');
  let recentStory = '(no pages yet)';
  if (lastComplete || (chapters || []).some((c) => c.status === 'active')) {
    const activeChapter = (chapters || []).find((c) => c.status === 'active');
    const chapterId = activeChapter ? activeChapter.id : null;
    // Get last few locked pages across episode for context
    const { data: recentPages } = await admin
      .from('pages')
      .select('sequence, content, choices(chosen_option)')
      .eq('episode_id', episode.id)
      .in('status', ['locked', 'canonical'])
      .order('sequence', { ascending: false })
      .limit(5);
    if (recentPages && recentPages.length > 0) {
      recentStory = recentPages.reverse().map((p) => {
        const chosen = p.choices?.[0]?.chosen_option;
        return `Page ${p.sequence}: ${p.content.slice(0, 200)}...${chosen ? ` [Chose: "${chosen}"]` : ''}`;
      }).join('\n\n');
    }
  }

  const chapterHistory = (chapters || []).filter((c) => c.status === 'complete').length === 0
    ? '(this will be the first chapter)'
    : (chapters || []).filter((c) => c.status === 'complete').map((c) =>
        `Ch ${c.sequence}: "${c.title}" — ${c.goal}${c.summary ? ` (Result: ${c.summary})` : ''}`
      ).join('\n');

  const factBlock = (facts || []).length === 0 ? '(none)'
    : facts.map((f) => `- [${f.weight.toUpperCase()}] ${f.content}`).join('\n');

  const userMsg = `EPISODE: "${episode.title}"
EPISODE GOAL: ${episode.goal}

CHAPTERS COMPLETED (${(chapters || []).filter((c) => c.status === 'complete').length} of ~${totalTarget}):
${chapterHistory}

PROPOSING: Chapter ${nextSeq} (~${remaining} chapters remain to reach the goal)

KEY CANON:
${factBlock}

RECENT STORY:
${recentStory}

${steering ? `LOREMASTER STEERING: ${steering}\n\n` : ''}Propose the next chapter.`;

  try {
    const { text } = await generate({
      system: SYSTEM,
      messages: [{ role: 'user', content: userMsg }],
      max_tokens: 512,
      factsUsed: [],
    });

    const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch { res.status(502).json({ error: 'Claude returned non-JSON', raw: text }); return; }

    if (!parsed.title || !parsed.goal) {
      res.status(502).json({ error: 'Bad shape — need title + goal', raw: parsed }); return;
    }

    // Insert as proposed
    const { data: row, error: insErr } = await admin
      .from('chapters')
      .insert({
        episode_id: episode.id,
        sequence: nextSeq,
        title: parsed.title,
        goal: parsed.goal,
        status: 'proposed',
      })
      .select()
      .single();

    if (insErr) { res.status(500).json({ error: insErr.message }); return; }
    res.status(200).json(row);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
