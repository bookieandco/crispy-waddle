import { describe, expect, it } from 'vitest'
import { buildCreativeGenerationRequest, validateGeneratedCreatives } from './creative-generator.js'

describe('Creative generator contract', () => {
  const brief = {
    opportunityId: 'opp-1', audience: 'buyers', pain: 'pain', benefit: 'benefit', sourceEvidenceIds: ['e1'], objective: 'drive_sales' as const, evidenceQuality: .9,
  }

  it('defaults to the 5 × 3 × 2 experiment shape', () => {
    expect(buildCreativeGenerationRequest(brief)).toMatchObject({ hookCount: 5, bodyCount: 3, ctaCount: 2 })
  })

  it('rejects providers that return the wrong number of variants', () => {
    const request = buildCreativeGenerationRequest(brief, { hookCount: 2, bodyCount: 1, ctaCount: 1 })
    expect(() => validateGeneratedCreatives({ hooks: [{ text: 'a' }], bodies: [], ctas: [{ text: 'c', action: 'click' }] }, request)).toThrow('creative_generator_invalid_body_count')
  })
})
