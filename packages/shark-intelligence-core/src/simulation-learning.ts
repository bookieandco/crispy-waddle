import type { SharkOpportunityDecision } from './index.js'
import {
  buildSharkLearningSnapshot,
  recordSharkOutcome,
  type SharkLearningSnapshot,
  type SharkOutcome,
} from './learning.js'
import type { SharkSimulationTrade } from './simulation.js'

export type SharkSimulationLearningRecord = {
  trade: SharkSimulationTrade
  outcome: SharkOutcome
}

/** Convert a deterministic paper trade into immutable learning evidence. */
export function simulationTradeToOutcome(
  decision: SharkOpportunityDecision,
  trade: SharkSimulationTrade,
  observedAt = new Date().toISOString(),
): SharkOutcome {
  if (trade.decisionId !== decision.id || trade.opportunityId !== decision.opportunityId) {
    throw new Error('simulation trade does not belong to decision')
  }

  return recordSharkOutcome(decision, {
    decisionId: trade.decisionId,
    opportunityId: trade.opportunityId,
    observedAt,
    outcome: trade.outcome,
    realizedReturnPct: trade.netReturnPct,
    holdingPeriodMinutes: trade.holdingPeriodMinutes,
    notes: `paper-simulation pnl=${trade.pnl}`,
  })
}

/** Append a paper-trade result to the descriptive learning snapshot. */
export function learnFromSimulationTrade(
  decision: SharkOpportunityDecision,
  trade: SharkSimulationTrade,
  prior: SharkSimulationLearningRecord[] = [],
  version = 'shark-learning-v1',
): { record: SharkSimulationLearningRecord; snapshot: SharkLearningSnapshot } {
  const outcome = simulationTradeToOutcome(decision, trade)
  const record = { trade, outcome }
  const records = [...prior, record]

  const snapshot = buildSharkLearningSnapshot(
    records.map(({ trade: _trade, outcome: recordOutcome }) => ({
      decision: _trade.decisionId === decision.id ? decision : decision,
      outcome: recordOutcome,
    })),
    version,
  )

  return { record, snapshot }
}
