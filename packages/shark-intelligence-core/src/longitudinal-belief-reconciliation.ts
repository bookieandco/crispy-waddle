import type { SharkBeliefHistory } from './belief-history'

export type SharkLongitudinalBeliefReconciliation = Readonly<{
  beliefId: string
  selectedVersion: number
  currentConfidence: number
  historicalAverageConfidence: number
  supportWeight: number
  conflictWeight: number
  netEvidence: number
  evidenceBalance: number
  direction: 'reinforced' | 'weakened' | 'stable'
  supportingExperienceIds: readonly string[]
  conflictingExperienceIds: readonly string[]
  historicalVersionIds: readonly string[]
}>

export function reconcileSharkLongitudinalBelief(input: {
  history: SharkBeliefHistory
  supportingEvidence?: readonly { experienceId: string; weight: number }[]
  conflictingEvidence?: readonly { experienceId: string; weight: number }[]
  stabilityThreshold?: number
}): SharkLongitudinalBeliefReconciliation {
  const versions = input.history.versions
  if (!versions.length) throw new Error('belief history must contain at least one version')
  const threshold = input.stabilityThreshold ?? 0.05
  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) throw new Error('stability threshold must be between 0 and 1')
  const validate = (items: readonly { experienceId: string; weight: number }[]) => items.forEach(item => {
    if (!item.experienceId.trim() || !Number.isFinite(item.weight) || item.weight < 0) throw new Error('evidence IDs and non-negative weights are required')
  })
  const supportingEvidence = input.supportingEvidence ?? []
  const conflictingEvidence = input.conflictingEvidence ?? []
  validate(supportingEvidence)
  validate(conflictingEvidence)

  const current = versions.at(-1)!
  const supportWeight = supportingEvidence.reduce((sum, item) => sum + item.weight, 0)
  const conflictWeight = conflictingEvidence.reduce((sum, item) => sum + item.weight, 0)
  const netEvidence = supportWeight - conflictWeight
  const total = supportWeight + conflictWeight
  const evidenceBalance = total === 0 ? 0 : netEvidence / total
  const historicalAverageConfidence = versions.reduce((sum, version) => sum + version.confidence, 0) / versions.length
  const delta = current.confidence - historicalAverageConfidence
  const direction = delta > threshold ? 'reinforced' : delta < -threshold ? 'weakened' : 'stable'

  return Object.freeze({
    beliefId: input.history.beliefId,
    selectedVersion: current.version,
    currentConfidence: current.confidence,
    historicalAverageConfidence,
    supportWeight,
    conflictWeight,
    netEvidence,
    evidenceBalance,
    direction,
    supportingExperienceIds: Object.freeze([...new Set([...current.supportingExperienceIds, ...supportingEvidence.map(e => e.experienceId)])]),
    conflictingExperienceIds: Object.freeze([...new Set([...current.conflictingExperienceIds, ...conflictingEvidence.map(e => e.experienceId)])]),
    historicalVersionIds: Object.freeze(versions.map(version => `${version.beliefId}:v${version.version}`)),
  })
}
