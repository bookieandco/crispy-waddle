import { describe, expect, it } from 'vitest'
import { learnFromOpportunityOutcome } from './opportunity-outcome-learning'

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
})
