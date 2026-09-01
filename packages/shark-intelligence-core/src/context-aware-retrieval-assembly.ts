import type { SharkRankedRecall } from './contextual-recall-ranking'

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
