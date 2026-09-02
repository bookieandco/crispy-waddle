import { describe, expect, it } from 'vitest'
import { adaptSamOpportunity } from './sam.js'

describe('adaptSamOpportunity', () => {
  it('maps an official SAM notice into the canonical opportunity model', () => {
    const opportunity = adaptSamOpportunity({
      noticeId: 'SAM-001',
      title: 'IT modernization services',
      solicitationNumber: 'W123',
      naicsCode: '541512',
      setAside: 'SBA 8(a)',
      responseDeadline: '2026-12-31T17:00:00Z',
      estimatedValue: 500000,
      placeOfPerformance: 'Washington, DC',
      sourceUrl: 'https://sam.gov/opp/SAM-001/view',
      fetchedAt: '2026-09-02T00:00:00.000Z',
    })

    expect(opportunity.id).toBe('sam:SAM-001')
    expect(opportunity.sourceId).toBe('us.sam.gov')
    expect(opportunity.type).toBe('contract')
    expect(opportunity.amount?.max).toBe(500000)
    expect(opportunity.claims.length).toBeGreaterThan(0)
    expect(opportunity.evidence[0]?.sourceUrl).toContain('sam.gov')
    expect(opportunity.verificationStatus).toBe('unverified')
  })
})
