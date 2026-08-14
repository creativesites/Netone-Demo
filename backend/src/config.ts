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

// Unique high port range (47xx) so this demo doesn't collide with other
// services/demos sharing the same host. Override any of these via .env.
export const config = {
  port: Number(process.env.BACKEND_PORT ?? 4702),
  databaseUrl: req(
    'DATABASE_URL',
    `postgresql://netone:netone_demo_pw@localhost:${process.env.POSTGRES_PORT ?? 4705}/netone_leads`
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

  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID ?? '',
    // Path to the service-account JSON (relative to backend/ or absolute).
    credentialsPath: process.env.FIREBASE_ADMIN_CREDENTIALS ?? './secrets/firebase-admin.json',
  },

  whatsappServiceUrl: process.env.WHATSAPP_SERVICE_URL ?? 'http://whatsapp:4703',

  // Autonomous auto-reply default (can be toggled at runtime via settings).
  autoReplyDefault: (process.env.AUTO_REPLY_DEFAULT ?? 'true') === 'true',
} as const;

export const flags = {
  hasDeepseek: !!config.ai.deepseek.apiKey,
  hasGemini: !!config.ai.gemini.apiKey,
  hasBitrix: !!config.bitrix.webhookUrl,
  hasFirebase: !!config.firebase.projectId,
};
