import { createSharkExperienceProvenance } from './experience-provenance'

describe('SHARK 1.41 experience provenance', () => {
  it('accepts a complete observed evidence chain', () => {
    const result = createSharkExperienceProvenance({ experienceId: 'e1', source: 'OBSERVED', occurredAt: '2026-08-30T12:00:00Z', evidenceIds: ['ev1', 'ev2'], observationCount: 3, causalHypotheses: ['liquidity change contributed to outcome'], attributionConfidence: 0.7 })
    expect(result.source).toBe('OBSERVED')
    expect(result.evidenceIds).toEqual(['ev1', 'ev2'])
  })

  it('rejects incomplete evidence identifiers', () => {
    expect(() => createSharkExperienceProvenance({ experienceId: 'e2', source: 'IMPORTED', occurredAt: '2026-08-30T12:00:00Z', evidenceIds: [''], observationCount: 1, causalHypotheses: ['hypothesis'], attributionConfidence: 0.5 })).toThrow()
  })

  it('rejects invalid attribution confidence', () => {
    expect(() => createSharkExperienceProvenance({ experienceId: 'e3', source: 'SIMULATED', occurredAt: '2026-08-30T12:00:00Z', evidenceIds: ['ev'], observationCount: 1, causalHypotheses: ['hypothesis'], attributionConfidence: 1.2 })).toThrow()
  })

  it('requires explicit causal hypotheses rather than asserting causality', () => {
    const result = createSharkExperienceProvenance({ experienceId: 'e4', source: 'OBSERVED', occurredAt: '2026-08-30T12:00:00Z', evidenceIds: ['ev'], observationCount: 1, causalHypotheses: ['strategy may have contributed'], attributionConfidence: 0.4 })
    expect(result.causalHypotheses).toHaveLength(1)
    expect(result.attributionConfidence).toBe(0.4)
  })
})
