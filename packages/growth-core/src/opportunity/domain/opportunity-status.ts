export type OpportunityStatus =
  | 'discovered'
  | 'validating'
  | 'test_ready'
  | 'approved'
  | 'in_progress'
  | 'completed'
  | 'rejected'
  | 'archived'

export const OPPORTUNITY_STATUSES: readonly OpportunityStatus[] = [
  'discovered',
  'validating',
  'test_ready',
  'approved',
  'in_progress',
  'completed',
  'rejected',
  'archived',
] as const

const TRANSITIONS: Readonly<Record<OpportunityStatus, readonly OpportunityStatus[]>> = {
  discovered: ['validating', 'rejected', 'archived'],
  validating: ['test_ready', 'rejected', 'archived'],
  test_ready: ['approved', 'rejected', 'archived'],
  approved: ['in_progress', 'rejected', 'archived'],
  in_progress: ['completed', 'rejected', 'archived'],
  completed: ['archived'],
  rejected: ['archived'],
  archived: [],
}

export function canTransitionOpportunityStatus(
  from: OpportunityStatus,
  to: OpportunityStatus,
): boolean {
  return TRANSITIONS[from].includes(to)
}

export function transitionOpportunityStatus(
  from: OpportunityStatus,
  to: OpportunityStatus,
): OpportunityStatus {
  if (!canTransitionOpportunityStatus(from, to)) {
    throw new Error(`Invalid opportunity transition: ${from} -> ${to}`)
  }
  return to
}
