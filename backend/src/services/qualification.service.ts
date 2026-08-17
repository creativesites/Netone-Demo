/**
 * Qualification, scoring, credit-risk & routing — DETERMINISTIC business rules.
 * The AI describes the lead (intent, product, financing, purchase intent) and
 * the conversational agent collects a structured profile in the customer's own
 * words; this module decides the qualification tier, a 0-100 score with a
 * visible breakdown, a credit-worthiness read, assignment and next action.
 * Business logic is never delegated to the LLM, and the weights/thresholds/
 * employment-risk table below are configurable per NetOne's actual
 * qualification and financing-partner criteria (see settings.repo.ts /
 * /api/settings/qualification-rules).
 */
import type { CollectedProfile, LeadAnalysis, Qualification, QualificationStage, ScoreCriterionResult } from '../types.js';
import { DEFAULT_QUALIFICATION_FIELDS, EMPLOYMENT_TYPE_TO_CATEGORY, type QualificationField } from './fields.service.js';

export interface QualificationCriterionRule {
  key: 'purchaseIntent' | 'product' | 'financing' | 'location' | 'contact' | 'employment' | 'monthlyIncome' | 'budget';
  label: string;
  weight: number;
  required: boolean;
}

// Zambia's market has high informal employment; NetOne's financing partners
// underwrite primarily on employment type since it predicts repayment
// reliability (e.g. a civil servant's installment can be deducted at
// source). Weights are 0-100 "how creditworthy is this category" multipliers,
// configurable to match the partners' actual underwriting policy.
export type EmploymentCategory =
  | 'civil_servant'
  | 'formally_employed'
  | 'self_employed'
  | 'informally_employed'
  | 'student'
  | 'unemployed';

export const EMPLOYMENT_CATEGORIES: { value: EmploymentCategory; label: string }[] = [
  { value: 'civil_servant', label: 'Civil servant' },
  { value: 'formally_employed', label: 'Formally employed' },
  { value: 'self_employed', label: 'Self-employed / business owner' },
  { value: 'informally_employed', label: 'Informally employed' },
  { value: 'student', label: 'Student' },
  { value: 'unemployed', label: 'Unemployed / no income' },
];

export const DEFAULT_EMPLOYMENT_WEIGHTS: Record<EmploymentCategory, number> = {
  civil_servant: 100,
  formally_employed: 90,
  self_employed: 55,
  informally_employed: 25,
  student: 15,
  unemployed: 0,
};

// Keyword heuristics, checked in order — deliberately deterministic (not an
// LLM call) so the credit-risk classification is auditable and never
// silently drifts. Free text we recognize as economic activity but can't map
// cleanly (e.g. "I sell vegetables at the market") defaults to informal.
const EMPLOYMENT_KEYWORDS: [EmploymentCategory, string[]][] = [
  [
    'civil_servant',
    ['civil servant', 'civil service', 'government', 'ministry', 'teacher', 'nurse', 'police', 'army', 'parastatal', 'council worker'],
  ],
  ['unemployed', ['unemployed', 'no job', 'not working', 'jobless', 'no income', 'between jobs', 'currently not employed']],
  ['student', ['student', 'studying', 'in school', 'in college', 'at university']],
  [
    'self_employed',
    ['self employed', 'self-employed', 'own business', 'business owner', 'entrepreneur', 'my own shop', 'trading', 'vendor', 'freelance', 'sell '],
  ],
  ['formally_employed', ['employed', 'company', 'work at', 'i work for', 'employee', 'salaried', 'job at', 'corporate', 'firm']],
];

// A customer is allowed to decline this question. Recognizing that
// explicitly (rather than falling through to the generic "informally
// employed" guess) matters because that guess carries real weight in the
// credit-risk read — silently mis-categorizing a declined answer would be
// both inaccurate and unfair to the customer.
// Deliberately compound phrases, not bare words — a bare "private" would
// false-positive on completely normal answers like "I work at a private
// firm" or "private school teacher", silently discarding a real answer.
const DECLINE_PATTERNS = [
  'rather not',
  'prefer not',
  'prefers not',
  "don't want to",
  'not comfortable',
  'none of your business',
  "won't say",
  'no comment',
  'keep that private',
  "that's private",
  'personal question',
  'not share that',
  'not going to share',
  'skip that',
  'skip this',
];

export function isDeclinedAnswer(raw: string | null): boolean {
  if (!raw) return false;
  const t = raw.toLowerCase();
  return DECLINE_PATTERNS.some((p) => t.includes(p));
}

