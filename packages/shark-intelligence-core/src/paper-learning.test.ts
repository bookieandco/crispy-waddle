import { describe, expect, it } from 'vitest'
import { assessOpportunity } from './index.js'
import { paperExecutionToLearningInput } from './paper-learning.js'

function opportunity() {
  return {
    id: 'opp-paper-1', riskFlags: [], claims: [],
    evidence: [{ id: 'ev-1', sourceId: 'src-1', sourceType: 'secondary', sourceName: 'test', sourceUrl: 'https://example.com', capturedAt: '2026-01-01T00:00:00.000Z', excerpt: 'signal', confidence: 0.9, verified: true }],
    sourceConfidence: 0.9, opportunityScore: 75, verificationStatus: 'verified', expectedValue: 25,
  } as any
}

describe('paper learning provenance', () => {
  it('preserves assessment and strategy identity into the learning input', () => {
    const assessment = assessOpportunity({ opportunity: opportunity(), modelVersion: 'test-1' })
    const execution = {
      simulated: true,
      order: { decisionId: assessment.id, opportunityId: assessment.opportunityId },
      fills: [{ price: 10, quantity: 2, fee: 0.2 }],
      position: { realizedPnl: 4 },
    } as any
    const result = paperExecutionToLearningInput({ decision: assessment, execution })
    expect(result.decision.id).toBe(assessment.id)
    expect(result.trade.decisionId).toBe(assessment.id)
    expect(result.trade.opportunityId).toBe(assessment.opportunityId)
    expect(result.trade.paper).toBe(true)
    expect(result.trade.simulated).toBe(true)
    expect(result.outcome.note).toBe('paper-simulation')
  })

  it('rejects live execution from entering the paper-learning path', () => {
    const assessment = assessOpportunity({ opportunity: opportunity() })
    const execution = { simulated: false, order: { decisionId: assessment.id, opportunityId: assessment.opportunityId }, fills: [], position: { realizedPnl: 0 } } as any
    expect(() => paperExecutionToLearningInput({ decision: assessment, execution })).toThrow('paper execution must be explicitly simulated')
  })

  it('rejects mismatched decision provenance', () => {
    const assessment = assessOpportunity({ opportunity: opportunity() })
    const execution = { simulated: true, order: { decisionId: 'other-decision', opportunityId: assessment.opportunityId }, fills: [], position: { realizedPnl: 0 } } as any
    expect(() => paperExecutionToLearningInput({ decision: assessment, execution })).toThrow('decision does not match')
  })
})
