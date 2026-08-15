/** Runtime settings — auto-reply toggle and configurable qualification rules. */
import type { FastifyInstance } from 'fastify';
import { getSettings, setSettings, getQualificationRules, setQualificationRules } from '../db/settings.repo.js';
import { mirrorSettings, mirrorQualificationRules } from '../firebase.js';
import type { QualificationRules } from '../services/qualification.service.js';

function isValidRules(body: unknown): body is QualificationRules {
  const b = body as QualificationRules;
  return (
    !!b &&
    Array.isArray(b.criteria) &&
    b.criteria.every(
      (c) =>
        typeof c.key === 'string' &&
        typeof c.label === 'string' &&
        typeof c.weight === 'number' &&
        typeof c.required === 'boolean'
    ) &&
    typeof b.qualifiedThreshold === 'number' &&
    typeof b.followUpThreshold === 'number'
  );
}

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

  app.get('/api/settings/qualification-rules', async () => getQualificationRules());

  app.put('/api/settings/qualification-rules', async (req, reply) => {
    if (!isValidRules(req.body)) return reply.code(400).send({ error: 'invalid qualification rules payload' });
    const next = await setQualificationRules(req.body);
    await mirrorQualificationRules(next as unknown as Record<string, unknown>);
    return next;
  });
}