export function canonicalizeEmployment(raw: string | null): EmploymentCategory | 'declined' | null {
  if (!raw) return null;
  if (isDeclinedAnswer(raw)) return 'declined';
  const t = raw.toLowerCase();
  for (const [category, words] of EMPLOYMENT_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return category;
  }
  return 'informally_employed';
}

/** Single source of truth for "which credit-risk employment category does
 *  this lead fall into" — prefers the structured employmentType (exact,
 *  from the Zambia-specific field registry) once the conversation collects
 *  it, falling back to the free-text keyword read otherwise. Both the
 *  score breakdown and the credit-risk badge must use this same resolution
 *  or they can silently disagree (the same class of bug fixed earlier for
 *  wantsFinancingAnswer). */
export function resolveEmploymentCategory(collected: Pick<CollectedProfile, 'employment' | 'employmentType'>): EmploymentCategory | 'declined' | null {
  if (collected.employmentType) {
    return EMPLOYMENT_TYPE_TO_CATEGORY[collected.employmentType] ?? canonicalizeEmployment(collected.employment);
  }
  return canonicalizeEmployment(collected.employment);
}

export type CreditRisk = 'low' | 'medium' | 'high' | 'ineligible' | 'unknown';

export function creditRiskTier(collected: Pick<CollectedProfile, 'employment' | 'employmentType'>, weights: Record<EmploymentCategory, number>): CreditRisk {
  const category = resolveEmploymentCategory(collected);
  if (!category || category === 'declined') return 'unknown';
  const w = weights[category] ?? 0;
  if (w <= 0) return 'ineligible';
  if (w < 40) return 'high';
  if (w < 75) return 'medium';
  return 'low';
}

export interface QualificationRules {
  criteria: QualificationCriterionRule[];
  qualifiedThreshold: number; // score >= this → qualified
  followUpThreshold: number; // score >= this (and below qualifiedThreshold) → needs_follow_up
  employmentWeights: Record<EmploymentCategory, number>;
  // The discovery field registry — sample/demo config, see fields.service.ts.
  fields: QualificationField[];
}

export const DEFAULT_QUALIFICATION_RULES: QualificationRules = {
  criteria: [
    { key: 'purchaseIntent', label: 'Purchase intent', weight: 25, required: true },
    { key: 'product', label: 'Product identified', weight: 15, required: true },
    { key: 'financing', label: 'Financing interest captured', weight: 10, required: false },
    { key: 'location', label: 'Location captured', weight: 10, required: true },
    { key: 'contact', label: 'Contact information', weight: 5, required: true },
    { key: 'employment', label: 'Employment / credit risk', weight: 20, required: true },
    { key: 'monthlyIncome', label: 'Monthly income disclosed', weight: 10, required: false },
    { key: 'budget', label: 'Budget indicated', weight: 5, required: false },
  ],
  qualifiedThreshold: 70,
  followUpThreshold: 40,
  employmentWeights: DEFAULT_EMPLOYMENT_WEIGHTS,
  fields: DEFAULT_QUALIFICATION_FIELDS,
};

export interface QualificationResult {
  qualification: Qualification;
  stage: QualificationStage;
  assignedTo: string;
  nextAction: string;
  score: number;
  breakdown: ScoreCriterionResult[];
  creditRisk: CreditRisk;
  discoveryPercentage: number;
}

/**
 * The full lead lifecycle state machine. discoveryPercentage comes from
 * discovery.service.ts::computeDiscovery(), computed by the caller (this
 * function only maps outcomes — see lead.service.ts for the call order).
 * convertedAt is the one manual, human-set fact: a rep marking a
 * SALES_READY lead as closed. Every other transition is deterministic.
 *
 *   NEW ──────────────▶ DISCOVERING ──┬─▶ NEEDS_REVIEW   (customer declined
 *                                      │                   a required answer)
 *                                      └─▶ QUALIFICATION_PENDING (100%
 *                                          discovery, score still borderline)
 *   DISQUALIFIED  ◀── (unqualified, any point)
 *   QUALIFIED ────────▶ SALES_READY   (qualified + 100% discovery)
 *   SALES_READY ──────▶ CONVERTED     (manual only)
 */
function hasAnyDecline(collected: CollectedProfile): boolean {
  return [collected.financing, collected.employment, collected.monthlyIncome, collected.location]
    .some((v) => isDeclinedAnswer(v ?? null));
}

