import type { SharkRecallCandidate } from './contextual-recall-ranking'
import type { SharkLongitudinalBeliefReconciliation } from './longitudinal-belief-reconciliation'
import type { SharkLongitudinalContext } from './longitudinal-context-continuity'

export type SharkBeliefContextFrame = Readonly<{
  beliefId: string
  beliefVersion: number
  currentConfidence: number
  direction: SharkLongitudinalBeliefReconciliation['direction']
  influenceStrength: number
  supportingExperienceIds: readonly string[]
  conflictingExperienceIds: readonly string[]
  unresolvedContradictionIds: readonly string[]
  generatedAt: string
}>

export type SharkBeliefContextFeedback = Readonly<{
  frame: SharkBeliefContextFrame
  candidates: readonly SharkRecallCandidate[]
}>

function validateInfluence(value: number): void {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error('influence strength must be between 0 and 1')
  }
}

/**
 * Feeds reconciled belief state into retrieval without turning belief into a filter.
 * Contradictory evidence remains eligible and is never suppressed by this bridge.
 */
export function applySharkBeliefContextFeedback(input: {
  reconciliation: SharkLongitudinalBeliefReconciliation
  candidates: SharkRecallCandidate[]
  context?: SharkLongitudinalContext
  generatedAt?: string
  maxInfluence?: number
}): SharkBeliefContextFeedback {
  const reconciliation = input.reconciliation
  const maxInfluence = input.maxInfluence ?? 0.2
  validateInfluence(maxInfluence)
  if (!Number.isFinite(reconciliation.currentConfidence) || reconciliation.currentConfidence < 0 || reconciliation.currentConfidence > 1) {
    throw new Error('belief confidence must be between 0 and 1')
  }
  if (!Number.isInteger(reconciliation.selectedVersion) || reconciliation.selectedVersion < 1) {
    throw new Error('belief version must be a positive integer')
  }

  const currentContextVersion = input.context?.beliefVersionIds
    .filter(id => id.startsWith(`${reconciliation.beliefId}:v`))
    .map(id => Number(id.slice(`${reconciliation.beliefId}:v`.length)))
    .filter(Number.isInteger)
    .reduce((max, version) => Math.max(max, version), 0) ?? 0

  if (currentContextVersion > reconciliation.selectedVersion) {
    throw new Error('stale belief version cannot overwrite newer context')
  }

  const evidenceMagnitude = Math.min(1, Math.abs(reconciliation.evidenceBalance))
  const influenceStrength = Math.min(maxInfluence, maxInfluence * (0.5 + 0.5 * reconciliation.currentConfidence) * evidenceMagnitude)
  const supporting = new Set(reconciliation.supportingExperienceIds)
  const conflicting = new Set(reconciliation.conflictingExperienceIds)

  const candidates = input.candidates.map(candidate => {
    const isSupporting = supporting.has(candidate.experienceId)
    const isConflicting = conflicting.has(candidate.experienceId)
    // Conflicts receive an explicit non-suppressing boost so belief feedback cannot
    // collapse the evidence surface around what the current belief already favors.
    const alignment = isConflicting ? 1 : isSupporting ? 0.75 : 0
    const contextualWeight = Math.max(0, Math.min(1, (candidate.contextualWeight ?? 1) + influenceStrength * alignment))
    return Object.freeze({ ...candidate, contextualWeight })
  })

  const frame = Object.freeze({
    beliefId: reconciliation.beliefId,
    beliefVersion: reconciliation.selectedVersion,
    currentConfidence: reconciliation.currentConfidence,
    direction: reconciliation.direction,
    influenceStrength,
    supportingExperienceIds: Object.freeze([...reconciliation.supportingExperienceIds]),
    conflictingExperienceIds: Object.freeze([...reconciliation.conflictingExperienceIds]),
    unresolvedContradictionIds: Object.freeze([...(input.context?.unresolvedContradictionIds ?? [])]),
    generatedAt: input.generatedAt ?? new Date().toISOString(),
  })

  return Object.freeze({ frame, candidates: Object.freeze(candidates) })
}
