import { createMemeTradeAssessment, type MemeTradeAssessment } from './assessment'
import { derivePersistedActorIntelligence, type PersistedActorOutcomeRecord } from './persisted-actor-intelligence'
import { applyActorRiskIntelligence } from './actor-risk-integration'
import type { EntityGraph } from './entity-graph'
import type { TokenLaunch } from './wallet-launch-pipeline'

export type ActorAwareAssessmentInput = Parameters<typeof createMemeTradeAssessment>[0] & {
  actorGraph: EntityGraph
  /** Optional compatibility path for callers that already have historical launches in memory. */
  historicalLaunches?: TokenLaunch[]
  /** Preferred path after historical backfill: durable actor reputation loaded from persistence. */
  persistedActorOutcomeHistory?: PersistedActorOutcomeRecord[]
}

/** Canonical actor-aware assessment path. Durable reputation is preferred; graph attribution remains confidence-weighted and advisory. */
export function createActorAwareMemeTradeAssessment(input: ActorAwareAssessmentInput): MemeTradeAssessment {
  const { actorGraph, historicalLaunches = [], persistedActorOutcomeHistory = [], ...assessmentInput } = input
  const assessment = createMemeTradeAssessment(assessmentInput)
  const actorIntelligence = derivePersistedActorIntelligence({
    currentGraph: actorGraph,
    currentTokenAddress: assessment.token.tokenAddress,
    historicalLaunches,
    persistedRecords: persistedActorOutcomeHistory,
  })
  return applyActorRiskIntelligence(assessment, actorIntelligence)
}
