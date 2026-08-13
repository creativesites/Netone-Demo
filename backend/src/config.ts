/** Centralized, validated environment configuration. Server-side only. */
import { config as loadEnv } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// Load repo-root .env first (local dev), then any backend-local .env. In Docker
// these files are absent and real env vars from compose take precedence.
const here = dirname(fileURLToPath(import.meta.url));
loadEnv({ path: join(here, '../../.env') });
loadEnv();

function req(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (v === undefined) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const config = {
  port: Number(process.env.BACKEND_PORT ?? 4000),
  databaseUrl: req(
    'DATABASE_URL',
    'postgresql://netone:netone_demo_pw@localhost:5432/netone_leads'
  ),
  webhookSecret: process.env.WEBHOOK_SHARED_SECRET ?? '',

  ai: {
    provider: (process.env.AI_PROVIDER ?? 'deepseek').toLowerCase(),
    deepseek: {
      apiKey: process.env.DEEPSEEK_API_KEY ?? '',
      baseUrl: process.env.DEEPSEEK_BASE_URL ?? 'https://api.deepseek.com',
      model: process.env.DEEPSEEK_MODEL ?? 'deepseek-chat',
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY ?? '',
      model: process.env.GEMINI_MODEL ?? 'gemini-1.5-flash',
    },
  },

  bitrix: {
    webhookUrl: process.env.BITRIX24_WEBHOOK_URL ?? '',
    assignedById: process.env.BITRIX24_ASSIGNED_BY_ID ?? '',
  },

  whatsappServiceUrl: process.env.WHATSAPP_SERVICE_URL ?? 'http://whatsapp:3000',
} as const;

export const flags = {
  hasDeepseek: !!config.ai.deepseek.apiKey,
  hasGemini: !!config.ai.gemini.apiKey,
  hasBitrix: !!config.bitrix.webhookUrl,
};
