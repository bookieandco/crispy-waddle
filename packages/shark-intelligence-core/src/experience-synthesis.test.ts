import { synthesizeSharkExperiencePattern } from './experience-synthesis'

describe('SHARK 1.42-B experience synthesis boundaries', () => {
  const make = (id: string, outcome: number, weight = 0.8) => ({
    experienceId: id, occurredAt: '2026-08-01', scenarioId: `scenario-${id}`, strategyId: 's1', outcomeScore: outcome,
    confidence: 0.9, provenanceComplete: true, weight, relevance: 0.9, recency: 0.8, outcomeQuality: (outcome + 1) / 2,
  })

  it('requires enough experiences before synthesizing a pattern', () => {
    const result = synthesizeSharkExperiencePattern({ patternId: 'p1', experiences: [make('e1', 1), make('e2', 1)] })
    expect(result.status).toBe('INSUFFICIENT_PATTERN_EVIDENCE')
  })

  it('marks consistent outcomes as a supported pattern', () => {
    const result = synthesizeSharkExperiencePattern({ patternId: 'p2', experiences: [make('e1', 1), make('e2', 1), make('e3', 0.8)] })
    expect(result.status).toBe('SUPPORTED_PATTERN')
    expect(result.patternConfidence).toBeGreaterThan(0)
    expect(result.experienceIds).toEqual(['e1', 'e2', 'e3'])
  })

  it('preserves disagreement instead of forcing a false consensus', () => {
    const result = synthesizeSharkExperiencePattern({ patternId: 'p3', experiences: [make('e1', 1), make('e2', -1), make('e3', -1)] })
    expect(result.status).toBe('MIXED_PATTERN')
    expect(result.experienceIds).toHaveLength(3)
  })

  it('keeps synthesis evidence attributable to its source experiences', () => {
    const result = synthesizeSharkExperiencePattern({ patternId: 'p4', experiences: [make('e1', 1), make('e2', 1), make('e3', 1)] })
    expect(result.experienceIds).toEqual(['e1', 'e2', 'e3'])
    expect(result.aggregateWeight).toBe(2.4)
  })
})
