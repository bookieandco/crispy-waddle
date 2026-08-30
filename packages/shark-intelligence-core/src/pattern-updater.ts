import type { SharkExperienceSynthesis } from './experience-synthesis'

export type SharkPatternUpdate = {
  pattern: SharkExperienceSynthesis
  priorConfidence: number
  newConfidence: number
  reinforced: boolean
  contradicted: boolean
  contributingExperienceIds: string[]
}

export function updateSharkPatternFromExperience(input: {
  pattern: SharkExperienceSynthesis
  experienceOutcome: number
  experienceId: string
  similarity: number
}): SharkPatternUpdate {
  if (!input.experienceId.trim()) throw new Error('experience id is required')
  if (!Number.isFinite(input.similarity) || input.similarity < 0 || input.similarity > 1) throw new Error('similarity must be between 0 and 1')
  const priorConfidence = input.pattern.patternConfidence
  const agrees = Math.sign(input.experienceOutcome) === Math.sign(input.pattern.averageOutcome)
  const delta = 0.1 * input.similarity
  const newConfidence = Math.max(0, Math.min(1, priorConfidence + (agrees ? delta : -delta)))
  return {
    pattern: { ...input.pattern, patternConfidence: newConfidence, experienceIds: input.pattern.experienceIds.includes(input.experienceId) ? [...input.pattern.experienceIds] : [...input.pattern.experienceIds, input.experienceId] },
    priorConfidence,
    newConfidence,
    reinforced: agrees,
    contradicted: !agrees,
    contributingExperienceIds: input.pattern.experienceIds.includes(input.experienceId) ? [...input.pattern.experienceIds] : [...input.pattern.experienceIds, input.experienceId],
  }
}
