import { compareSharkExperienceAgainstHistory } from './experience-comparison'

describe('SHARK 1.40 cross-experience comparison', () => {
  const candidate = { experienceId: 'candidate', occurredAt: '2026-08-30', scenarioId: 'new', strategyId: 's1', outcomeScore: 1, confidence: 0.8, provenanceComplete: true }
  const history = [
    { experienceId: 'old-1', occurredAt: '2025-01-01', scenarioId: 'similar', strategyId: 's1', outcomeScore: 0.9, confidence: 0.8, provenanceComplete: true, weight: 1, relevance: 0.8, recency: 0.5, outcomeQuality: 0.95 },
    { experienceId: 'old-2', occurredAt: '2024-01-01', scenarioId: 'similar-2', strategyId: 's1', outcomeScore: 0.8, confidence: 0.7, provenanceComplete: true, weight: 0.8, relevance: 0.7, recency: 0.4, outcomeQuality: 0.9 },
    { experienceId: 'contrary', occurredAt: '2025-06-01', scenarioId: 'similar-3', strategyId: 's1', outcomeScore: -0.8, confidence: 0.7, provenanceComplete: true, weight: 0.2, relevance: 0.6, recency: 0.6, outcomeQuality: 0.1 },
  ]

  it('considers the complete comparable history', () => {
    const result = compareSharkExperienceAgainstHistory({ candidate, history })
    expect(result.matches.length).toBe(3)
    expect(result.reinforcingWeight).toBeGreaterThan(result.contradictingWeight)
    expect(result.status).toBe('REINFORCED')
  })

  it('reports mixed evidence instead of hiding disagreement', () => {
    const result = compareSharkExperienceAgainstHistory({ candidate, history: history.map(e => ({ ...e, weight: 1 })) })
    expect(result.status).toBe('MIXED')
  })

  it('reports when no comparable history exists', () => {
    const result = compareSharkExperienceAgainstHistory({ candidate, history: history.map(e => ({ ...e, strategyId: 'other' })), minimumSimilarity: 0.9 })
    expect(result.status).toBe('NO_COMPARABLE_EXPERIENCE')
  })
})
