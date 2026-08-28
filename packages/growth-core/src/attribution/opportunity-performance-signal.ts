import type { OpportunityPerformance } from './opportunity-performance.js'

export type OpportunityPerformanceSignal = {
  opportunityId: string
  realizedRevenue: number
  realizedProfit: number
  realizedProfitPerHour?: number
  conversionCount: number
  confidence: 'none' | 'early' | 'moderate' | 'strong'
}

export function toOpportunityPerformanceSignal(performance: OpportunityPerformance): OpportunityPerformanceSignal {
  const confidence = performance.conversionCount === 0
    ? 'none'
    : performance.conversionCount === 1
      ? 'early'
      : performance.conversionCount < 5
        ? 'moderate'
        : 'strong'

  return {
    opportunityId: performance.opportunityId,
    realizedRevenue: performance.grossRevenue,
    realizedProfit: performance.contributionProfit,
    realizedProfitPerHour: performance.profitPerHour,
    conversionCount: performance.conversionCount,
    confidence,
  }
}
