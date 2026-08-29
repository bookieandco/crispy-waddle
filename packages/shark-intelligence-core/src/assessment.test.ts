import { describe, expect, it } from 'vitest'
import { assessOpportunity, validateSharkDecision } from './index.js'

type OpportunityFixture = Parameters<typeof assessOpportunity>[0]['opportunity']

function opportunity(overrides: Partial<OpportunityFixture> = {}): OpportunityFixture {
  return {
    id: 'opp-1',
    riskFlags: [],
    claims: [],
    evidence: [{ id: 'e-1', sourceId: 'source-1', sourceType: 'secondary', sourceName: 'Research', sourceUrl: 'https://example.com', capturedAt: '2026-01-01T00:00:00.000Z', excerpt: 'signal', confidence: 0.8, verified: false }],
    sourceConfidence: 0.8,
    verificationStatus: 'unverified',
    ...overrides,
  } as OpportunityFixture
}

describe('Shark assessment contract', () => {
  it('keeps assessment confidence independent from opportunity score', () => {
    const result = assessOpportunity({ opportunity: opportunity({ sourceConfidence: 0.42, opportunityScore: 99 }) })
    expect(result.confidence).toBe(0.42)
    expect(result.sourceQuality).toBe(0.42)
  })

  it('requires human review for evidence-backed but unverified opportunities', () => {
    expect(assessOpportunity({ opportunity: opportunity() }).decision).toBe('needs_human_review')
  })

  it('avoids severe risk regardless of verification', () => {
    const result = assessOpportunity({ opportunity: opportunity({ riskFlags: ['liquidity'], verificationStatus: 'verified' }) })
    expect(result.decision).toBe('avoid')
    expect(result.downsideRisk).toBe(1)
  })

  it('never grants execution authority', () => {
    const result = assessOpportunity({ opportunity: opportunity({ verificationStatus: 'verified' }) })
    expect(result.policy).toEqual({ policyPassed: false, authorizationRequired: true, authorized: false, executionPermitted: false })
    expect(validateSharkDecision(result)).toEqual([])
  })
})
