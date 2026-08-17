/**
 * Display-only mirror of backend/src/services/discovery.service.ts —
 * computes the same "what's still missing" read so the Discovery panel can
 * render without an extra round trip. The AI/business-rule DECISION (score,
 * qualification, stage, Bitrix sync) already happened server-side; this is
 * purely a UI progress computation, not a qualification decision.
 */
import type { CollectedProfile, QualificationField, DiscoveryResult } from './types';

const FINANCING_ONLY_CATEGORIES = new Set(['employment', 'income', 'financing']);

const CASH_WORDS = ['cash', 'upfront', 'full amount', 'full price', 'outright', 'one off', 'one-off', 'lump sum', 'pay in full', 'own money'];
const DECLINE_PATTERNS = [
  'rather not', 'prefer not', 'prefers not', "don't want to", 'not comfortable',
  'none of your business', "won't say", 'no comment', 'keep that private', "that's private",
];

function resolvePurchaseMethod(collected: Pick<CollectedProfile, 'financing' | 'purchaseMethod'>): 'cash' | 'financing' | 'unsure' | null {
  if (collected.purchaseMethod === 'cash' || collected.purchaseMethod === 'financing' || collected.purchaseMethod === 'unsure') {
    return collected.purchaseMethod;
  }
  const raw = collected.financing;
  if (!raw) return null;
  const t = raw.toLowerCase();
  if (DECLINE_PATTERNS.some((p) => t.includes(p))) return null;
  if (CASH_WORDS.some((w) => t.includes(w))) return 'cash';
  return 'financing';
}

function isRelevant(field: QualificationField, collected: CollectedProfile): boolean {
  if (!FINANCING_ONLY_CATEGORIES.has(field.category)) return true;
  return resolvePurchaseMethod(collected) === 'financing';
}

function hasValue(collected: CollectedProfile, key: keyof CollectedProfile): boolean {
  const v = collected[key];
  return v != null && String(v).trim() !== '';
}

export function relevantFields(fields: QualificationField[], collected: CollectedProfile): QualificationField[] {
  return [...fields].filter((f) => isRelevant(f, collected)).sort((a, b) => a.order - b.order);
}

export function computeDiscovery(fields: QualificationField[], collected: CollectedProfile): DiscoveryResult {
  const relevant = relevantFields(fields, collected);
  const required = relevant.filter((f) => f.required);
  const collectedFields = required.filter((f) => hasValue(collected, f.key));
  const missing = required.filter((f) => !hasValue(collected, f.key)).sort((a, b) => a.order - b.order);
  return {
    totalRequired: required.length,
    collectedCount: collectedFields.length,
    completionPercentage: required.length > 0 ? Math.round((collectedFields.length / required.length) * 100) : 100,
    collected: collectedFields.sort((a, b) => a.order - b.order),
    missing,
    nextField: missing[0] ?? null,
  };
}

export function hasFieldValue(collected: CollectedProfile, key: keyof CollectedProfile): boolean {
  return hasValue(collected, key);
}
