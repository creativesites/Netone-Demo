/**
 * AI intelligence service.
 *
 *   classifyLead()  — gatekeeper + intelligence. Decides whether an inbound
 *                     message is a sales lead and extracts structured info.
 *   converse()      — conversational agent. Produces the next friendly, natural
 *                     reply AND the updated collected profile.
 *
 * Strategy: DeepSeek (primary) → Gemini (fallback) → deterministic (last resort,
 * so the demo never dies). All model output is validated with Zod before use.
 * The LLM only describes / drafts; the backend decides what actions happen.
 */
import { z } from 'zod';
import { config, flags } from '../config.js';
import { logger } from '../logger.js';
import type { AgentTurn, CollectedProfile, LeadAnalysis } from '../types.js';
import { REQUIRED_FIELDS } from '../types.js';

// Models sometimes return numbers (e.g. budget: 8000) where we want a string.
// Coerce number → string, keep null/undefined as null.
const nullableString = z.preprocess(
  (v) => (v === null || v === undefined ? null : typeof v === 'number' ? String(v) : v),
  z.string().nullable()
);

// ── Classification (gatekeeper + intelligence) ────────────────
const analysisSchema = z.object({
  intent: z.enum([
    'product_inquiry',
    'financing_inquiry',
    'support',
    'complaint',
    'general',
    'unknown',
  ]),
  isLead: z.boolean(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  product: nullableString,
  financingInterest: z.boolean(),
  purchaseIntent: z.enum(['low', 'medium', 'high']),
  qualification: z.enum(['qualified', 'needs_follow_up', 'unqualified']),
  reasoning: z.string(),
  summary: z.string(),
});

const CLASSIFY_PROMPT = `You are the lead-qualification gatekeeper for NetOne Zambia, which sells locally manufactured laptops and technology products, including on financing.

Decide whether an incoming WhatsApp message is a SALES LEAD (a prospect interested in buying / financing / pricing a product) versus noise (greetings only, spam, wrong numbers, existing-order support, complaints, general chit-chat).

Return ONLY a JSON object with these exact fields:
- "intent": "product_inquiry" | "financing_inquiry" | "support" | "complaint" | "general" | "unknown"
- "isLead": true only if this is a genuine sales opportunity worth routing to sales
- "sentiment": "positive" | "neutral" | "negative"
- "product": specific product mentioned (e.g. "laptop") or null
- "financingInterest": true if financing / installments / credit / paying over time is mentioned or implied
- "purchaseIntent": "low" | "medium" | "high"
- "qualification": "qualified" | "needs_follow_up" | "unqualified"
- "reasoning": one short sentence
- "summary": one professional sentence for a sales rep

Return strictly valid JSON. No markdown, no commentary.`;

function coerceAnalysis(raw: unknown, aiSource: LeadAnalysis['aiSource']): LeadAnalysis {
  return { ...analysisSchema.parse(raw), aiSource };
}

// ── Conversational agent ──────────────────────────────────────
const agentSchema = z.object({
  reply: z.string().min(1),
  collected: z.object({
    name: nullableString,
    product: nullableString,
    financing: nullableString,
    budget: nullableString,
    location: nullableString,
  }),
  complete: z.boolean(),
});

const AGENT_PROMPT = `You are "Nia", a warm, friendly and professional sales assistant for NetOne Zambia (locally made laptops & tech, available on financing).

You are chatting with a prospect on WhatsApp. Your goals, in order:
1. Be genuinely helpful, natural and concise — like a real Zambian sales rep. 1–3 short sentences, WhatsApp tone. You may use at most one tasteful emoji.
2. Naturally collect these details you don't yet have: full name, which product they want, financing preference (cash or installments + rough term), budget/price range, and their location/city.
3. Ask for only ONE missing detail per message so it feels like a conversation, not a form. Acknowledge what they just said first.
4. When you have all details, warmly confirm a NetOne sales rep will follow up shortly, and set complete=true.

You are given the conversation so far and the details already collected. Return ONLY a JSON object:
- "reply": the next message to send the prospect
- "collected": { "name", "product", "financing", "budget", "location" } — carry forward known values, fill in anything new from the latest message, use null when still unknown
- "complete": true only once every field is filled and you've confirmed follow-up

Return strictly valid JSON. No markdown.`;

function missingFields(c: CollectedProfile): string[] {
  return REQUIRED_FIELDS.filter((f) => !c[f] || String(c[f]).trim() === '');
}

// ── Provider calls ────────────────────────────────────────────
async function deepseekJson(system: string, user: string): Promise<any> {
  const { apiKey, baseUrl, model } = config.ai.deepseek;
  const res = await fetchJson(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });
  return JSON.parse(res?.choices?.[0]?.message?.content);
}

async function geminiJson(system: string, user: string): Promise<any> {
  const { apiKey, model } = config.ai.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
    }),
  });
  return JSON.parse(res?.candidates?.[0]?.content?.parts?.[0]?.text);
}

