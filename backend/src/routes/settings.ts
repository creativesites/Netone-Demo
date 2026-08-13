/** Runtime settings — currently the autonomous auto-reply toggle. */
import type { FastifyInstance } from 'fastify';
import { getSettings, setSettings } from '../db/settings.repo.js';
import { mirrorSettings } from '../firebase.js';

export async function settingsRoutes(app: FastifyInstance): Promise<void> {
  app.get('/api/settings', async () => getSettings());

  app.put('/api/settings', async (req) => {
    const body = (req.body ?? {}) as { autoReplyEnabled?: boolean };
    const next = await setSettings({
      ...(typeof body.autoReplyEnabled === 'boolean' ? { autoReplyEnabled: body.autoReplyEnabled } : {}),
    });
    await mirrorSettings(next as unknown as Record<string, unknown>);
    return next;
  });
}
