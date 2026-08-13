/**
 * Firebase Admin — the real-time mirror.
 *
 * Postgres remains the durable source of truth. On every meaningful change the
 * backend also writes a denormalized copy to Firestore, which the dashboard and
 * inbox subscribe to for instant, listener-driven updates (no polling, no SSE).
 *
 * All mirror writes are best-effort: a Firestore hiccup must never break the
 * lead pipeline, so failures are logged and swallowed.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import admin from 'firebase-admin';
import { config, flags } from './config.js';
import { logger } from './logger.js';

const here = dirname(fileURLToPath(import.meta.url));

let db: admin.firestore.Firestore | null = null;

export function initFirebase(): void {
  if (!flags.hasFirebase) {
    logger.warn('Firebase not configured — real-time mirror disabled (dashboard falls back to REST/SSE).');
    return;
  }
  try {
    // Resolve credentials path relative to backend/ (one level up from dist/src).
    const credPath = config.firebase.credentialsPath.startsWith('/')
      ? config.firebase.credentialsPath
      : resolve(here, '..', config.firebase.credentialsPath);
    const serviceAccount = JSON.parse(readFileSync(credPath, 'utf8'));
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: config.firebase.projectId,
    });
    db = admin.firestore();
    // preferRest avoids gRPC, which does not traverse an HTTPS forward proxy.
    db.settings({ ignoreUndefinedProperties: true, preferRest: true });
    logger.info({ projectId: config.firebase.projectId }, 'Firebase Admin initialized');
  } catch (err) {
    logger.error({ err: String(err) }, 'Firebase init failed — mirror disabled');
    db = null;
  }
}

export function firestoreReady(): boolean {
  return db !== null;
}

const TS = () => admin.firestore.FieldValue.serverTimestamp();

let consecutiveFailures = 0;
let mirrorDisabled = false;

async function safe(op: () => Promise<unknown>, label: string): Promise<void> {
  if (!db || mirrorDisabled) return;
  try {
    await op();
    consecutiveFailures = 0;
  } catch (err) {
    consecutiveFailures++;
    const msg = String(err);
    // Circuit-breaker: if Firestore is unreachable/disabled, stop hammering it
    // (and stop spamming logs) until the process restarts.
    if (consecutiveFailures >= 5) {
      mirrorDisabled = true;
      logger.error(
        { label },
        'Firestore mirror DISABLED after repeated failures. Likely the Cloud Firestore API is not enabled / no database created for this project. Enable it in the Firebase console, then restart the backend. The pipeline continues on Postgres + SSE regardless.'
      );
      return;
    }
    logger.warn({ err: msg, label }, 'Firestore mirror write failed');
  }
}

// ── Mirror helpers ──────────────────────────────────────────

export async function mirrorConversation(conv: Record<string, unknown>): Promise<void> {
  await safe(
    () => db!.collection('conversations').doc(String(conv.id)).set({ ...conv, mirroredAt: TS() }, { merge: true }),
    'conversation'
  );
}

export async function mirrorMessage(conversationId: number, msg: Record<string, unknown>): Promise<void> {
  await safe(
    () =>
      db!
        .collection('conversations')
        .doc(String(conversationId))
        .collection('messages')
        .doc(String(msg.id))
        .set({ ...msg, mirroredAt: TS() }, { merge: true }),
    'message'
  );
}

export async function mirrorLead(lead: Record<string, unknown>): Promise<void> {
  await safe(
    () => db!.collection('leads').doc(String(lead.id)).set({ ...lead, mirroredAt: TS() }, { merge: true }),
    'lead'
  );
}

export async function mirrorPipelineStep(correlationId: string, step: Record<string, unknown>): Promise<void> {
  await safe(
    () =>
      db!
        .collection('pipelines')
        .doc(correlationId)
        .set({ correlationId, updatedAt: TS() }, { merge: true })
        .then(() =>
          db!
            .collection('pipelines')
            .doc(correlationId)
            .collection('steps')
            .doc(String(step.key))
            .set({ ...step, mirroredAt: TS() }, { merge: true })
        ),
    'pipelineStep'
  );
}

export async function mirrorPipelineMeta(correlationId: string, meta: Record<string, unknown>): Promise<void> {
  await safe(
    () => db!.collection('pipelines').doc(correlationId).set({ ...meta, updatedAt: TS() }, { merge: true }),
    'pipelineMeta'
  );
}

export async function mirrorMetrics(metrics: Record<string, unknown>): Promise<void> {
  await safe(() => db!.collection('dashboard').doc('metrics').set({ ...metrics, updatedAt: TS() }), 'metrics');
}

export async function mirrorStatus(status: Record<string, unknown>): Promise<void> {
  await safe(() => db!.collection('dashboard').doc('status').set({ ...status, updatedAt: TS() }), 'status');
}

export async function mirrorSettings(settings: Record<string, unknown>): Promise<void> {
  await safe(() => db!.collection('settings').doc('app').set({ ...settings, updatedAt: TS() }, { merge: true }), 'settings');
}
