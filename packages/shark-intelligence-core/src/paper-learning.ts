import type { SharkOpportunityDecision } from './index.js'
import type { SharkPaperExecutionResult } from './paper-execution.js'
import { simulationTradeToOutcome } from './simulation-learning.js'
import type { SharkDecisionRecord } from './strategy-registry.js'

export type SharkPaperLearningInput = {
  decision: SharkOpportunityDecision
  execution: SharkPaperExecutionResult
  strategy?: SharkDecisionRecord
}

export function paperExecutionToLearningInput(input: SharkPaperLearningInput) {
  if (!input.execution.simulated) throw new Error('paper execution must be explicitly simulated')
  if (input.execution.order.decisionId !== input.decision.id) throw new Error('paper execution decision does not match assessment decision')
  if (input.execution.order.opportunityId !== input.decision.opportunityId) throw new Error('paper execution opportunity does not match assessment opportunity')
  if (input.strategy && input.strategy.decision.id !== input.decision.id) throw new Error('paper execution strategy record does not match assessment decision')

  const strategyId = input.strategy?.strategyId ?? 'paper-default'
  const strategyVersion = input.strategy?.strategyVersion ?? '1'
  const trade = {
    opportunityId: input.decision.opportunityId,
    decisionId: input.decision.id,
    strategyId,
    strategyVersion,
    entryPrice: input.execution.fills[0]?.price ?? 0,
    exitPrice: input.execution.fills[0]?.price ?? 0,
    quantity: input.execution.fills.reduce((sum, fill) => sum + fill.quantity, 0),
    grossPnl: input.execution.position.realizedPnl,
    fees: input.execution.fills.reduce((sum, fill) => sum + fill.fee, 0),
    netPnl: input.execution.position.realizedPnl - input.execution.fills.reduce((sum, fill) => sum + fill.fee, 0),
    holdingPeriodMs: 0,
    outcome: input.execution.position.realizedPnl > 0 ? 'win' : input.execution.position.realizedPnl < 0 ? 'loss' : 'flat',
    paper: true,
    simulated: true,
  } as const

  return { decision: input.decision, strategyId, strategyVersion, trade, outcome: simulationTradeToOutcome(trade) }
}
