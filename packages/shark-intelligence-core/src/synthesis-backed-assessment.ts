import type { SharkExperienceSynthesis } from './experience-synthesis'

export type SharkSynthesisBackedAssessment = {
  status: 'PATTERN_SUPPORTED' | 'PATTERN_MIXED' | 'PATTERN_INSUFFICIENT'
  patternId: string
  patternConfidence: number
  supportingExperienceIds: string[]
  preservesRawExperience: true
}

export function assessWithSynthesizedSharkPattern(pattern: SharkExperienceSynthesis): SharkSynthesisBackedAssessment {
  const status = pattern.status === 'SUPPORTED_PATTERN'
    ? 'PATTERN_SUPPORTED'
    : pattern.status === 'MIXED_PATTERN'
      ? 'PATTERN_MIXED'
      : 'PATTERN_INSUFFICIENT'
  return {
    status,
    patternId: pattern.patternId,
    patternConfidence: pattern.patternConfidence,
    supportingExperienceIds: [...pattern.experienceIds],
    preservesRawExperience: true,
  }
}
