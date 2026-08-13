import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config, flags } from './config.js';
import { logger } from './logger.js';
import { migrate } from './db/migrate.js';
import { initFirebase, firestoreReady, mirrorSettings, mirrorStatus, mirrorMetrics, mirrorConversation, mirrorLead } from './firebase.js';
import { getIntegrationStatus } from './services/status.service.js';
import { getSettings } from './db/settings.repo.js';
import { getMetrics, listRecentLeads } from './db/leads.repo.js';
import { listConversations } from './db/conversations.repo.js';
import { webhookRoutes } from './routes/webhook.js';
import { streamRoutes } from './routes/stream.js';
import { leadRoutes } from './routes/leads.js';
import { settingsRoutes } from './routes/settings.js';
import { inboxRoutes } from './routes/inbox.js';
import { whatsappRoutes } from './routes/whatsapp.js';

/** Push current DB state into Firestore so a freshly-opened dashboard is populated. */
async function seedMirror(): Promise<void> {
  if (!firestoreReady()) return;
  try {
    const [settings, status, metrics, recent, conversations] = await Promise.all([
      getSettings(),
      getIntegrationStatus(),
      getMetrics(),
      listRecentLeads(20),
      listConversations(50),
    ]);
    await mirrorSettings(settings as unknown as Record<string, unknown>);
    await mirrorStatus(status as unknown as Record<string, unknown>);
    await mirrorMetrics({ ...metrics, recent });
    for (const lead of recent) await mirrorLead(lead as unknown as Record<string, unknown>);
    for (const conv of conversations) await mirrorConversation(conv as unknown as Record<string, unknown>);
    logger.info('Firestore seeded with current state');
  } catch (err) {
    logger.warn({ err: String(err) }, 'Firestore seed failed');
  }
}

/** Keep the integration-status doc fresh (WhatsApp connection changes over time). */
function startStatusHeartbeat(): void {
  if (!firestoreReady()) return;
  setInterval(async () => {
    try {
      await mirrorStatus((await getIntegrationStatus()) as unknown as Record<string, unknown>);
    } catch {
      /* best-effort */
    }
  }, 15000).unref();
}

async function main() {
  await migrate();
  initFirebase();

  const app = Fastify({ logger: false, trustProxy: true });
  await app.register(cors, { origin: true, credentials: true });

  app.get('/health', async () => ({ ok: true, service: 'backend', firestore: firestoreReady() }));

  await app.register(webhookRoutes);
  await app.register(streamRoutes);
  await app.register(leadRoutes);
  await app.register(settingsRoutes);
  await app.register(inboxRoutes);
  await app.register(whatsappRoutes);

  await app.listen({ port: config.port, host: '0.0.0.0' });
  logger.info(
    {
      port: config.port,
      bitrix: flags.hasBitrix ? 'configured' : 'MISSING',
      ai: flags.hasDeepseek ? 'deepseek' : flags.hasGemini ? 'gemini' : 'deterministic-fallback',
      firestore: firestoreReady() ? 'on' : 'off',
    },
    'NetOne lead backend started'
  );

  await seedMirror();
  startStatusHeartbeat();
}

main().catch((err) => {
  logger.error({ err: String(err) }, 'Fatal startup error');
  process.exit(1);
});
