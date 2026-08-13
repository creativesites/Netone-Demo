/**
 * Qualification & routing — DETERMINISTIC business rules.
 * The AI describes the lead; this code decides the qualification, assignment and
 * next action. Business logic is never delegated to the LLM.
 */
import type { LeadAnalysis, Qualification } from '../types.js';

export interface QualificationResult {
  qualification: Qualification;
  assignedTo: string;
  nextAction: string;
}

export function qualify(analysis: LeadAnalysis): QualificationResult {
  const { intent, financingInterest, purchaseIntent, product } = analysis;

  let qualification: Qualification;
  if (intent === 'complaint') {
    qualification = 'needs_follow_up';
  } else if (purchaseIntent === 'high' || (product && financingInterest)) {
    qualification = 'qualified';
  } else if (product || intent === 'product_inquiry' || intent === 'financing_inquiry') {
    qualification = 'needs_follow_up';
  } else if (intent === 'support' || intent === 'general' || intent === 'unknown') {
    qualification = 'unqualified';
  } else {
    qualification = 'needs_follow_up';
  }

  // Simple routing rules for the demo.
  let assignedTo = 'Sales Team';
  if (financingInterest) assignedTo = 'Financing Sales Desk';
  if (intent === 'complaint' || intent === 'support') assignedTo = 'Customer Care';

  let nextAction = 'Review lead';
  if (qualification === 'qualified') nextAction = 'Call customer to close sale';
  else if (qualification === 'needs_follow_up') nextAction = 'Contact customer to qualify';
  else nextAction = 'Monitor / no immediate action';

  return { qualification, assignedTo, nextAction };
}
