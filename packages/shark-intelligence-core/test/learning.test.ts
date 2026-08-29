import { describe, expect, it } from 'vitest'
import {
  buildSharkLearningSnapshot,
  learningAdjustment,
  recordSharkOutcome,
} from '../src/index.js'
import type { SharkOpportunityDecision } from '../src/index.js'

const decision = (overrides: Partial<SharkOpportunityDecision> = {}): SharkOpportunityDecision => ({
  id: 'decision-1',
  opportunityId: 'token-1',
  kind: 'token',
  decision: 'candidate',
  confidence: 0.8,
  risks: ['market_structure'],
  evidence: [],
  streetSignals: [
    {
      name: 'insider_accumulation',
      direction: 'positive',
      strength: 0.8,
      rationale: 'test',
      evidenceIds: [],
    },
  ],
  sourceQuality: 0.9,
  novelty: 0.8,
  repeatability: 0.7,
  policy: {
    policyPassed: true,
    authorizationRequired: true,
    authorized: false,
    executionPermitted: false,
  },
  decidedAt: new Date(0).toISOString(),
  ...overrides,
})

describe('@jhadina/shark-intelligence-core learning', () => {
  it('records only an outcome matching the decision identity', () => {
    const d = decision()
    const outcome = recordSharkOutcome(d, {
      decisionId: d.id,
      opportunityId: d.opportunityId,
      observedAt: new Date(1).toISOString(),
      outcome: 'win',
      realizedReturnPct: 42,
    })
    expect(outcome.realizedReturnPct).toBe(42)
  })

  it('builds smoothed statistics instead of treating one win as certainty', () => {
    const d = decision()
    const records = [
      { decision: d, outcome: { decisionId: d.id, opportunityId: d.opportunityId, observedAt: '1', outcome: 'win' as const, realizedReturnPct: 50 } },
      { decision: { ...d, id: 'decision-2', opportunityId: 'token-2' }, outcome: { decisionId: 'decision-2', opportunityId: 'token-2', observedAt: '2', outcome: 'loss' as const, realizedReturnPct: -20 } },
    ]
    const snapshot = buildSharkLearningSnapshot(records, 'test-v1')
    expect(snapshot.observations).toBe(2)
    expect(snapshot.wins).toBe(1)
    expect(snapshot.losses).toBe(1)
    expect(snapshot.winRate).toBeCloseTo(0.5)
    expect(snapshot.featureStats.some((item) => item.feature === 'street:insider_accumulation')).toBe(true)
  })

  it('keeps learning adjustments bounded and informational', () => {
    const d = decision()
    const outcome = { decisionId: d.id, opportunityId: d.opportunityId, observedAt: '1', outcome: 'win' as const, realizedReturnPct: 25 }
    const snapshot = buildSharkLearningSnapshot([{ decision: d, outcome }])
    expect(learningAdjustment(snapshot, d)).toBeGreaterThanOrEqual(-0.2)
    expect(learningAdjustment(snapshot, d)).toBeLessThanOrEqual(0.2)
    expect(d.policy.executionPermitted).toBe(false)
  })
})
