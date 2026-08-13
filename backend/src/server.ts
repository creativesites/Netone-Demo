import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config, flags } from './config.js';
import { logger } from './logger.js';
import { migrate } from './db/migrate.js';
import { webhookRoutes } from './routes/webhook.js';
import { streamRoutes } from './routes/stream.js';
import { leadRoutes } from './routes/leads.js';

async function main() {
  await migrate();

  const app = Fastify({ logger: false, trustProxy: true });
  await app.register(cors, { origin: true, credentials: true });

  app.get('/health', async () => ({ ok: true, service: 'backend' }));

  await app.register(webhookRoutes);
  await app.register(streamRoutes);
  await app.register(leadRoutes);

  await app.listen({ port: config.port, host: '0.0.0.0' });
  logger.info(
    {
      port: config.port,
      bitrix: flags.hasBitrix ? 'configured' : 'MISSING',
      ai: flags.hasDeepseek ? 'deepseek' : flags.hasGemini ? 'gemini' : 'deterministic-fallback',
    },
    'NetOne lead backend started'
  );
}

main().catch((err) => {
  logger.error({ err: String(err) }, 'Fatal startup error');
  process.exit(1);
});
