import { aggregateSharkExperiences } from './experience-aggregate'

describe('SHARK 1.40 experience aggregation', () => {
  it('weighs the complete relevant experience set', () => {
    const result = aggregateSharkExperiences([
      { experienceId: 'old', occurredAt: '2020-01-01', scenarioId: 's1', strategyId: 'x', outcomeScore: 1, confidence: 0.8, provenanceComplete: true, weight: 0.5, relevance: 0.8, recency: 0.2, outcomeQuality: 1 },
      { experienceId: 'new', occurredAt: '2026-01-01', scenarioId: 's2', strategyId: 'x', outcomeScore: -1, confidence: 0.6, provenanceComplete: true, weight: 1, relevance: 0.9, recency: 0.9, outcomeQuality: 0 },
    ])
    expect(result.experienceCount).toBe(2)
    expect(result.experienceIds).toEqual(['old', 'new'])
    expect(result.weightedOutcome).toBeCloseTo(-1 / 3)
  })

  it('excludes zero-weight or incomplete-provenance experiences', () => {
    const result = aggregateSharkExperiences([
      { experienceId: 'usable', occurredAt: '2026-01-01', scenarioId: 's1', strategyId: 'x', outcomeScore: 1, confidence: 0.9, provenanceComplete: true, weight: 1, relevance: 1, recency: 1, outcomeQuality: 1 },
      { experienceId: 'zero', occurredAt: '2026-01-01', scenarioId: 's2', strategyId: 'x', outcomeScore: -1, confidence: 1, provenanceComplete: true, weight: 0, relevance: 1, recency: 1, outcomeQuality: 0 },
      { experienceId: 'unproven', occurredAt: '2026-01-01', scenarioId: 's3', strategyId: 'x', outcomeScore: -1, confidence: 1, provenanceComplete: false, weight: 1, relevance: 1, recency: 1, outcomeQuality: 0 },
    ])
    expect(result.experienceCount).toBe(1)
    expect(result.experienceIds).toEqual(['usable'])
  })
})
