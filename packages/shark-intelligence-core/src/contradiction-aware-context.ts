import type { SharkRecallCandidate } from './contextual-recall-ranking'

export type SharkContradictionAwareContext = {
  supportingExperienceIds: string[]
  conflictingExperienceIds: string[]
  supportingScores: Record<string, number>
  conflictingScores: Record<string, number>
  balance: number
}

export function assembleContradictionAwareSharkContext(input: {
  candidates: SharkRecallCandidate[]
  conflictingExperienceIds: string[]
}): SharkContradictionAwareContext {
  const conflicts = new Set(input.conflictingExperienceIds)
  const supporting = input.candidates.filter(c => !conflicts.has(c.experienceId))
  const conflicting = input.candidates.filter(c => conflicts.has(c.experienceId))
  const supportingScores = Object.fromEntries(supporting.map(c => [c.experienceId, c.relevance * c.confidence * c.relationshipStrength]))
  const conflictingScores = Object.fromEntries(conflicting.map(c => [c.experienceId, c.relevance * c.confidence * c.relationshipStrength]))
  const supportTotal = Object.values(supportingScores).reduce((a, b) => a + b, 0)
  const conflictTotal = Object.values(conflictingScores).reduce((a, b) => a + b, 0)
  const total = supportTotal + conflictTotal
  return {
    supportingExperienceIds: supporting.map(c => c.experienceId),
    conflictingExperienceIds: conflicting.map(c => c.experienceId),
    supportingScores,
    conflictingScores,
    balance: total ? (supportTotal - conflictTotal) / total : 0,
  }
}
