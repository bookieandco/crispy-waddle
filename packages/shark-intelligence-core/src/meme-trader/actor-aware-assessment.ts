import { createMemeTradeAssessment, type MemeTradeAssessment } from './assessment'
import { deriveHistoricalActorIntelligence } from './actor-intelligence'
import { applyActorRiskIntelligence } from './actor-risk-integration'
import type { EntityGraph } from './entity-graph'
import type { TokenLaunch } from './wallet-launch-pipeline'

export type ActorAwareAssessmentInput = Parameters<typeof createMemeTradeAssessment>[0] & {
  actorGraph: EntityGraph
  historicalLaunches: TokenLaunch[]
}

/** Canonical actor-aware assessment path. Graph attribution is confidence-weighted and historical outcomes are advisory risk evidence only. */
export function createActorAwareMemeTradeAssessment(input: ActorAwareAssessmentInput): MemeTradeAssessment {
  const { actorGraph, historicalLaunches, ...assessmentInput } = input
  const assessment = createMemeTradeAssessment(assessmentInput)
  const actorIntelligence = deriveHistoricalActorIntelligence({ currentGraph: actorGraph, currentTokenAddress: assessment.token.tokenAddress, historicalLaunches })
  return applyActorRiskIntelligence(assessment, actorIntelligence)
}
