import { attachSharkExperienceProvenance, provenanceCompletenessScore } from './experience-provenance-ledger'

describe('SHARK 1.41-C provenance ledger integration', () => {
  const experience = {
    experienceId: 'e1', occurredAt: '2026-08-30T12:00:00Z', scenarioId: 's1', strategyId: 'strat-1', outcomeScore: 1,
    confidence: 0.8, provenanceComplete: true, weight: 0.7, relevance: 0.9, recency: 0.8, outcomeQuality: 1,
  }

  it('carries evidence and causal attribution with the weighted experience', () => {
    const result = attachSharkExperienceProvenance(experience, {
      experienceId: 'e1', source: 'OBSERVED', occurredAt: experience.occurredAt,
      evidenceIds: ['ev1', 'ev2'], observationCount: 3,
      causalHypotheses: ['liquidity conditions contributed'], attributionConfidence: 0.6,
    })
    expect(result.experienceId).toBe('e1')
    expect(result.weight).toBe(0.7)
    expect(result.provenance.evidenceIds).toEqual(['ev1', 'ev2'])
    expect(result.provenance.causalHypotheses).toHaveLength(1)
    expect(provenanceCompletenessScore(result)).toBe(1)
  })

  it('rejects provenance attached to a different experience', () => {
    expect(() => attachSharkExperienceProvenance(experience, {
      experienceId: 'wrong', source: 'OBSERVED', occurredAt: experience.occurredAt,
      evidenceIds: ['ev1'], observationCount: 1, causalHypotheses: ['hypothesis'], attributionConfidence: 0.5,
    })).toThrow()
  })
})