/** Try providers in order; returns the parsed JSON and which provider answered. */
async function callJson(
  system: string,
  user: string
): Promise<{ json: any; source: 'deepseek' | 'gemini' } | null> {
  const order =
    config.ai.provider === 'gemini' ? (['gemini', 'deepseek'] as const) : (['deepseek', 'gemini'] as const);
  for (const p of order) {
    try {
      if (p === 'deepseek' && flags.hasDeepseek) return { json: await deepseekJson(system, user), source: 'deepseek' };
      if (p === 'gemini' && flags.hasGemini) return { json: await geminiJson(system, user), source: 'gemini' };
    } catch (err) {
      logger.warn({ provider: p, err: String(err) }, 'AI provider failed, trying next');
    }
  }
  return null;
}

// ── Deterministic fallback (no external calls) ────────────────
function classifyDeterministic(message: string): LeadAnalysis {
  const t = message.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => t.includes(w));
  const financingInterest = has('financ', 'installment', 'instalment', 'credit', 'loan', 'monthly', 'deposit', 'lipa');
  const product = has('laptop') ? 'laptop' : has('phone', 'tablet', 'device', 'computer') ? 'device' : null;
  const buying = has('buy', 'purchase', 'get', 'interested', 'want', 'order', 'price', 'cost', 'how much');
  const isComplaint = has('complaint', 'broken', 'refund', 'faulty', 'angry', 'not working');
  const isSupport = has('help', 'support', 'issue', 'problem', 'repair');
  let intent: LeadAnalysis['intent'] = 'general';
  if (isComplaint) intent = 'complaint';
  else if (financingInterest && !product) intent = 'financing_inquiry';
  else if (product) intent = 'product_inquiry';
  else if (isSupport) intent = 'support';
  const purchaseIntent: LeadAnalysis['purchaseIntent'] = product && buying ? 'high' : product || buying ? 'medium' : 'low';
  const isLead = !!product || (financingInterest && buying) || (intent === 'product_inquiry' || intent === 'financing_inquiry');
  return {
    intent,
    isLead,
    sentiment: isComplaint ? 'negative' : 'neutral',
    product,
    financingInterest,
    purchaseIntent,
    qualification: purchaseIntent === 'high' ? 'qualified' : product ? 'needs_follow_up' : 'unqualified',
    reasoning: 'Classified by deterministic keyword rules (AI unavailable).',
    summary: product ? `Customer is interested in a ${product}${financingInterest ? ' with financing' : ''}.` : 'General inbound message; needs manual review.',
    aiSource: 'deterministic',
  };
}

function converseDeterministic(history: string, collected: CollectedProfile): AgentTurn {
  const missing = missingFields(collected);
  const ask: Record<string, string> = {
    name: 'May I get your full name, please?',
    product: 'Which product are you interested in — one of our NetOne laptops?',
    financing: 'Would you prefer to pay cash or on financing (monthly installments)?',
    budget: 'Roughly what budget did you have in mind?',
    location: 'Which city or area are you based in, so we can arrange delivery or your nearest branch?',
  };
  if (missing.length === 0) {
    return { reply: 'Thank you! A NetOne sales representative will contact you shortly to finalise everything. 😊', collected, complete: true };
  }
  return { reply: `Thanks for reaching out to NetOne! ${ask[missing[0]]}`, collected, complete: false };
}

// ── Public API ────────────────────────────────────────────────
export async function classifyLead(
  message: string,
  name: string | null
): Promise<{ analysis: LeadAnalysis; degraded: boolean }> {
  const user = `Customer name: ${name ?? 'Unknown'}\nMessage: "${message}"\n\nReturn the JSON analysis.`;
  const result = await callJson(CLASSIFY_PROMPT, user);
  if (result) {
    try {
      return { analysis: coerceAnalysis(result.json, result.source), degraded: false };
    } catch (err) {
      logger.warn({ err: String(err) }, 'AI classification failed schema validation — falling back');
    }
  }
  return { analysis: classifyDeterministic(message), degraded: true };
}

export async function converse(
  historyLines: string,
  collected: CollectedProfile,
  name: string | null
): Promise<{ turn: AgentTurn; degraded: boolean }> {
  const user = `Prospect name (if known): ${name ?? 'Unknown'}
Already collected: ${JSON.stringify(collected)}
Still missing: ${JSON.stringify(missingFields(collected))}

Conversation so far:
${historyLines}

Write the next reply and return the JSON.`;
  const result = await callJson(AGENT_PROMPT, user);
  if (result) {
    try {
      const turn = agentSchema.parse(result.json);
      // Never let the model silently drop an already-known field.
      const merged: CollectedProfile = {
        name: turn.collected.name ?? collected.name,
        product: turn.collected.product ?? collected.product,
        financing: turn.collected.financing ?? collected.financing,
        budget: turn.collected.budget ?? collected.budget,
        location: turn.collected.location ?? collected.location,
      };
      const complete = missingFields(merged).length === 0;
      return { turn: { reply: turn.reply, collected: merged, complete }, degraded: false };
    } catch (err) {
      logger.warn({ err: String(err) }, 'AI agent failed schema validation — falling back');
    }
  }
  return { turn: converseDeterministic(historyLines, collected), degraded: true };
}

// ── low-level fetch with timeout ──────────────────────────────
async function fetchJson(url: string, init: RequestInit): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    const json = await res.json();
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${JSON.stringify(json).slice(0, 200)}`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}
