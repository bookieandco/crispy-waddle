import type { SharkOpportunityDecision } from './index.js'
import {
  buildSharkLearningSnapshot,
  recordSharkOutcome,
  type SharkLearningSnapshot,
  type SharkOutcome,
} from './learning.js'
import type { SharkSimulationTrade } from './simulation.js'
import type { SharkDecisionRecord } from './strategy-registry.js'

export type SharkSimulationLearningRecord = {
  strategyId: string
  strategyVersion: string
  decisionId: string
  opportunityId: string
  decision: SharkOpportunityDecision
  featureSet: Record<string, number>
  reasoning: string[]
  trade: SharkSimulationTrade
  outcome: SharkOutcome
}

export type SharkStrategyLearning = {
  strategyId: string
  strategyVersion: string
  observations: number
  wins: number
  losses: number
  flats: number
  winRate: number
  meanReturnPct: number
  meanPnl: number
}

export function simulationTradeToOutcome(
  decisionRecord: SharkDecisionRecord,
  trade: SharkSimulationTrade,
  observedAt = new Date().toISOString(),
): SharkOutcome {
  const decision: SharkOpportunityDecision = decisionRecord.decision
  if (trade.decisionId !== decision.id || trade.opportunityId !== decision.opportunityId) {
    throw new Error('simulation trade does not belong to decision record')
  }
  if (trade.strategyId !== decisionRecord.strategyId) {
    throw new Error('simulation trade strategy does not match decision record')
  }

  return recordSharkOutcome(decision, {
    decisionId: trade.decisionId,
    opportunityId: trade.opportunityId,
    observedAt,
    outcome: trade.outcome,
    realizedReturnPct: trade.netReturnPct,
    holdingPeriodMinutes: trade.holdingPeriodMinutes,
    notes: `paper-simulation strategy=${decisionRecord.strategyId}@${decisionRecord.strategyVersion} pnl=${trade.pnl}`,
  })
}

function strategyStats(records: SharkSimulationLearningRecord[]): SharkStrategyLearning[] {
  const grouped = new Map<string, SharkSimulationLearningRecord[]>()
  for (const record of records) {
    const key = `${record.strategyId}@${record.strategyVersion}`
    const bucket = grouped.get(key) ?? []
    bucket.push(record)
    grouped.set(key, bucket)
  }

  return [...grouped.entries()].map(([key, bucket]) => {
    const [strategyId, strategyVersion] = key.split('@')
    const wins = bucket.filter((r) => r.outcome.outcome === 'win').length
    const losses = bucket.filter((r) => r.outcome.outcome === 'loss').length
    const flats = bucket.filter((r) => r.outcome.outcome === 'flat').length
    return {
      strategyId,
      strategyVersion,
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
  decisionRecord: SharkDecisionRecord,
  trade: SharkSimulationTrade,
  prior: SharkSimulationLearningRecord[] = [],
  version = 'shark-learning-v1',
): {
  record: SharkSimulationLearningRecord
  snapshot: SharkLearningSnapshot
  strategyStats: SharkStrategyLearning[]
} {
  const outcome = simulationTradeToOutcome(decisionRecord, trade)
  const record: SharkSimulationLearningRecord = {
    strategyId: decisionRecord.strategyId,
    strategyVersion: decisionRecord.strategyVersion,
    decisionId: decisionRecord.decisionId,
    opportunityId: decisionRecord.opportunityId,
    decision: { ...decisionRecord.decision, risks: [...decisionRecord.decision.risks], evidence: [...decisionRecord.decision.evidence], streetSignals: [...decisionRecord.decision.streetSignals], policy: { ...decisionRecord.decision.policy } },
    featureSet: { ...decisionRecord.featureSet },
    reasoning: [...decisionRecord.reasoning],
    trade,
    outcome: { ...outcome },
  }
  const records = [...prior, record]

  const snapshot = buildSharkLearningSnapshot(
    records.map((item) => ({ decision: item.decision, outcome: item.outcome })),
    version,
  )

  return { record, snapshot, strategyStats: strategyStats(records) }
}
