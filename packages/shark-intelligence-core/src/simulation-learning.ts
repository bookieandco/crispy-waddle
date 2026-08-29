import type { SharkOpportunityDecision } from './index.js'
import {
  buildSharkLearningSnapshot,
  recordSharkOutcome,
  type SharkLearningSnapshot,
  type SharkOutcome,
} from './learning.js'
import type { SharkSimulationTrade } from './simulation.js'

export type SharkSimulationLearningRecord = {
  strategyId: string
  trade: SharkSimulationTrade
  outcome: SharkOutcome
}

export type SharkStrategyLearning = {
  strategyId: string
  observations: number
  wins: number
  losses: number
  flats: number
  winRate: number
  meanReturnPct: number
  meanPnl: number
}

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
    notes: `paper-simulation strategy=${trade.strategyId} pnl=${trade.pnl}`,
  })
}

function strategyStats(records: SharkSimulationLearningRecord[]): SharkStrategyLearning[] {
  const grouped = new Map<string, SharkSimulationLearningRecord[]>()
  for (const record of records) {
    const bucket = grouped.get(record.strategyId) ?? []
    bucket.push(record)
    grouped.set(record.strategyId, bucket)
  }

  return [...grouped.entries()].map(([strategyId, bucket]) => {
    const wins = bucket.filter((r) => r.outcome.outcome === 'win').length
    const losses = bucket.filter((r) => r.outcome.outcome === 'loss').length
    const flats = bucket.filter((r) => r.outcome.outcome === 'flat').length
    return {
      strategyId,
      observations: bucket.length,
      wins,
      losses,
      flats,
      winRate: (wins + 1) / (wins + losses + flats + 2),
      meanReturnPct: bucket.reduce((sum, r) => sum + r.outcome.realizedReturnPct, 0) / bucket.length,
      meanPnl: bucket.reduce((sum, r) => sum + r.trade.pnl, 0) / bucket.length,
    }
  }).sort((a, b) => b.observations - a.observations || a.strategyId.localeCompare(b.strategyId))
}

export function learnFromSimulationTrade(
  decision: SharkOpportunityDecision,
  trade: SharkSimulationTrade,
  prior: SharkSimulationLearningRecord[] = [],
  version = 'shark-learning-v1',
): {
  record: SharkSimulationLearningRecord
  snapshot: SharkLearningSnapshot
  strategyStats: SharkStrategyLearning[]
} {
  const outcome = simulationTradeToOutcome(decision, trade)
  const record: SharkSimulationLearningRecord = { strategyId: trade.strategyId, trade, outcome }
  const records = [...prior, record]

  const snapshot = buildSharkLearningSnapshot(
    records.map(({ trade: priorTrade, outcome: priorOutcome }) => ({
      decision: priorTrade.decisionId === decision.id ? decision : decision,
      outcome: priorOutcome,
    })),
    version,
  )

  return { record, snapshot, strategyStats: strategyStats(records) }
}
