import { updateSharkExperienceWeights } from './experience-updater'

describe('SHARK 1.40-D reinforcement and contradiction updating', () => {
  const base = (experienceId: string, outcomeScore: number, weight = 0.5) => ({
    experienceId, occurredAt: '2026-01-01', scenarioId: 'same-situation', strategyId: 's1', outcomeScore,
    confidence: 0.8, provenanceComplete: true, weight, relevance: 0.9, recency: 0.8, outcomeQuality: 0.8,
  })
  const newcomer = base('new', 1, 0.7)

  it('reinforces matching historical outcomes', () => {
    const result = updateSharkExperienceWeights({ history: [base('support', 1)], newExperience: newcomer })
    expect(result.reinforcedIds).toEqual(['support'])
    expect(result.updatedExperiences[0].weight).toBeGreaterThan(0.5)
  })

  it('reduces contradictory evidence without deleting it', () => {
    const result = updateSharkExperienceWeights({ history: [base('contrary', -1)], newExperience: newcomer })
    expect(result.contradictedIds).toEqual(['contrary'])
    expect(result.updatedExperiences[0].weight).toBeLessThan(0.5)
    expect(result.updatedExperiences[0].experienceId).toBe('contrary')
  })

  it('does not alter unrelated experiences', () => {
    const unrelated = { ...base('other', -1), scenarioId: 'different-situation' }
    const result = updateSharkExperienceWeights({ history: [unrelated], newExperience: newcomer })
    expect(result.unchangedIds).toEqual(['other'])
    expect(result.updatedExperiences[0].weight).toBe(unrelated.weight)
  })
})
