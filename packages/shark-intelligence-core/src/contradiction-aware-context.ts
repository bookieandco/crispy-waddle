import type { SharkRecallCandidate } from './contextual-recall-ranking'

export type SharkContradictionAwareContext = {
  supportingExperienceIds: string[]
  conflictingExperienceIds: string[]
  supportingScores: Record<string, number>
  conflictingScores: Record<string, number>
  balance: number
  contradictionReserved: boolean
  contradictionQuota: number
}

export function assembleContradictionAwareSharkContext(input: {
  candidates: SharkRecallCandidate[]
  conflictingExperienceIds: string[]
  maxCandidates?: number
  minimumContradictions?: number
}): SharkContradictionAwareContext {
  const maxCandidates = input.maxCandidates ?? input.candidates.length
  const minimumContradictions = input.minimumContradictions ?? 1
  if (!Number.isInteger(maxCandidates) || maxCandidates < 1) throw new Error('maxCandidates must be a positive integer')
  if (!Number.isInteger(minimumContradictions) || minimumContradictions < 0 || minimumContradictions > maxCandidates) throw new Error('invalid contradiction quota')

  const conflicts = new Set(input.conflictingExperienceIds)
  const supporting = input.candidates.filter(c => !conflicts.has(c.experienceId))
  const conflicting = input.candidates.filter(c => conflicts.has(c.experienceId))
  const quota = Math.min(minimumContradictions, conflicting.length)
  const selected = [
    ...conflicting.slice(0, quota),
    ...supporting.slice(0, Math.max(0, maxCandidates - quota)),
  ]
  const candidates = selected.length >= maxCandidates ? selected : [...selected, ...conflicting.slice(quota, maxCandidates - selected.length)]
  const supportingScores = Object.fromEntries(candidates.filter(c => !conflicts.has(c.experienceId)).map(c => [c.experienceId, c.relevance * c.confidence * c.relationshipStrength]))
  const conflictingScores = Object.fromEntries(candidates.filter(c => conflicts.has(c.experienceId)).map(c => [c.experienceId, c.relevance * c.confidence * c.relationshipStrength]))
  const supportTotal = Object.values(supportingScores).reduce((a, b) => a + b, 0)
  const conflictTotal = Object.values(conflictingScores).reduce((a, b) => a + b, 0)
  const total = supportTotal + conflictTotal
  return {
    supportingExperienceIds: candidates.filter(c => !conflicts.has(c.experienceId)).map(c => c.experienceId),
    conflictingExperienceIds: candidates.filter(c => conflicts.has(c.experienceId)).map(c => c.experienceId),
    supportingScores,
    conflictingScores,
    balance: total ? (supportTotal - conflictTotal) / total : 0,
    contradictionReserved: quota > 0,
    contradictionQuota: quota,
  }
}
