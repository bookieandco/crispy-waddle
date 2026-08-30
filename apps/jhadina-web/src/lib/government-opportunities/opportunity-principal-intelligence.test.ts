import { describe, expect, it } from 'vitest'
import { assessOpportunityPrincipal } from './opportunity-principal-intelligence'

const evidence = [{ evidenceId: 'e1', providerId: 'sam.gov', confidence: 95 }]

const base = {
  opportunityId: 'opp-1',
  principalId: 'p-1',
  corporateEntityId: 'c-1',
  opportunityStatus: 'ACTIVE' as const,
  principalDisposition: 'QUALIFIED' as const,
  relationshipType: 'OWNER_OF' as const,
  relationshipStatus: 'CURRENT' as const,
  relationshipConfidence: 95,
  evidence,
}

describe('assessOpportunityPrincipal', () => {
  it('marks a current qualified owner as directly relevant', () => {
    const result = assessOpportunityPrincipal(base, '2026-08-30T12:00:00.000Z')
    expect(result.relevance).toBe('DIRECT')
    expect(result.relevanceScore).toBeGreaterThanOrEqual(75)
  })

  it('does not create an opportunity link when principal evidence is insufficient', () => {
    const result = assessOpportunityPrincipal({
      ...base,
      principalDisposition: 'INSUFFICIENT_EVIDENCE',
    })
    expect(result.relevance).toBe('NONE')
  })

  it('downgrades a former officer to historical relevance', () => {
    const result = assessOpportunityPrincipal({
      ...base,
      relationshipType: 'OFFICER_OF',
      relationshipStatus: 'FORMER',
      relationshipConfidence: 70,
    })
    expect(['HISTORICAL', 'INDIRECT']).toContain(result.relevance)
  })

  it('retains evidence provenance IDs', () => {
    const result = assessOpportunityPrincipal({
      ...base,
      evidence: [
        evidence[0],
        { evidenceId: 'e1', providerId: 'duplicate', confidence: 20 },
        { evidenceId: 'e2', providerId: 'sec', confidence: 90 },
      ],
    })
    expect(result.supportingEvidenceIds).toEqual(['e1', 'e2'])
  })

  it('downgrades conflicted principals', () => {
    const result = assessOpportunityPrincipal({
      ...base,
      principalDisposition: 'CONFLICTED',
    })
    expect(result.relevanceScore).toBeLessThan(75)
  })
})
