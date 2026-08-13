/** Runtime settings (key/value JSON). Currently: the auto-reply toggle. */
import { query } from './pool.js';
import { config } from '../config.js';

export interface AppSettings {
  autoReplyEnabled: boolean;
}

export async function getSettings(): Promise<AppSettings> {
  const res = await query<{ value: AppSettings }>(
    `SELECT value FROM app_settings WHERE key = 'app'`
  );
  if (res.rows[0]) return { autoReplyEnabled: !!res.rows[0].value.autoReplyEnabled };
  return { autoReplyEnabled: config.autoReplyDefault };
}

export async function setSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next: AppSettings = { ...current, ...patch };
  await query(
    `INSERT INTO app_settings (key, value) VALUES ('app', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [JSON.stringify(next)]
  );
  return next;
}
