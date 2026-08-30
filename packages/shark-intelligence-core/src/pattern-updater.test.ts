import { updateSharkPatternFromExperience } from './pattern-updater'

describe('SHARK 1.42-D pattern reinforcement and contradiction', () => {
  const pattern = {
    patternId: 'p1', experienceIds: ['e1', 'e2'], commonStrategyId: 's1', experienceCount: 2,
    averageOutcome: 0.8, averageConfidence: 0.8, aggregateWeight: 1.6, patternConfidence: 0.7,
    status: 'SUPPORTED_PATTERN' as const,
  }

  it('reinforces a pattern when a similar experience agrees', () => {
    const result = updateSharkPatternFromExperience({ pattern, experienceOutcome: 1, experienceId: 'e3', similarity: 0.9 })
    expect(result.reinforced).toBe(true)
    expect(result.newConfidence).toBeGreaterThan(result.priorConfidence)
    expect(result.contributingExperienceIds).toContain('e3')
  })

  it('contradicts a pattern without erasing its prior evidence', () => {
    const result = updateSharkPatternFromExperience({ pattern, experienceOutcome: -1, experienceId: 'e3', similarity: 0.9 })
    expect(result.contradicted).toBe(true)
    expect(result.newConfidence).toBeLessThan(result.priorConfidence)
    expect(result.contributingExperienceIds).toEqual(['e1', 'e2', 'e3'])
  })

  it('does not allow confidence to exceed its bounds', () => {
    const result = updateSharkPatternFromExperience({ pattern: { ...pattern, patternConfidence: 0.99 }, experienceOutcome: 1, experienceId: 'e4', similarity: 1 })
    expect(result.newConfidence).toBeLessThanOrEqual(1)
  })
})
