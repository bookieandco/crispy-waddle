import { describe, expect, it } from 'vitest'
import { rankPrincipalOpportunity, rankPrincipalOpportunities } from './opportunity-principal-ranking'

const base = {
  opportunityId: 'opp-1',
  principalId: 'p-1',
  relevanceScore: 95,
  relevance: 'DIRECT' as const,
  opportunityStatus: 'ACTIVE' as const,
  estimatedValue: 5_000_000,
  agencyFit: 90,
  naicsFit: 90,
  pscFit: 85,
  setAsideFit: 80,
  priorAwardFit: 85,
  competition: 80,
  daysToDeadline: 30,
  evidenceQuality: 95,
}

describe('rankPrincipalOpportunity', () => {
  it('prioritizes a directly relevant, well-supported opportunity', () => {
    const result = rankPrincipalOpportunity(base)
    expect(result.total).toBeGreaterThanOrEqual(80)
    expect(result.disposition).toBe('PURSUE')
  })

  it('never promotes an opportunity with no principal relevance', () => {
    const result = rankPrincipalOpportunity({
      ...base,
      relevance: 'NONE',
      relevanceScore: 0,
    })
    expect(result.disposition).toBe('PASS')
    expect(result.total).toBeLessThanOrEqual(20)
  })

  it('caps historical principal relationships', () => {
    const result = rankPrincipalOpportunity({
      ...base,
      relevance: 'HISTORICAL',
      relevanceScore: 80,
    })
    expect(result.total).toBeLessThanOrEqual(65)
    expect(result.disposition).not.toBe('PURSUE')
  })

  it('passes inactive opportunities regardless of score', () => {
    const result = rankPrincipalOpportunity({
      ...base,
      opportunityStatus: 'INACTIVE',
    })
    expect(result.disposition).toBe('PASS')
  })

  it('penalizes weak evidence', () => {
    const result = rankPrincipalOpportunity({
      ...base,
      evidenceQuality: 30,
    })
    expect(result.reasons).toContain('evidence quality is below preferred threshold')
    expect(result.disposition).not.toBe('PURSUE')
  })

  it('sorts multiple opportunity/principal assessments by total score', () => {
    const results = rankPrincipalOpportunities([
      base,
      { ...base, opportunityId: 'opp-2', principalId: 'p-2', relevanceScore: 60, relevance: 'CORPORATE', agencyFit: 50 },
    ])
    expect(results[0].opportunityId).toBe('opp-1')
    expect(results[1].opportunityId).toBe('opp-2')
  })
})
