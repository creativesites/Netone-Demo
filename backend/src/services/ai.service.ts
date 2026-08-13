/**
 * AI lead-intelligence service.
 *
 * Strategy: DeepSeek (primary) → Gemini (fallback) → deterministic keyword
 * classifier (last resort, so the demo NEVER dies if AI is down / out of tokens).
 * All model output is validated with Zod before it is trusted. The LLM only
 * *describes* the lead; the backend decides what actions happen.
 */
import { z } from 'zod';
import { config, flags } from '../config.js';
import { logger } from '../logger.js';
import type { LeadAnalysis } from '../types.js';

const analysisSchema = z.object({
  intent: z.enum([
    'product_inquiry',
    'financing_inquiry',
    'support',
    'complaint',
    'general',
    'unknown',
  ]),
  product: z.string().nullable(),
  financingInterest: z.boolean(),
  purchaseIntent: z.enum(['low', 'medium', 'high']),
  qualification: z.enum(['qualified', 'needs_follow_up', 'unqualified']),
  reasoning: z.string(),
  summary: z.string(),
});

const SYSTEM_PROMPT = `You are a lead-intelligence analyst for NetOne Zambia, a company that sells locally manufactured laptops and technology products, including through financing partners.

Analyze the customer's message and return ONLY a JSON object with these exact fields:
- "intent": one of "product_inquiry", "financing_inquiry", "support", "complaint", "general", "unknown"
- "product": the specific product mentioned (e.g. "laptop"), or null if none
- "financingInterest": true if the customer mentions or implies financing, installments, credit, or paying over time; else false
- "purchaseIntent": one of "low", "medium", "high"
- "qualification": one of "qualified", "needs_follow_up", "unqualified"
- "reasoning": one short sentence explaining your classification
- "summary": one professional sentence a sales rep can read at a glance

Return strictly valid JSON. No markdown, no commentary.`;

function buildUserPrompt(message: string, name: string | null): string {
  return `Customer name: ${name ?? 'Unknown'}\nMessage: "${message}"\n\nReturn the JSON analysis.`;
}

function coerce(raw: unknown, aiSource: LeadAnalysis['aiSource']): LeadAnalysis {
  const parsed = analysisSchema.parse(raw);
  return { ...parsed, aiSource };
}

// ── DeepSeek (OpenAI-compatible Chat Completions) ─────────────
async function analyzeWithDeepseek(message: string, name: string | null): Promise<LeadAnalysis> {
  const { apiKey, baseUrl, model } = config.ai.deepseek;
  const res = await fetchJson(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: buildUserPrompt(message, name) },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });
  const content = res?.choices?.[0]?.message?.content;
  return coerce(JSON.parse(content), 'deepseek');
}

// ── Gemini (Generative Language API) ──────────────────────────
async function analyzeWithGemini(message: string, name: string | null): Promise<LeadAnalysis> {
  const { apiKey, model } = config.ai.gemini;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: 'user', parts: [{ text: buildUserPrompt(message, name) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.2 },
    }),
  });
  const content = res?.candidates?.[0]?.content?.parts?.[0]?.text;
  return coerce(JSON.parse(content), 'gemini');
}

// ── Deterministic fallback (no external calls) ────────────────
function analyzeDeterministic(message: string): LeadAnalysis {
  const t = message.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => t.includes(w));

  const financingInterest = has('financ', 'installment', 'instalment', 'credit', 'loan', 'pay over', 'monthly', 'deposit', 'lipa');
  const productMatch = has('laptop') ? 'laptop' : has('phone', 'tablet', 'device', 'computer') ? 'device' : null;
  const buying = has('buy', 'purchase', 'get', 'interested', 'want', 'order', 'price', 'cost', 'how much');
  const isComplaint = has('complaint', 'broken', 'refund', 'not working', 'faulty', 'angry');
  const isSupport = has('help', 'support', 'issue', 'problem', 'repair');

  let intent: LeadAnalysis['intent'] = 'general';
  if (isComplaint) intent = 'complaint';
  else if (financingInterest && !productMatch) intent = 'financing_inquiry';
  else if (productMatch) intent = 'product_inquiry';
  else if (isSupport) intent = 'support';

  const purchaseIntent: LeadAnalysis['purchaseIntent'] =
    productMatch && buying ? 'high' : productMatch || buying ? 'medium' : 'low';

  return {
    intent,
    product: productMatch,
    financingInterest,
    purchaseIntent,
    qualification: purchaseIntent === 'high' ? 'qualified' : productMatch ? 'needs_follow_up' : 'unqualified',
    reasoning: 'Classified by deterministic keyword rules (AI provider unavailable).',
    summary: productMatch
      ? `Customer is interested in a ${productMatch}${financingInterest ? ' with financing' : ''}.`
      : 'General inbound message; needs manual review.',
    aiSource: 'deterministic',
  };
}

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

/**
 * Analyze a message, cascading through providers. Returns a validated
 * LeadAnalysis plus a flag for whether real AI was used (for dashboard warnings).
 */
export async function analyzeLead(
  message: string,
  name: string | null
): Promise<{ analysis: LeadAnalysis; degraded: boolean; error?: string }> {
  const order =
    config.ai.provider === 'gemini' ? (['gemini', 'deepseek'] as const) : (['deepseek', 'gemini'] as const);

  let lastError: string | undefined;

  for (const provider of order) {
    try {
      if (provider === 'deepseek' && flags.hasDeepseek) {
        const analysis = await analyzeWithDeepseek(message, name);
        return { analysis, degraded: false };
      }
      if (provider === 'gemini' && flags.hasGemini) {
        const analysis = await analyzeWithGemini(message, name);
        return { analysis, degraded: false };
      }
    } catch (err) {
      lastError = String(err);
      logger.warn({ provider, err: lastError }, 'AI provider failed, trying next');
    }
  }

  logger.warn({ lastError }, 'All AI providers unavailable — using deterministic fallback');
  return { analysis: analyzeDeterministic(message), degraded: true, error: lastError };
}
