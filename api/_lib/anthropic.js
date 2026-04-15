// Thin Claude client + a helper that logs every call to cyoa.generations.

import Anthropic from '@anthropic-ai/sdk';
import { admin } from './supabase.js';

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error('Missing ANTHROPIC_API_KEY');

export const anthropic = new Anthropic({ apiKey });

// Rough cost estimate (Sonnet 4.6 pricing, USD per 1M tokens).
const PRICE_IN = 3 / 1_000_000;
const PRICE_OUT = 15 / 1_000_000;

/**
 * Call Claude and log the generation.
 * @param {object} opts
 * @param {string} opts.model  e.g. 'claude-sonnet-4-5'
 * @param {string} opts.system
 * @param {Array}  opts.messages
 * @param {number} [opts.max_tokens]
 * @param {string[]} [opts.factsUsed]  uuids of canon facts injected into prompt
 * @param {string}  [opts.pageId]      optional page id to attach the generation to
 */
export async function generate({
  model = 'claude-sonnet-4-5',
  system,
  messages,
  max_tokens = 4096,
  factsUsed = [],
  pageId = null,
}) {
  const resp = await anthropic.messages.create({
    model,
    system,
    messages,
    max_tokens,
  });

  const text = resp.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('\n');

  const tokens_in = resp.usage?.input_tokens ?? null;
  const tokens_out = resp.usage?.output_tokens ?? null;
  const cost_usd =
    tokens_in != null && tokens_out != null
      ? Number((tokens_in * PRICE_IN + tokens_out * PRICE_OUT).toFixed(6))
      : null;

  await admin.from('generations').insert({
    page_id: pageId,
    prompt: JSON.stringify({ system, messages }),
    response: text,
    model,
    tokens_in,
    tokens_out,
    cost_usd,
    facts_used: factsUsed,
  });

  return { text, tokens_in, tokens_out, cost_usd };
}
