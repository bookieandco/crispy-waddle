import { assessWithSynthesizedSharkPattern } from './synthesis-backed-assessment'

describe('SHARK 1.42-C synthesis-backed assessment', () => {
  const pattern = {
    patternId: 'p1', experienceIds: ['e1', 'e2', 'e3'], commonStrategyId: 's1', experienceCount: 3,
    averageOutcome: 0.8, averageConfidence: 0.9, aggregateWeight: 2.4, patternConfidence: 0.81,
    status: 'SUPPORTED_PATTERN' as const,
  }

  it('uses synthesized confidence without replacing source experiences', () => {
    const result = assessWithSynthesizedSharkPattern(pattern)
    expect(result.status).toBe('PATTERN_SUPPORTED')
    expect(result.patternConfidence).toBe(0.81)
    expect(result.supportingExperienceIds).toEqual(['e1', 'e2', 'e3'])
    expect(result.preservesRawExperience).toBe(true)
  })

  it('keeps mixed patterns explicitly mixed', () => {
    const result = assessWithSynthesizedSharkPattern({ ...pattern, status: 'MIXED_PATTERN', patternConfidence: 0.3 })
    expect(result.status).toBe('PATTERN_MIXED')
  })

  it('does not promote insufficient patterns', () => {
    const result = assessWithSynthesizedSharkPattern({ ...pattern, status: 'INSUFFICIENT_PATTERN_EVIDENCE', patternConfidence: 0 })
    expect(result.status).toBe('PATTERN_INSUFFICIENT')
  })
})
