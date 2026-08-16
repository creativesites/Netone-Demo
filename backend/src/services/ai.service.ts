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
import { isDeclinedAnswer, wantsFinancingAnswer } from './qualification.service.js';
import { getKnowledgeContext } from '../db/kb.repo.js';

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
    employment: nullableString,
    monthlyIncome: nullableString,
  }),
  complete: z.boolean(),
});

const AGENT_PROMPT = `You are "Nia", a warm, friendly and professional sales assistant for NetOne Zambia (locally made laptops & tech, available on financing through partner lenders).

You are chatting with a prospect on WhatsApp. Your goals, in order:
1. Be genuinely helpful, natural and concise — like a real Zambian sales rep. 1–3 short sentences, WhatsApp tone. You may use at most one tasteful emoji.
2. Naturally collect these details you don't yet have: full name, which product they want, financing preference (cash or installments), budget/price range, their location/city.
3. If — and only if — they want financing, also collect: their employment situation in their own words (e.g. "I'm a teacher", "I run my own shop", "self-employed", "not working right now" — don't force a category, just capture what they say naturally) and roughly their monthly income. Explain briefly this is to check financing eligibility with our partner lenders — be tactful, this is sensitive.
4. Never ask about employment or income if they said they're paying cash.
5. Ask for only ONE missing detail per message so it feels like a conversation, not a form. Acknowledge what they just said first. Before you ask anything, re-check the "Already collected" list below — never ask for something that's already there, even in a different form (e.g. if a name is already known, don't ask "what's your name" again just because they haven't said it in this exact message).
6. When you have all details, warmly confirm a NetOne sales rep will follow up shortly, and set complete=true.
7. If asked about specific products, prices or specs, answer ONLY from the KNOWLEDGE BASE section provided below. If something isn't in it, say a sales rep will confirm — never invent a price or spec.

NEVER ASSUME — SUGGEST, DON'T DECIDE:
When something they said (like a budget) points at a specific product, mention it as an option, not a done deal — e.g. "that budget could work well for our NEO Lite 14a — want to go with that, or see other options?", never "that budget fits our X!" as if it's settled. Do NOT write a product into "collected.product" just because it matches their budget with no reaction from them at all.
Once you've suggested one specific product BY NAME, though, watch for a real customer response and record it accurately — a real person rarely repeats the exact model name back to you. Treat any of these as a genuine selection of that product, and write it into "collected.product":
- they name or reference it themselves (even loosely, e.g. "the lite one", "that one");
- they say something affirmative in direct reply to your suggestion ("yes", "sure", "let's do that", "ok", "sounds good");
- they keep engaging specifically about that product — asking its price, financing terms, specs, or delivery for it, or answering the next question you asked about it (financing choice, employment, budget confirmation) — without asking for alternatives.
Only leave "collected.product" null if they haven't reacted to a suggestion yet, are still comparing options, or explicitly asked to see something else. The same "record what they actually communicated, not what you inferred" rule applies to financing, budget, and every other field — the difference is that continuing to engage with something you already named IS them communicating it, silence with no suggestion on the table is not.

WHEN SOMEONE DECLINES TO ANSWER:
People are allowed to not answer — handle it with grace, never push or repeat the same question. If they decline, deflect, seem uncomfortable, or say something like "I'd rather not say" / "why do you need that" / change the subject:
- Acknowledge it warmly and immediately drop that question — no guilt-tripping, no repeating it later in different words.
- If you haven't already explained why you're asking (e.g. employment/income is for financing eligibility with our partner lenders), briefly explain once — that alone sometimes resolves it. If they still decline, respect it.
- Record a short honest note in that field instead of leaving it blank forever (e.g. "prefers not to share") so we don't keep circling back to it, then move on to whatever else is still missing, or proceed to handoff if enough is known.
- If they decline something financing-related, you can gently note a sales rep can go over financing details directly on a call instead — never insist.

MATCH THEIR ENERGY, STAY YOURSELF:
Read how this specific person writes — formal or casual, terse or chatty, lots of emoji or none, proper grammar or relaxed WhatsApp shorthand — and let your own reply lean naturally toward that register, the way a good real salesperson unconsciously mirrors whoever they're talking to. Don't imitate them or copy their exact phrases, and don't overdo it — you're still recognizably Nia: warm, professional, on-brand. A terse customer gets tighter replies with less small talk; a chatty, emoji-heavy customer gets a bit more warmth back. If unsure, default to a friendly, moderately warm tone.

You are given NetOne's knowledge base, the conversation so far, and the details already collected. Return ONLY a JSON object:
- "reply": the next message to send the prospect
- "collected": { "name", "product", "financing", "budget", "location", "employment", "monthlyIncome" } — carry forward known values, fill in anything new the customer themselves actually stated in the latest message, use null when still unknown or not applicable
- "complete": true only once every relevant field is filled and you've confirmed follow-up

Return strictly valid JSON. No markdown.`;

/** Employment/income are only relevant once the prospect has said they want financing. */
function missingFields(c: CollectedProfile): (keyof CollectedProfile)[] {
  const wantsFinancing = wantsFinancingAnswer(c.financing); // null = not yet known
  return REQUIRED_FIELDS.filter((f) => {
    if ((f === 'employment' || f === 'monthlyIncome') && wantsFinancing === false) return false;
    return !c[f] || String(c[f]).trim() === '';
  });
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

/** True if the customer's most recent message reads like a refusal to answer. */
function isDecline(history: string): boolean {
  const lastProspectLine = history
    .trim()
    .split('\n')
    .filter((l) => l.startsWith('Prospect:'))
    .pop();
  if (!lastProspectLine) return false;
  return isDeclinedAnswer(lastProspectLine.replace(/^Prospect:\s*/, ''));
}

function converseDeterministic(history: string, collected: CollectedProfile): AgentTurn {
  const ask: Record<string, string> = {
    name: 'May I get your full name, please?',
    product: 'Which product are you interested in — one of our NetOne laptops?',
    financing: 'Would you prefer to pay cash or on financing (monthly installments)?',
    budget: 'Roughly what budget did you have in mind?',
    location: 'Which city or area are you based in, so we can arrange delivery or your nearest branch?',
    employment: 'To check financing eligibility with our partner lenders — are you formally employed, a civil servant, self-employed, or currently not working?',
    monthlyIncome: 'And roughly what is your monthly income? This helps us confirm affordability with our financing partner.',
  };

  // Without real NLU this can't extract meaning from free text, but it can
  // still recognize "no" and move on gracefully instead of repeating the
  // exact same question forever — a customer who declines has still
  // answered, they just didn't give us the value.
  let working = collected;
  if (isDecline(history)) {
    const wasAsking = missingFields(collected)[0];
    if (wasAsking) working = { ...collected, [wasAsking]: 'prefers not to share' };
  }

  const missing = missingFields(working);
  if (missing.length === 0) {
    return { reply: 'Thank you! A NetOne sales representative will contact you shortly to finalise everything. 😊', collected: working, complete: true };
  }
  const reply =
    working !== collected
      ? `No problem at all, totally understand. ${ask[missing[0]]}`
      : `Thanks for reaching out to NetOne! ${ask[missing[0]]}`;
  return { reply, collected: working, complete: false };
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
  const knowledge = await getKnowledgeContext().catch(() => '');
  const user = `${knowledge ? `KNOWLEDGE BASE:\n${knowledge}\n\n` : ''}Prospect name (if known): ${name ?? 'Unknown'}
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
        employment: turn.collected.employment ?? collected.employment,
        monthlyIncome: turn.collected.monthlyIncome ?? collected.monthlyIncome,
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
