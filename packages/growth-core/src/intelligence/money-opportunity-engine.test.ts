import { describe, expect, it } from 'vitest'
import { rankMoneyOpportunities } from './money-opportunity-engine.js'

describe('rankMoneyOpportunities', () => {
  it('prioritizes expected profit and efficiency', () => {
    const ranked = rankMoneyOpportunities([
      {
        id: 'affiliate-1', channel: 'affiliate', title: 'Affiliate offer', source: 'test', sourceUrl: 'https://example.com/1',
        estimatedRevenue: 500, estimatedCost: 50, estimatedHours: 5, fitScore: 80, probability: 0.8, riskScore: 10,
        capitalRequired: 0, evidence: ['validated demand'], requiredCapabilities: [], approvalRequired: false,
      },
      {
        id: 'service-1', channel: 'service', title: 'B2B service', source: 'test', sourceUrl: 'https://example.com/2',
        estimatedRevenue: 10000, estimatedCost: 2000, estimatedHours: 20, fitScore: 90, probability: 0.5, riskScore: 15,
        capitalRequired: 0, evidence: ['buyer identified'], requiredCapabilities: [], approvalRequired: false,
      },
    ])

    expect(ranked[0].id).toBe('service-1')
    expect(ranked[0].expectedProfit).toBe(4000)
    expect(ranked[0].rank).toBe(1)
  })

  it('blocks opportunities explicitly missing approval', () => {
    const ranked = rankMoneyOpportunities([{
      id: 'gov-1', channel: 'government', title: 'Contract', source: 'sam_gov', sourceUrl: 'https://sam.gov',
      estimatedRevenue: 100000, estimatedCost: 20000, estimatedHours: 100, fitScore: 95, probability: 0.6, riskScore: 20,
      capitalRequired: 1000, evidence: ['public notice'], requiredCapabilities: ['approval_missing'], approvalRequired: true,
    }])

    expect(ranked[0].blocked).toBe(true)
    expect(ranked[0].score).toBe(0)
  })
})
