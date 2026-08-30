import type { SharkBeliefHistory } from './belief-history'

export type SharkBeliefReconciliation = Readonly<{
  beliefId: string
  currentConfidence: number
  historicalAverageConfidence: number
  direction: 'reinforced' | 'weakened' | 'stable'
  versionCount: number
  supportingExperienceIds: readonly string[]
  conflictingExperienceIds: readonly string[]
}>

export function reconcileSharkBeliefHistory(input: {
  history: SharkBeliefHistory
  newSupportingExperienceIds?: string[]
  newConflictingExperienceIds?: string[]
  stabilityThreshold?: number
}): SharkBeliefReconciliation {
  const versions = input.history.versions
  if (!versions.length) throw new Error('belief history must contain at least one version')
  const threshold = input.stabilityThreshold ?? 0.05
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('stability threshold must be between 0 and 1')
  const current = versions.at(-1)!
  const average = versions.reduce((sum, version) => sum + version.confidence, 0) / versions.length
  const delta = current.confidence - average
  const direction = delta > threshold ? 'reinforced' : delta < -threshold ? 'weakened' : 'stable'
  return Object.freeze({
    beliefId: input.history.beliefId,
    currentConfidence: current.confidence,
    historicalAverageConfidence: average,
    direction,
    versionCount: versions.length,
    supportingExperienceIds: Object.freeze([...new Set([...current.supportingExperienceIds, ...(input.newSupportingExperienceIds ?? [])])]),
    conflictingExperienceIds: Object.freeze([...new Set([...current.conflictingExperienceIds, ...(input.newConflictingExperienceIds ?? [])])]),
  })
}
