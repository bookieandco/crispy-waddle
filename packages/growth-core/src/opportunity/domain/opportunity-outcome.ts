export type OpportunityOutcomeStatus = 'pending' | 'won' | 'lost' | 'cancelled'

export type OpportunityOutcome = {
  status: OpportunityOutcomeStatus
  revenue: number
  costs: number
  profit: number
  hours: number
  currency: string
  observedAt?: string
  notes?: string
}

export function calculateOutcomeMetrics(
  outcome: Omit<OpportunityOutcome, 'profit'>,
): OpportunityOutcome {
  const profit = outcome.revenue - outcome.costs
  return { ...outcome, profit }
}

export function actualDollarsPerHour(outcome: OpportunityOutcome): number | null {
  if (outcome.hours <= 0) return null
  return outcome.profit / outcome.hours
}
