/**
 * Qualification, scoring & routing — DETERMINISTIC business rules.
 * The AI describes the lead (intent, product, financing, purchase intent) and
 * the conversational agent collects a structured profile; this module decides
 * the qualification tier, a 0-100 score with a visible breakdown, assignment
 * and next action. Business logic is never delegated to the LLM, and the
 * weights/thresholds/required-fields below are configurable per NetOne's
 * actual qualification criteria (see settings.repo.ts / /api/settings/qualification-rules).
 */
import type { CollectedProfile, LeadAnalysis, Qualification, ScoreCriterionResult } from '../types.js';

export interface QualificationCriterionRule {
  key: 'purchaseIntent' | 'product' | 'financing' | 'location' | 'contact' | 'employment' | 'budget';
  label: string;
  weight: number;
  required: boolean;
}

export interface QualificationRules {
  criteria: QualificationCriterionRule[];
  qualifiedThreshold: number; // score >= this → qualified
  followUpThreshold: number; // score >= this (and below qualifiedThreshold) → needs_follow_up
}

export const DEFAULT_QUALIFICATION_RULES: QualificationRules = {
  criteria: [
    { key: 'purchaseIntent', label: 'Purchase intent', weight: 30, required: true },
    { key: 'product', label: 'Product identified', weight: 20, required: true },
    { key: 'financing', label: 'Financing interest captured', weight: 15, required: false },
    { key: 'location', label: 'Location captured', weight: 10, required: true },
    { key: 'contact', label: 'Contact information', weight: 5, required: true },
    { key: 'employment', label: 'Employment status', weight: 10, required: true },
    { key: 'budget', label: 'Budget / income indicated', weight: 10, required: false },
  ],
  qualifiedThreshold: 70,
  followUpThreshold: 40,
};

export interface QualificationResult {
  qualification: Qualification;
  assignedTo: string;
  nextAction: string;
  score: number;
  breakdown: ScoreCriterionResult[];
}

function negative(v: string | null): boolean {
  if (!v) return true;
  const t = v.toLowerCase();
  return t.includes('none') || t.includes('no ') || t === 'no' || t.includes('unemploy');
}

function evalCriterion(
  rule: QualificationCriterionRule,
  analysis: LeadAnalysis,
  collected: CollectedProfile,
  hasPhone: boolean
): ScoreCriterionResult {
  let fraction = 0; // 0..1 of the weight earned
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
    case 'employment':
      fraction = collected.employment ? 1 : 0;
      break;
    case 'budget':
      fraction = collected.budget ? 1 : 0;
      break;
  }
  const earned = Math.round(rule.weight * fraction);
  return { key: rule.key, label: rule.label, weight: rule.weight, earned, met: fraction >= 1, required: rule.required };
}

export function qualify(
  analysis: LeadAnalysis,
  collected: CollectedProfile,
  hasPhone: boolean,
  rules: QualificationRules = DEFAULT_QUALIFICATION_RULES
): QualificationResult {
  const breakdown = rules.criteria.map((rule) => evalCriterion(rule, analysis, collected, hasPhone));
  const maxScore = rules.criteria.reduce((sum, r) => sum + r.weight, 0) || 1;
  const rawScore = breakdown.reduce((sum, b) => sum + b.earned, 0);
  const score = Math.round((rawScore / maxScore) * 100);

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
  if (analysis.financingInterest || (collected.financing && !negative(collected.financing))) {
    assignedTo = 'Financing Sales Desk';
  }
  if (analysis.intent === 'complaint' || analysis.intent === 'support') assignedTo = 'Customer Care';

  const missing = breakdown.filter((b) => b.required && !b.met);
  let nextAction: string;
  if (analysis.intent === 'complaint' || analysis.intent === 'support') {
    nextAction = 'Route to Customer Care for resolution';
  } else if (qualification === 'qualified' && missing.length === 0) {
    nextAction = 'Call customer to close the sale';
  } else if (missing.length > 0) {
    nextAction = `Request ${missing[0].label.toLowerCase()} and continue qualification`;
  } else if (qualification === 'needs_follow_up') {
    nextAction = 'Contact customer to qualify further';
  } else {
    nextAction = 'Monitor / no immediate action';
  }

  return { qualification, assignedTo, nextAction, score, breakdown };
}
