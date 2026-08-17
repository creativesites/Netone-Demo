/**
 * Discovery engine — sits between the conversation and qualification.
 * Answers exactly one question: "what do we still need to know about this
 * customer?" Pure and deterministic; the AI never decides what's missing,
 * it only supplies the collected values this reads.
 */
import type { CollectedProfile } from '../types.js';
import type { QualificationField } from './fields.service.js';
import { resolvePurchaseMethod } from './qualification.service.js';

export interface DiscoveryResult {
  totalRequired: number;
  collectedCount: number;
  completionPercentage: number;
  collected: QualificationField[];
  missing: QualificationField[];
  nextField: QualificationField | null;
}

// Employment/income/financing-detail fields only matter once the customer
// wants financing — mirrors the AI's own "never ask about employment or
// income if they said they're paying cash" rule, so Discovery and the live
// conversation never disagree about what's actually missing.
const FINANCING_ONLY_CATEGORIES = new Set(['employment', 'income', 'financing']);

function isRelevant(field: QualificationField, collected: CollectedProfile): boolean {
  if (!FINANCING_ONLY_CATEGORIES.has(field.category)) return true;
  return resolvePurchaseMethod(collected) === 'financing';
}

function hasValue(collected: CollectedProfile, key: keyof CollectedProfile): boolean {
  const v = collected[key];
  return v != null && String(v).trim() !== '';
}

export function computeDiscovery(fields: QualificationField[], collected: CollectedProfile): DiscoveryResult {
  const relevant = fields.filter((f) => isRelevant(f, collected));
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
