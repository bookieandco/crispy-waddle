import type { SharkExperienceWeight } from './experience-ledger'

export type SharkExperienceSynthesis = {
  patternId: string
  experienceIds: string[]
  commonStrategyId: string
  experienceCount: number
  averageOutcome: number
  averageConfidence: number
  aggregateWeight: number
  patternConfidence: number
  status: 'SUPPORTED_PATTERN' | 'MIXED_PATTERN' | 'INSUFFICIENT_PATTERN_EVIDENCE'
}

export function synthesizeSharkExperiencePattern(input: {
  patternId: string
  experiences: SharkExperienceWeight[]
  minimumExperiences?: number
}): SharkExperienceSynthesis {
  const minimum = input.minimumExperiences ?? 3
  if (input.experiences.length < minimum) return {
    patternId: input.patternId, experienceIds: input.experiences.map(e => e.experienceId), commonStrategyId: input.experiences[0]?.strategyId ?? '',
    experienceCount: input.experiences.length, averageOutcome: 0, averageConfidence: 0, aggregateWeight: 0, patternConfidence: 0,
    status: 'INSUFFICIENT_PATTERN_EVIDENCE',
  }
  const totalWeight = input.experiences.reduce((sum, e) => sum + e.weight, 0)
  const averageOutcome = totalWeight ? input.experiences.reduce((sum, e) => sum + e.outcomeScore * e.weight, 0) / totalWeight : 0
  const averageConfidence = totalWeight ? input.experiences.reduce((sum, e) => sum + e.confidence * e.weight, 0) / totalWeight : 0
  const consistency = 1 - Math.min(1, input.experiences.filter(e => Math.sign(e.outcomeScore) !== Math.sign(averageOutcome)).length / input.experiences.length)
  const patternConfidence = Math.max(0, Math.min(1, averageConfidence * consistency * Math.min(1, totalWeight / minimum)))
  return {
    patternId: input.patternId, experienceIds: input.experiences.map(e => e.experienceId), commonStrategyId: input.experiences[0].strategyId,
    experienceCount: input.experiences.length, averageOutcome, averageConfidence, aggregateWeight: totalWeight, patternConfidence,
    status: consistency >= 0.75 ? 'SUPPORTED_PATTERN' : 'MIXED_PATTERN',
  }
}
