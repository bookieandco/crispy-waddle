import { describe, expect, it } from 'vitest'
import { aggregateOpportunityPerformance } from './opportunity-performance.js'

describe('opportunity performance', () => {
  it('aggregates revenue, costs, profit and hours by opportunity', () => {
    const results = aggregateOpportunityPerformance([
      { eventId: '1', opportunityId: 'opp-1', variantId: 'a', measurementId: 'm1', grossRevenue: 100, attributableCosts: 20, contributionProfit: 80, currency: 'USD', hours: 2 },
      { eventId: '2', opportunityId: 'opp-1', variantId: 'b', measurementId: 'm2', grossRevenue: 50, attributableCosts: 10, contributionProfit: 40, currency: 'USD', hours: 1 },
      { eventId: '3', opportunityId: 'opp-2', variantId: 'c', measurementId: 'm3', grossRevenue: 20, attributableCosts: 5, contributionProfit: 15, currency: 'USD' },
    ])
    expect(results).toEqual([
      { opportunityId: 'opp-1', conversionCount: 2, grossRevenue: 150, attributableCosts: 30, contributionProfit: 120, hours: 3, profitPerHour: 40, currency: 'USD' },
      { opportunityId: 'opp-2', conversionCount: 1, grossRevenue: 20, attributableCosts: 5, contributionProfit: 15, hours: 0, profitPerHour: undefined, currency: 'USD' },
    ])
  })
})
