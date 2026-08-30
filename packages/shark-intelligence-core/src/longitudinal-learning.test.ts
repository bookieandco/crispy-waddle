import { updateSharkExperienceWeights } from './experience-updater'
import { aggregateSharkExperiences } from './experience-aggregate'

describe('SHARK 1.40-E longitudinal learning', () => {
  const experience = (id: string, outcome: number, weight = 0.5) => ({
    experienceId: id, occurredAt: '2026-01-01', scenarioId: 'shared', strategyId: 's1', outcomeScore: outcome,
    confidence: 0.8, provenanceComplete: true, weight, relevance: 0.9, recency: 0.8, outcomeQuality: (outcome + 1) / 2,
  })

  it('retains the full history while updating interpretation', () => {
    let history = Array.from({ length: 20 }, (_, i) => experience(`e-${i}`, i % 2 === 0 ? 1 : -1))
    const originalIds = history.map(e => e.experienceId)
    const result = updateSharkExperienceWeights({ history, newExperience: experience('new', 1) })
    history = [...result.updatedExperiences, result.newExperience]
    expect(history.map(e => e.experienceId)).toEqual([...originalIds, 'new'])
    expect(history).toHaveLength(21)
  })

  it('lets repeated reinforcement increase evidence without exceeding the cap', () => {
    let history = [experience('e1', 1)]
    for (let i = 0; i < 10; i++) history = updateSharkExperienceWeights({ history, newExperience: experience(`new-${i}`, 1) }).updatedExperiences
    expect(history[0].weight).toBeGreaterThan(0.5)
    expect(history[0].weight).toBeLessThanOrEqual(1)
  })

  it('retains contradictory experiences for future comparison', () => {
    const history = [experience('support', 1), experience('contradiction', -1)]
    const result = updateSharkExperienceWeights({ history, newExperience: experience('new', 1) })
    const aggregate = aggregateSharkExperiences([...result.updatedExperiences, result.newExperience])
    expect(result.contradictedIds).toContain('contradiction')
    expect(aggregate.experienceIds).toContain('contradiction')
  })
})
