import type { EconomicAttribution } from './economic-attribution-bridge.js'

export type OpportunityPerformance = {
  opportunityId: string
  conversionCount: number
  grossRevenue: number
  attributableCosts: number
  contributionProfit: number
  hours: number
  profitPerHour?: number
  currency: string
}

export function aggregateOpportunityPerformance(results: EconomicAttribution[]): OpportunityPerformance[] {
  const byOpportunity = new Map<string, OpportunityPerformance>()
  for (const result of results) {
    const current = byOpportunity.get(result.opportunityId) ?? {
      opportunityId: result.opportunityId,
      conversionCount: 0,
      grossRevenue: 0,
      attributableCosts: 0,
      contributionProfit: 0,
      hours: 0,
      currency: result.currency,
    }
    current.conversionCount += 1
    current.grossRevenue += result.grossRevenue
    current.attributableCosts += result.attributableCosts
    current.contributionProfit += result.contributionProfit
    current.hours += result.hours ?? 0
    current.profitPerHour = current.hours > 0 ? current.contributionProfit / current.hours : undefined
    byOpportunity.set(result.opportunityId, current)
  }
  return [...byOpportunity.values()]
}
