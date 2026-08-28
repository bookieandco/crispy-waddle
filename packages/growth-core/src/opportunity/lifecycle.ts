import type { Opportunity, OpportunityStatus } from './types.js';

const transitions: Record<OpportunityStatus, readonly OpportunityStatus[]> = {
  discovered: ['validated', 'rejected', 'archived'],
  validated: ['test_ready', 'approved', 'rejected', 'archived'],
  test_ready: ['approved', 'rejected', 'archived'],
  approved: ['in_progress', 'archived'],
  in_progress: ['completed', 'archived'],
  completed: ['archived'],
  rejected: ['archived'],
  archived: [],
};

export function canTransitionOpportunity(from: OpportunityStatus, to: OpportunityStatus): boolean {
  return transitions[from].includes(to);
}

export function transitionOpportunity(
  opportunity: Opportunity,
  to: OpportunityStatus,
  now = new Date().toISOString(),
): Opportunity {
  if (!canTransitionOpportunity(opportunity.status, to)) {
    throw new Error(`Invalid opportunity transition: ${opportunity.status} -> ${to}`);
  }
  return { ...opportunity, status: to, updatedAt: now };
}
