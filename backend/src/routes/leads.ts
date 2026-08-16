/** REST endpoints backing the dashboard (leads, metrics, status). */
import type { FastifyInstance } from 'fastify';
import { getLeadById, getLeadEvents, getMetrics, listRecentLeads, getAnalytics } from '../db/leads.repo.js';
import { getIntegrationStatus } from '../services/status.service.js';

export async function leadRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/leads', async (req) => {
    const requested = Number((req.query as { limit?: string }).limit);
    const limit = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 1000) : 50;
    const recent = await listRecentLeads(limit);
    return { leads: recent };
  });

  app.get('/api/leads/:id', async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    if (!Number.isInteger(id)) return reply.code(400).send({ error: 'invalid id' });
    const lead = await getLeadById(id);
    if (!lead) return reply.code(404).send({ error: 'not found' });
    const events = await getLeadEvents(id);
    return { lead, events };
  });

  app.get('/api/metrics', async () => {
    const [metrics, recent] = await Promise.all([getMetrics(), listRecentLeads(20)]);
    return { metrics, recent };
  });

  app.get('/api/status', async () => {
    return getIntegrationStatus();
  });

  app.get('/api/analytics', async (req) => {
    const requested = Number((req.query as { days?: string }).days);
    const days = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 90) : 14;
    return getAnalytics(days);
  });
}
