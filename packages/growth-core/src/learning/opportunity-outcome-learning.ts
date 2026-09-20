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


export type OpportunityPerformanceAggregate = {
  performanceKey: string
  currency: string
  samples: number
  wins: number
  losses: number
  winRate: number
  grossRevenue: number
  refunds: number
  totalCosts: number
  profit: number
  margin: number | null
  hours: number
  dollarsPerHour: number | null
  repeatEvidence: 'insufficient' | 'positive' | 'mixed' | 'negative'
  evidenceRefs: string[]
  lastObservedAt: string
}

export function aggregateOpportunityPerformance(
  signals: readonly OpportunityLearningSignal[],
): OpportunityPerformanceAggregate[] {
  const groups = new Map<string, OpportunityLearningSignal[]>()

  for (const signal of signals) {
    const performanceKey = signal.providerId ?? `${signal.family}:${signal.type}`
    const key = `${performanceKey}:${signal.currency}`
    const group = groups.get(key) ?? []
    group.push(signal)
    groups.set(key, group)
  }

  return [...groups.entries()]
    .map(([key, group]) => {
      const sample = group[0]
      if (!sample) throw new Error(`Empty opportunity performance group: ${key}`)
      const performanceKey = sample.providerId ?? `${sample.family}:${sample.type}`
      const wins = group.filter((signal) => signal.result === 'won').length
      const losses = group.length - wins
      const grossRevenue = sum(group.map((signal) => signal.grossRevenue))
      const netRevenue = sum(group.map((signal) => signal.netRevenue))
      const refunds = grossRevenue - netRevenue
      const totalCosts = sum(group.map((signal) => signal.totalCosts))
      const profit = sum(group.map((signal) => signal.profit))
      const hours = sum(group.map((signal) => signal.hours))
      const margin = netRevenue > 0 ? profit / netRevenue : null
      const dollarsPerHour = hours > 0 ? profit / hours : null
      const winRate = group.length > 0 ? wins / group.length : 0
      const evidenceRefs = [...new Set(group.flatMap((signal) => signal.evidenceRefs))]
      const observed = group.map((signal) => signal.observedAt).sort()
      const lastObservedAt = observed.length > 0 ? observed[observed.length - 1] : sample.observedAt
      const repeatEvidence: OpportunityPerformanceAggregate['repeatEvidence'] =
        group.length < 3 ? 'insufficient' :
        profit < 0 || winRate < 0.25 ? 'negative' :
        profit > 0 && winRate >= 0.5 ? 'positive' :
        'mixed'

      return {
        performanceKey,
        currency: sample.currency,
        samples: group.length,
        wins,
        losses,
        winRate,
        grossRevenue,
        refunds,
        totalCosts,
        profit,
        margin,
        hours,
        dollarsPerHour,
        repeatEvidence,
        evidenceRefs,
        lastObservedAt,
      }
    })
    .sort((a, b) => b.samples - a.samples || b.profit - a.profit)
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0)
}
