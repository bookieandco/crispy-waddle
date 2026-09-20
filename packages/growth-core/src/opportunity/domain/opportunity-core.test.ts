import { describe, expect, it } from 'vitest'
import { actualDollarsPerHour, calculateOutcomeMetrics } from './opportunity-outcome.js'
import { calculateOpportunityScore } from './opportunity-score.js'
import { canTransitionOpportunityStatus, transitionOpportunityStatus } from './opportunity-status.js'

describe('Opportunity Core', () => {
  it('calculates a bounded deterministic score', () => {
    const score = calculateOpportunityScore({
      demand: 90,
      buyerValue: 80,
      distributionPotential: 70,
      aiLeverage: 90,
      recurringRevenue: 60,
      competition: 30,
      startupCost: 10,
      operationalComplexity: 20,
      regulatoryRisk: 10,
      evidenceConfidence: 80,
      personalFit: 90,
    })

    expect(score.total).toBeGreaterThanOrEqual(0)
    expect(score.total).toBeLessThanOrEqual(100)
  })

  it('allows only explicit lifecycle transitions', () => {
    expect(canTransitionOpportunityStatus('discovered', 'validating')).toBe(true)
    expect(canTransitionOpportunityStatus('discovered', 'completed')).toBe(false)
    expect(transitionOpportunityStatus('test_ready', 'approved')).toBe('approved')
    expect(() => transitionOpportunityStatus('completed', 'approved')).toThrow()
  })

  it('records profit and actual dollars per hour', () => {
    const outcome = calculateOutcomeMetrics({
      status: 'won',
      revenue: 1000,
      costs: 250,
      hours: 5,
      currency: 'USD',
    })

    expect(outcome.profit).toBe(750)
    expect(actualDollarsPerHour(outcome)).toBe(150)
  })
})
