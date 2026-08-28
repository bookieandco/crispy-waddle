import { describe, expect, it } from 'vitest'
import { normalizeCommercialOpportunity } from './commercial-opportunity.js'

describe('normalizeCommercialOpportunity', () => {
  it('normalizes an affiliate offer without treating claims as facts', () => {
    const opportunity = normalizeCommercialOpportunity({
      externalId: 'offer-1',
      title: 'AI workflow template bundle',
      description: 'A commercial digital offer observed in the market.',
      kind: 'affiliate',
      source: { name: 'example-market', type: 'affiliate', url: 'https://example.com/offer-1' },
      buyer: { segment: 'small businesses' },
      problem: 'Reducing repetitive administrative work',
      evidence: [{ type: 'claim', summary: 'Seller reports strong demand', confidence: 0.35 }],
      economics: { currency: 'USD', startupCost: 10, estimatedHours: 3, recurringRevenue: false },
    }, 'user-1', '2026-08-28T00:00:00.000Z')

    expect(opportunity.id).toBe('commercial:example-market:offer-1')
    expect(opportunity.source.type).toBe('affiliate')
    expect(opportunity.evidence[0]?.type).toBe('claim')
    expect(opportunity.status).toBe('discovered')
    expect(opportunity.requiresApproval).toBe(true)
  })
})
