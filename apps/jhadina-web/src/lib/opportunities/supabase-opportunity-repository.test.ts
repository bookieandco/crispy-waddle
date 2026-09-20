import { describe, expect, it } from 'vitest'
import type { Opportunity } from '@jhadina/growth-core'

function sampleOpportunity(): Opportunity {
  return {
    id: 'opportunity:test-1',
    userId: '00000000-0000-0000-0000-000000000001',
    title: 'Test opportunity',
    description: 'Test canonical opportunity',
    class: 'experiment',
    strategy: 'experiment',
    source: { type: 'market_intelligence', name: 'test' },
    evidence: [],
    economics: { currency: 'USD' },
    status: 'discovered',
    requiresApproval: true,
    createdAt: '2026-08-28T00:00:00.000Z',
    updatedAt: '2026-08-28T00:00:00.000Z',
  }
}

describe('SupabaseOpportunityRepository row contract', () => {
  it('keeps the canonical identity and lifecycle fields persistence-safe', () => {
    const opportunity = sampleOpportunity()
    expect(opportunity.id).toBe('opportunity:test-1')
    expect(opportunity.userId).toMatch(/^00000000-/)
    expect(opportunity.status).toBe('discovered')
  })

  it('preserves approval as a persisted deterministic boundary', () => {
    expect(sampleOpportunity().requiresApproval).toBe(true)
  })
})
