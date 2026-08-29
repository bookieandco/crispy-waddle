import type { SharkOpportunityDecision } from './index.js'
import { buildSharkLearningSnapshot, type SharkLearningSnapshot, type SharkOutcome } from './learning.js'
import type { SharkSimulationLearningRecord } from './simulation-learning.js'

export type SharkAttributedLearningRecord = {
  decision: SharkOpportunityDecision
  outcome: SharkOutcome
  strategyId: string
  strategyVersion: string
  featureSet: Record<string, number>
  reasoning: string[]
}

/**
 * Rebuild learning statistics from the decisions that actually produced each
 * historical outcome. No current/live decision is substituted for history.
 */
export function buildAttributedLearningSnapshot(
  records: SharkAttributedLearningRecord[],
  version = 'shark-learning-v1',
): SharkLearningSnapshot {
  return buildSharkLearningSnapshot(
    records.map((record) => ({ decision: record.decision, outcome: record.outcome })),
    version,
  )
}

export function toAttributedLearningRecord(
  record: SharkSimulationLearningRecord,
  decision: SharkOpportunityDecision,
): SharkAttributedLearningRecord {
  if (record.outcome.decisionId !== decision.id) {
    throw new Error('historical outcome does not match supplied decision')
  }
  if (record.outcome.opportunityId !== decision.opportunityId) {
    throw new Error('historical outcome does not match supplied opportunity')
  }
  return {
    decision,
    outcome: { ...record.outcome },
    strategyId: record.strategyId,
    strategyVersion: record.strategyVersion,
    featureSet: { ...record.featureSet },
    reasoning: [...record.reasoning],
  }
}
