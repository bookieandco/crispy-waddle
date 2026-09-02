import { createMemeTradeAssessment, type MemeTradeAssessment } from './assessment'
import { derivePersistedActorIntelligence, type PersistedActorOutcomeRecord } from './persisted-actor-intelligence'
import { applyActorRiskIntelligence } from './actor-risk-integration'
import type { EntityGraph } from './entity-graph'
import type { TokenLaunch } from './wallet-launch-pipeline'
import type { LPWithdrawalAttribution } from './lp-withdrawal-attribution'
import type { MigrationAwareClassification } from './migration-classification'

export type ActorAwareAssessmentInput = Parameters<typeof createMemeTradeAssessment>[0] & {
  actorGraph: EntityGraph
  /** Optional compatibility path for callers that already have historical launches in memory. */
  historicalLaunches?: TokenLaunch[]
  /** Preferred path after historical backfill: durable actor reputation loaded from persistence. */
  persistedActorOutcomeHistory?: PersistedActorOutcomeRecord[]
  /** Verified transaction-level LP withdrawals. These remain advisory until actor-risk validation accepts them. */
  verifiedLPWithdrawals?: LPWithdrawalAttribution[]
  /** Migration classifications keyed by withdrawal event ID or signature. */
  migrationClassifications?: Record<string, MigrationAwareClassification>
}

/**
 * Canonical actor-aware assessment path. Durable reputation is preferred; graph attribution remains
 * confidence-weighted and advisory. Transaction-level LP attribution and migration evidence are
 * composed here so actor risk sees the same evidence set as the canonical assessment.
 */
export function createActorAwareMemeTradeAssessment(input: ActorAwareAssessmentInput): MemeTradeAssessment {
  const {
    actorGraph,
    historicalLaunches = [],
    persistedActorOutcomeHistory = [],
    verifiedLPWithdrawals = [],
    migrationClassifications = {},
    ...assessmentInput
  } = input
  const assessment = createMemeTradeAssessment(assessmentInput)
  const actorIntelligence = derivePersistedActorIntelligence({
    currentGraph: actorGraph,
    currentTokenAddress: assessment.token.tokenAddress,
    historicalLaunches,
    persistedRecords: persistedActorOutcomeHistory,
  })
  return applyActorRiskIntelligence(assessment, {
    ...actorIntelligence,
    verifiedLPWithdrawals,
    migrationClassifications,
  })
}
