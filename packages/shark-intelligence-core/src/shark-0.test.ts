import { describe, expect, it } from 'vitest'
import { buildAttributedLearningSnapshot } from './learning-attribution.js'
import { recordSharkOutcome } from './learning.js'
import { simulateSharkTrade } from './simulation.js'
import { learnFromSimulationTrade } from './simulation-learning.js'
import { SharkStrategyRegistry } from './strategy-registry.js'
import type { SharkOpportunityDecision } from './index.js'

const decision: SharkOpportunityDecision = {
  id: 'shark:opp-1',
  opportunityId: 'opp-1',
  kind: 'token',
  decision: 'candidate',
  confidence: 0.8,
  risks: [],
  evidence: [],
  streetSignals: [],
  sourceQuality: 0.9,
  novelty: 0.5,
  repeatability: 0.5,
  policy: {
    policyPassed: false,
    authorizationRequired: true,
    authorized: false,
    executionPermitted: false,
  },
  decidedAt: '2026-01-01T00:00:00.000Z',
}

describe('SHARK-0 paper learning loop', () => {
  it('simulates a trade and converts it into learning evidence', () => {
    const trade = simulateSharkTrade(
      decision,
      [
        { observedAt: '2026-01-01T00:00:00.000Z', price: 100 },
        { observedAt: '2026-01-01T01:00:00.000Z', price: 110 },
      ],
      { initialCapital: 1000, positionFraction: 0.5 },
    )
    expect(trade.outcome).toBe('win')

    const registry = new SharkStrategyRegistry()
    registry.registerStrategy({
      strategyId: 'momentum-v1',
      version: '1.0.0',
      description: 'paper momentum',
      featureNames: ['velocity'],
      createdAt: '2026-01-01T00:00:00.000Z',
    })
    const record = registry.recordDecision('momentum-v1', decision, { velocity: 0.8 }, ['price expansion'])
    const learned = learnFromSimulationTrade(record, trade)

    expect(learned.record.strategyId).toBe('momentum-v1')
    expect(learned.record.strategyVersion).toBe('1.0.0')
    expect(learned.record.featureSet.velocity).toBe(0.8)
    expect(learned.snapshot.observations).toBe(1)
    expect(learned.snapshot.wins).toBe(1)
  })

  it('rejects outcome attribution to the wrong decision', () => {
    expect(() => recordSharkOutcome(decision, {
      decisionId: 'wrong',
      opportunityId: 'opp-1',
      observedAt: '2026-01-01T00:00:00.000Z',
      outcome: 'loss',
      realizedReturnPct: -5,
    })).toThrow('outcome.decisionId must match decision.id')
  })

  it('rebuilds historical statistics from their own decisions', () => {
    const first = recordSharkOutcome(decision, {
      decisionId: decision.id,
      opportunityId: decision.opportunityId,
      observedAt: '2026-01-01T00:00:00.000Z',
      outcome: 'loss',
      realizedReturnPct: -10,
    })
    const snapshot = buildAttributedLearningSnapshot([{ decision, outcome: first, strategyId: 's', strategyVersion: '1', featureSet: {}, reasoning: [] }])
    expect(snapshot.observations).toBe(1)
    expect(snapshot.losses).toBe(1)
    expect(snapshot.meanReturnPct).toBe(-10)
  })
})
