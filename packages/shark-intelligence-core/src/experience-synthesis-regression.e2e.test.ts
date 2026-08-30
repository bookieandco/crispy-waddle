import { synthesizeSharkExperiencePattern } from './experience-synthesis'
import { updateSharkPatternFromExperience } from './pattern-updater'

describe('SHARK 1.42-E synthesis longitudinal regression', () => {
  const make = (id: string, outcome: number, weight = 0.8) => ({
    experienceId: id, occurredAt: '2026-08-01', scenarioId: `scenario-${id}`, strategyId: 's1', outcomeScore: outcome,
    confidence: 0.9, provenanceComplete: true, weight, relevance: 0.9, recency: 0.8, outcomeQuality: (outcome + 1) / 2,
  })

  it('retains all source experiences while evolving the synthesized pattern', () => {
    const experiences = [make('e1', 1), make('e2', 1), make('e3', 1)]
    const pattern = synthesizeSharkExperiencePattern({ patternId: 'p1', experiences })
    const updated = updateSharkPatternFromExperience({ pattern, experienceOutcome: 1, experienceId: 'e4', similarity: 1 })
    expect(updated.pattern.experienceIds).toEqual(['e1', 'e2', 'e3', 'e4'])
    expect(updated.newConfidence).toBeGreaterThan(updated.priorConfidence)
  })

  it('reduces confidence for contradictory evidence without erasing prior pattern evidence', () => {
    const pattern = synthesizeSharkExperiencePattern({ patternId: 'p2', experiences: [make('e1', 1), make('e2', 1), make('e3', 1)] })
    const updated = updateSharkPatternFromExperience({ pattern, experienceOutcome: -1, experienceId: 'e4', similarity: 1 })
    expect(updated.newConfidence).toBeLessThan(updated.priorConfidence)
    expect(updated.pattern.experienceIds).toContain('e1')
    expect(updated.pattern.experienceIds).toContain('e4')
  })

  it('does not synthesize a pattern from insufficient evidence', () => {
    const pattern = synthesizeSharkExperiencePattern({ patternId: 'p3', experiences: [make('e1', 1), make('e2', 1)] })
    expect(pattern.status).toBe('INSUFFICIENT_PATTERN_EVIDENCE')
    expect(pattern.patternConfidence).toBe(0)
  })
})
