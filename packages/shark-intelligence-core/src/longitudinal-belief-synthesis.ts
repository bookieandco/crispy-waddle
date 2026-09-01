import type { SharkBeliefHistory } from './belief-history'

export type SharkLongitudinalBeliefAssessment = Readonly<{
  beliefId: string
  currentVersion: number
  currentConfidence: number
  historicalAverageConfidence: number
  supportCount: number
  conflictCount: number
  netEvidence: number
  direction: 'reinforced' | 'weakened' | 'stable'
  supportingExperienceIds: readonly string[]
  conflictingExperienceIds: readonly string[]
}>

export function synthesizeSharkLongitudinalBelief(input: {
  history: SharkBeliefHistory
  newSupportingExperienceIds?: readonly string[]
  newConflictingExperienceIds?: readonly string[]
  stabilityThreshold?: number
}): SharkLongitudinalBeliefAssessment {
  const versions = input.history.versions
  if (!versions.length) throw new Error('belief history must contain at least one version')
  const threshold = input.stabilityThreshold ?? 0.05
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('stability threshold must be between 0 and 1')

  const current = versions.at(-1)!
  const supportingExperienceIds = [...new Set([...current.supportingExperienceIds, ...(input.newSupportingExperienceIds ?? [])])]
  const conflictingExperienceIds = [...new Set([...current.conflictingExperienceIds, ...(input.newConflictingExperienceIds ?? [])])]
  const historicalAverageConfidence = versions.reduce((sum, version) => sum + version.confidence, 0) / versions.length
  const direction = current.confidence - historicalAverageConfidence > threshold
    ? 'reinforced'
    : current.confidence - historicalAverageConfidence < -threshold
      ? 'weakened'
      : 'stable'

  return Object.freeze({
    beliefId: input.history.beliefId,
    currentVersion: current.version,
    currentConfidence: current.confidence,
    historicalAverageConfidence,
    supportCount: supportingExperienceIds.length,
    conflictCount: conflictingExperienceIds.length,
    netEvidence: supportingExperienceIds.length - conflictingExperienceIds.length,
    direction,
    supportingExperienceIds: Object.freeze(supportingExperienceIds),
    conflictingExperienceIds: Object.freeze(conflictingExperienceIds),
  })
}