export function deriveStage(
  qualification: Qualification,
  discoveryPercentage: number,
  collected: CollectedProfile,
  convertedAt: string | null
): QualificationStage {
  if (convertedAt) return 'CONVERTED';

  if (qualification === 'unqualified') {
    // Nothing worth pursuing yet vs. actively ruled out — a lead that's
    // just arrived with no real signal reads as NEW, not DISQUALIFIED.
    return discoveryPercentage <= 0 ? 'NEW' : 'DISQUALIFIED';
  }

  if (qualification === 'needs_follow_up') {
    if (discoveryPercentage >= 100) return 'QUALIFICATION_PENDING';
    // A customer who declined a required question can't be moved forward
    // by more automated discovery — that needs a human, not another
    // question from Nia.
    return hasAnyDecline(collected) ? 'NEEDS_REVIEW' : 'DISCOVERING';
  }

  // qualification === 'qualified'
  return discoveryPercentage >= 100 ? 'SALES_READY' : 'QUALIFIED';
}

export function isNegativeAnswer(v: string | null): boolean {
  if (!v) return true;
  const t = v.toLowerCase();
  return t.includes('none') || t.includes('no ') || t === 'no' || t.includes('unemploy');
}

// "cash" is a perfectly normal, non-negative answer to "cash or financing?" —
// isNegativeAnswer() (which looks for words like "no"/"none") doesn't
// recognize it, so treating "not negative" as "wants financing" silently
// flips a cash customer to wantsFinancing=true. That single bad tri-state
// cascades everywhere: Nia's own missingFields() (ai.service.ts) would think
// employment/income are still needed and keep the door open to ask for them
// despite the prompt's rule never to (mirroring the same authoritative
// answer), the score never marks "employment" as satisfied for a cash sale
// so the CRM's next-action permanently reads "Request employment / credit
// risk" even after the conversation is otherwise complete, and routing
// sends a cash customer to the Financing Sales Desk instead of Sales Team.
// The customer's own confirmed answer here is authoritative — it settles
// the question outright rather than being just one more signal alongside
// the gatekeeper's per-message guess.
export function wantsFinancingAnswer(financing: string | null): boolean | null {
  if (!financing) return null; // not yet known
  if (isDeclinedAnswer(financing)) return null; // declined the question — still unknown, not "no"
  const t = financing.toLowerCase();
  const cashWords = ['cash', 'upfront', 'full amount', 'full price', 'outright', 'one off', 'one-off', 'lump sum', 'pay in full', 'own money'];
  if (cashWords.some((w) => t.includes(w))) return false;
  if (isNegativeAnswer(financing)) return false;
  return true;
}

/** Single source of truth for "does this customer want financing" — prefers
 *  the structured purchaseMethod field once the conversation collects it
 *  directly, falling back to the free-text financing read (above) so
 *  leads collected before purchaseMethod existed keep working. Used by
 *  both the discovery engine (field relevance) and qualify() (routing). */
export function resolvePurchaseMethod(collected: Pick<CollectedProfile, 'financing' | 'purchaseMethod'>): 'cash' | 'financing' | 'unsure' | null {
  if (collected.purchaseMethod === 'cash' || collected.purchaseMethod === 'financing' || collected.purchaseMethod === 'unsure') {
    return collected.purchaseMethod;
  }
  const answer = wantsFinancingAnswer(collected.financing);
  if (answer === true) return 'financing';
  if (answer === false) return 'cash';
  return null;
}

