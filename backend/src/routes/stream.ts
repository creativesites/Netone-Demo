/** Server-Sent Events stream — the dashboard's real-time feed. */
import type { FastifyInstance } from 'fastify';
import { bus } from '../events/bus.js';
import { getMetrics, listRecentLeads } from '../db/leads.repo.js';
import { getIntegrationStatus } from '../services/status.service.js';

export async function streamRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/stream', async (req, reply) => {
    // We write to reply.raw directly, which bypasses @fastify/cors — so set the
    // CORS headers for the EventSource connection here explicitly.
    const origin = (req.headers.origin as string) || '*';
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Credentials': 'true',
      Vary: 'Origin',
    });
    reply.raw.write('retry: 3000\n\n');

    const send = (payload: unknown) => {
      reply.raw.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    // Initial snapshot so a freshly-opened dashboard is immediately populated.
    const [status, metrics, recent] = await Promise.all([
      getIntegrationStatus(),
      getMetrics(),
      listRecentLeads(20),
    ]);
    send({ type: 'hello', data: { status, metrics, recent } });

    const unsubscribe = bus.subscribe((payload) => send(payload));

    // Heartbeat keeps proxies from closing the idle connection.
    const heartbeat = setInterval(() => reply.raw.write(': ping\n\n'), 20000);

    req.raw.on('close', () => {
      clearInterval(heartbeat);
      unsubscribe();
    });

    // Keep the handler open.
    return reply;
  });
}
