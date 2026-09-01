import type { SharkRankedRecall, SharkRecallCandidate } from './contextual-recall-ranking'
import { applySharkBeliefContextFeedback, type SharkBeliefContextFeedback } from './belief-context-feedback'
import type { SharkLongitudinalBeliefReconciliation } from './longitudinal-belief-reconciliation'
import type { SharkLongitudinalContext } from './longitudinal-context-continuity'
import { assembleContradictionAwareSharkContext } from './contradiction-aware-context'
import { rankSharkContextualRecall } from './contextual-recall-ranking'

export type SharkAssembledRecall = Readonly<{
  experienceId: string
  rank: number
  score: number
  contextualWeight: number
  role: 'supporting' | 'contradictory' | 'neutral'
}>

export type SharkContextAwareRetrievalContext = Readonly<{
  candidates: readonly SharkAssembledRecall[]
  supportingExperienceIds: readonly string[]
  contradictoryExperienceIds: readonly string[]
  neutralExperienceIds: readonly string[]
  beliefFeedback?: SharkBeliefContextFeedback['frame']
}>

export function assembleSharkContextAwareRetrieval(input: {
  ranked: SharkRankedRecall[]
  contradictoryExperienceIds?: string[]
}): SharkContextAwareRetrievalContext {
  const contradictory = new Set(input.contradictoryExperienceIds ?? [])
  const candidates = input.ranked.map(item => Object.freeze({
    experienceId: item.experienceId,
    rank: item.rank,
    score: item.score,
    contextualWeight: item.contextualWeight,
    role: contradictory.has(item.experienceId) ? 'contradictory' as const : 'supporting' as const,
  }))
  return Object.freeze({
    candidates: Object.freeze(candidates),
    supportingExperienceIds: Object.freeze(candidates.filter(c => c.role === 'supporting').map(c => c.experienceId)),
    contradictoryExperienceIds: Object.freeze(candidates.filter(c => c.role === 'contradictory').map(c => c.experienceId)),
    neutralExperienceIds: Object.freeze([] as string[]),
  })
}

export function assembleSharkBeliefAwareContext(input: {
  candidates: SharkRecallCandidate[]
  reconciliation: SharkLongitudinalBeliefReconciliation
  context?: SharkLongitudinalContext
  maxCandidates?: number
  minimumContradictions?: number
  maxInfluence?: number
  generatedAt?: string
}): SharkContextAwareRetrievalContext {
  const feedback = applySharkBeliefContextFeedback({
    reconciliation: input.reconciliation,
    candidates: input.candidates,
    context: input.context,
    maxInfluence: input.maxInfluence,
    generatedAt: input.generatedAt,
  })

  const ranked = rankSharkContextualRecall({
    candidates: [...feedback.candidates],
    limit: input.maxCandidates,
  })

  const rankedById = new Map(ranked.map(item => [item.experienceId, item]))
  const orderedCandidates = [...feedback.candidates].sort((a, b) => {
    const rankA = rankedById.get(a.experienceId)?.rank ?? Number.MAX_SAFE_INTEGER
    const rankB = rankedById.get(b.experienceId)?.rank ?? Number.MAX_SAFE_INTEGER
    return rankA - rankB || a.experienceId.localeCompare(b.experienceId)
  })

  const contradictionAware = assembleContradictionAwareSharkContext({
    candidates: orderedCandidates,
    conflictingExperienceIds: [...feedback.frame.conflictingExperienceIds],
    maxCandidates: input.maxCandidates ?? feedback.candidates.length,
    minimumContradictions: input.minimumContradictions,
  })

  const selectedIds = [
    ...contradictionAware.conflictingExperienceIds,
    ...contradictionAware.supportingExperienceIds,
  ]
  const selectedRanked = selectedIds
    .map(id => rankedById.get(id))
    .filter((item): item is SharkRankedRecall => item !== undefined)
    .sort((a, b) => a.rank - b.rank || a.experienceId.localeCompare(b.experienceId))
    .map((item, index) => ({ ...item, rank: index + 1 }))

  const assembled = assembleSharkContextAwareRetrieval({
    ranked: selectedRanked,
    contradictoryExperienceIds: [...contradictionAware.conflictingExperienceIds],
  })

  return Object.freeze({
    ...assembled,
    beliefFeedback: feedback.frame,
  })
}
