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
import type { CollectedProfile, LeadAnalysis, Qualification, ScoreCriterionResult } from '../types.js';

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

export function canonicalizeEmployment(raw: string | null): EmploymentCategory | null {
  if (!raw) return null;
  const t = raw.toLowerCase();
  for (const [category, words] of EMPLOYMENT_KEYWORDS) {
    if (words.some((w) => t.includes(w))) return category;
  }
  return 'informally_employed';
}

export type CreditRisk = 'low' | 'medium' | 'high' | 'ineligible' | 'unknown';

export function creditRiskTier(raw: string | null, weights: Record<EmploymentCategory, number>): CreditRisk {
  const category = canonicalizeEmployment(raw);
  if (!category) return 'unknown';
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
};

export interface QualificationResult {
  qualification: Qualification;
  assignedTo: string;
  nextAction: string;
  score: number;
  breakdown: ScoreCriterionResult[];
  creditRisk: CreditRisk;
}

export function isNegativeAnswer(v: string | null): boolean {
  if (!v) return true;
  const t = v.toLowerCase();
  return t.includes('none') || t.includes('no ') || t === 'no' || t.includes('unemploy');
}
const negative = isNegativeAnswer;

function evalCriterion(
  rule: QualificationCriterionRule,
  analysis: LeadAnalysis,
  collected: CollectedProfile,
  hasPhone: boolean,
  employmentWeights: Record<EmploymentCategory, number>
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
      fraction = analysis.financingInterest || (collected.financing && !negative(collected.financing)) ? 1 : 0;
      break;
    case 'location':
      fraction = collected.location ? 1 : 0;
      break;
    case 'contact':
      fraction = hasPhone ? 1 : 0;
      break;
    case 'employment': {
      const category = canonicalizeEmployment(collected.employment);
      fraction = category ? (employmentWeights[category] ?? 0) / 100 : 0;
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
  rules: QualificationRules = DEFAULT_QUALIFICATION_RULES
): QualificationResult {
  const breakdown = rules.criteria.map((rule) => evalCriterion(rule, analysis, collected, hasPhone, rules.employmentWeights));
  const maxScore = rules.criteria.reduce((sum, r) => sum + r.weight, 0) || 1;
  const rawScore = breakdown.reduce((sum, b) => sum + b.earned, 0);
  const score = Math.round((rawScore / maxScore) * 100);
  const risk = creditRiskTier(collected.employment, rules.employmentWeights);

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

  const wantsFinancing = analysis.financingInterest || (collected.financing && !negative(collected.financing));

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
  } else if (qualification === 'qualified') {
    nextAction = 'Call customer to close the sale';
  } else if (qualification === 'needs_follow_up') {
    nextAction = 'Contact customer to qualify further';
  } else {
    nextAction = 'Monitor / no immediate action';
  }

  return { qualification, assignedTo, nextAction, score, breakdown, creditRisk: risk };
}
