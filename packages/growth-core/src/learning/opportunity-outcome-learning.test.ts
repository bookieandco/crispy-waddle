import { describe, expect, it } from 'vitest'
import { aggregateOpportunityPerformance, learnFromOpportunityOutcome } from './opportunity-outcome-learning'

describe('learnFromOpportunityOutcome', () => {
  it('preserves realized truth and provider attribution', () => {
    const learning = learnFromOpportunityOutcome({
      id: 'learning:outcome:1',
      opportunityId: 'commercial:provider:growth-affiliate:offer-1',
      family: 'business',
      type: 'commercial',
      providerId: 'provider:growth-affiliate',
      result: 'won',
      currency: 'USD',
      grossRevenue: 1000,
      netRevenue: 900,
      totalCosts: 350,
      profit: 550,
      margin: 550 / 900,
      hours: 10,
      dollarsPerHour: 55,
      sourceOwner: 'money_core',
      evidenceRefs: ['ledger:1'],
      transactionRefs: ['txn:1'],
      observedAt: '2026-09-19T12:00:00Z',
    })

    expect(learning.performanceKey).toBe('provider:growth-affiliate')
    expect(learning.profit).toBe(550)
    expect(learning.dollarsPerHour).toBe(55)
    expect(learning.disposition).toBe('positive')
  })

  it('aggregates repeat evidence without rewriting financial truth', () => {
    const base = {
      opportunityId: 'commercial:offer',
      family: 'business' as const,
      type: 'commercial' as const,
      providerId: 'provider:growth-affiliate',
      result: 'won' as const,
      currency: 'USD',
      grossRevenue: 100,
      netRevenue: 90,
      totalCosts: 40,
      profit: 50,
      margin: 50 / 90,
      hours: 2,
      dollarsPerHour: 25,
      sourceOwner: 'money_core' as const,
      evidenceRefs: ['ledger:1'],
      transactionRefs: ['txn:1'],
    }

    const aggregates = aggregateOpportunityPerformance([
      { ...base, id: 'learning:1', observedAt: '2026-09-17T00:00:00Z' },
      { ...base, id: 'learning:2', observedAt: '2026-09-18T00:00:00Z' },
      { ...base, id: 'learning:3', observedAt: '2026-09-19T00:00:00Z' },
    ])

    expect(aggregates).toHaveLength(1)
    expect(aggregates[0].samples).toBe(3)
    expect(aggregates[0].winRate).toBe(1)
    expect(aggregates[0].profit).toBe(150)
    expect(aggregates[0].refunds).toBe(30)
    expect(aggregates[0].dollarsPerHour).toBe(25)
    expect(aggregates[0].repeatEvidence).toBe('positive')
  })

})
