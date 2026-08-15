/** Runtime settings (key/value JSON): auto-reply toggle, qualification rules. */
import { query } from './pool.js';
import { config } from '../config.js';
import { DEFAULT_QUALIFICATION_RULES, type QualificationRules } from '../services/qualification.service.js';

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

/** NetOne's configurable lead-qualification criteria — weights, required fields, thresholds. */
export async function getQualificationRules(): Promise<QualificationRules> {
  const res = await query<{ value: QualificationRules }>(
    `SELECT value FROM app_settings WHERE key = 'qualification_rules'`
  );
  if (res.rows[0]) return res.rows[0].value;
  return DEFAULT_QUALIFICATION_RULES;
}

export async function setQualificationRules(rules: QualificationRules): Promise<QualificationRules> {
  await query(
    `INSERT INTO app_settings (key, value) VALUES ('qualification_rules', $1)
     ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()`,
    [JSON.stringify(rules)]
  );
  return rules;
}