function evalCriterion(
  rule: QualificationCriterionRule,
  analysis: LeadAnalysis,
  collected: CollectedProfile,
  hasPhone: boolean,
  employmentWeights: Record<EmploymentCategory, number>,
  financingAnswer: boolean | null
): ScoreCriterionResult {
  let fraction = 0; // 0..1 of the weight earned
  // "met" normally means "earned full marks", but for employment it must mean
  // "we got an answer" — an unemployed applicant answered the question, they
  // just carry a low/zero credit-risk weight. Conflating the two would put
  // "Employment" back in the missing-fields list even after it was answered,
  // producing a confusing "please tell us your employment" next action
  // instead of the correct "financing unlikely to be approved" one.
  let met: boolean | null = null;
  switch (rule.key) {
    case 'purchaseIntent':
      fraction = analysis.purchaseIntent === 'high' ? 1 : analysis.purchaseIntent === 'medium' ? 0.5 : 0;
      break;
    case 'product':
      fraction = collected.product || analysis.product ? 1 : 0;
      break;
    case 'financing':
      fraction = analysis.financingInterest || resolvePurchaseMethod(collected) !== null ? 1 : 0;
      break;
    case 'location':
      fraction = collected.location || collected.city ? 1 : 0;
      break;
    case 'contact':
      fraction = hasPhone ? 1 : 0;
      break;
    case 'employment': {
      // Cash purchase — employment/credit-risk assessment doesn't apply and
      // Nia never asks for it (ai.service.ts::missingFields uses the same
      // wantsFinancingAnswer() check), so it must not sit in the missing-
      // fields list forever or drag the score down for a sale that was
      // never going to need financing underwriting.
      if (financingAnswer === false) {
        fraction = 1;
        met = true;
        break;
      }
      const category = resolveEmploymentCategory(collected);
      // Declined: we got an answer (met), but no usable risk signal (0 points) —
      // never silently treated as "informally employed" just because they
      // chose not to say.
      fraction = category && category !== 'declined' ? (employmentWeights[category] ?? 0) / 100 : 0;
      met = category !== null;
      break;
    }
    case 'monthlyIncome':
      fraction = collected.monthlyIncome ? 1 : 0;
      break;
    case 'budget':
      fraction = collected.budget ? 1 : 0;
      break;
  }
  const earned = Math.round(rule.weight * fraction);
  return { key: rule.key, label: rule.label, weight: rule.weight, earned, met: met ?? fraction >= 1, required: rule.required };
}

export function qualify(
  analysis: LeadAnalysis,
  collected: CollectedProfile,
  hasPhone: boolean,
  rules: QualificationRules = DEFAULT_QUALIFICATION_RULES,
  discoveryPercentage = 0,
  convertedAt: string | null = null
): QualificationResult {
  // The customer's own confirmed answer is authoritative once given — only
  // fall back to the gatekeeper's per-message read while nothing's been
  // collected yet. See wantsFinancingAnswer() for why this can't just be
  // "not a negative answer".
  const financingAnswer = wantsFinancingAnswer(collected.financing);
  const wantsFinancing = financingAnswer !== null ? financingAnswer : analysis.financingInterest;

  const breakdown = rules.criteria.map((rule) =>
    evalCriterion(rule, analysis, collected, hasPhone, rules.employmentWeights, financingAnswer)
  );
  const maxScore = rules.criteria.reduce((sum, r) => sum + r.weight, 0) || 1;
  const rawScore = breakdown.reduce((sum, b) => sum + b.earned, 0);
  const score = Math.round((rawScore / maxScore) * 100);
  const risk = creditRiskTier(collected, rules.employmentWeights);

  let qualification: Qualification;
  if (analysis.intent === 'complaint') {
    qualification = 'needs_follow_up';
  } else if (score >= rules.qualifiedThreshold) {
    qualification = 'qualified';
  } else if (score >= rules.followUpThreshold) {
    qualification = 'needs_follow_up';
  } else {
    qualification = 'unqualified';
  }

  // Simple routing rules for the demo — configurable teams could follow the same pattern.
  let assignedTo = 'Sales Team';
  if (wantsFinancing) assignedTo = 'Financing Sales Desk';
  if (analysis.intent === 'complaint' || analysis.intent === 'support') assignedTo = 'Customer Care';

  const missing = breakdown.filter((b) => b.required && !b.met);
  let nextAction: string;
  if (analysis.intent === 'complaint' || analysis.intent === 'support') {
    nextAction = 'Route to Customer Care for resolution';
  } else if (missing.length > 0) {
    nextAction = `Request ${missing[0].label.toLowerCase()} and continue qualification`;
  } else if (wantsFinancing && risk === 'ineligible') {
    nextAction = 'Discuss cash purchase or a lower-cost model — financing unlikely to be approved';
  } else if (wantsFinancing && risk === 'high') {
    nextAction = 'Verify income documents before submitting to the financing partner (higher credit risk)';
  } else if (wantsFinancing && risk === 'unknown' && isDeclinedAnswer(collected.employment)) {
    nextAction = 'Discuss financing eligibility directly — customer preferred not to share employment details';
  } else if (qualification === 'qualified') {
    nextAction = 'Call customer to close the sale';
  } else if (qualification === 'needs_follow_up') {
    nextAction = 'Contact customer to qualify further';
  } else {
    nextAction = 'Monitor / no immediate action';
  }

  const stage = deriveStage(qualification, discoveryPercentage, collected, convertedAt);

  return { qualification, stage, assignedTo, nextAction, score, breakdown, creditRisk: risk, discoveryPercentage };
}
