import type { OpportunityLearningSignal } from '@jhadina/opportunity-core'

export type OpportunityPerformanceLearning = {
  id: string
  opportunityId: string
  performanceKey: string
  result: OpportunityLearningSignal['result']
  profit: number
  margin: number | null
  dollarsPerHour: number | null
  hours: number
  evidenceRefs: string[]
  observedAt: string
  disposition: 'positive' | 'neutral' | 'negative'
}

/**
 * Growth consumes realized Opportunity outcomes as evidence. It does not
 * rewrite financial truth; revenue/cost/profit remain exactly the values
 * carried by the evidence-backed Opportunity learning signal.
 */
export function learnFromOpportunityOutcome(
  signal: OpportunityLearningSignal,
): OpportunityPerformanceLearning {
  const disposition =
    signal.result === 'lost' || signal.profit < 0
      ? 'negative'
      : signal.profit > 0
        ? 'positive'
        : 'neutral'

  return {
    id: `growth:${signal.id}`,
    opportunityId: signal.opportunityId,
    performanceKey: signal.providerId ?? `${signal.family}:${signal.type}`,
    result: signal.result,
    profit: signal.profit,
    margin: signal.margin,
    dollarsPerHour: signal.dollarsPerHour,
    hours: signal.hours,
    evidenceRefs: [...signal.evidenceRefs],
    observedAt: signal.observedAt,
    disposition,
  }
}
