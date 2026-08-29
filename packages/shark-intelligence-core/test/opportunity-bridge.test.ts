import { describe, expect, it } from 'vitest'
import { assessOpportunity } from '../src/index.js'

const baseOpportunity = {
  id: 'opportunity-1',
  title: 'Test opportunity',
  family: 'business' as const,
  type: 'investment' as const,
  sourceUrl: 'https://example.test/opportunity',
  sourceName: 'test',
  claims: [],
  evidence: [
    {
      id: 'evidence-1',
      sourceId: 'source-1',
      sourceUrl: 'https://example.test/source',
      sourceName: 'test source',
      sourceType: 'official' as const,
      capturedAt: new Date(0).toISOString(),
      confidence: 0.9,
    },
  ],
  verificationStatus: 'verified' as const,
  sourceConfidence: 0.9,
  opportunityScore: 80,
  riskFlags: [],
  status: 'verified' as const,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
}

describe('Shark → Opportunity Core bridge', () => {
  it('assesses a verified opportunity without authorizing execution', () => {
    const decision = assessOpportunity({ opportunity: baseOpportunity })

    expect(decision.decision).toBe('candidate')
    expect(decision.confidence).toBe(0.8)
    expect(decision.policy.policyPassed).toBe(false)
    expect(decision.policy.authorizationRequired).toBe(true)
    expect(decision.policy.authorized).toBe(false)
    expect(decision.policy.executionPermitted).toBe(false)
  })

  it('converts severe risk flags into an avoid decision', () => {
    const decision = assessOpportunity({
      opportunity: {
        ...baseOpportunity,
        riskFlags: ['liquidity', 'sellability'],
      },
      kind: 'token',
    })

    expect(decision.decision).toBe('avoid')
    expect(decision.risks).toEqual(expect.arrayContaining(['liquidity', 'sellability']))
    expect(decision.policy.executionPermitted).toBe(false)
  })
})
