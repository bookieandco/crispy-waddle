import { createHash } from 'node:crypto'
import type { PaperExecutionOutcome, PaperPortfolio } from './paper-execution-contracts.js'
import type { ExactAmount } from './portfolio-construction-contracts.js'

export type PaperStrategyResult = Readonly<{
  strategyResultId: string
  paperRunId: string
  currency: string
  startingValue: ExactAmount
  endingValue: ExactAmount
  realizedPnl: ExactAmount
  unrealizedPnl: ExactAmount
  totalPnl: ExactAmount
  returnBps: number
  feesPaid: ExactAmount
  aggregateFillRateBps: number
  weightedSlippageBps: number
  executionOutcomeIds: readonly string[]
  executionPlanIds: readonly string[]
  terminalState: 'OPEN' | 'CLOSED'
  startedAt: string
  endedAt: string
  evidenceIds: readonly string[]
  stateHash: string
  authority: 'LEARNING_ONLY'
}>

const amount=(minor:bigint,currency:string):ExactAmount=>Object.freeze({minor,currency})
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')

export function summarizePaperStrategyResult(input:{
  paperRunId:string
  startingValue:ExactAmount
  finalPortfolio:PaperPortfolio
  executionOutcomes:readonly PaperExecutionOutcome[]
  startedAt:string
  endedAt:string
}):PaperStrategyResult{
  if(!input.paperRunId.trim())throw new Error('MONEY_043_STRATEGY_RUN_ID_REQUIRED')
  if(input.finalPortfolio.paperRunId!==input.paperRunId)throw new Error('MONEY_043_STRATEGY_PORTFOLIO_RUN_MISMATCH')
  if(input.startingValue.currency!==input.finalPortfolio.currency||input.startingValue.minor<=0n)throw new Error('MONEY_043_STRATEGY_START_VALUE_INVALID')
  if(!input.startedAt||!input.endedAt||input.endedAt<input.startedAt||input.finalPortfolio.asOf>input.endedAt)throw new Error('MONEY_043_STRATEGY_TIME_INVALID')
  if(!input.executionOutcomes.length)throw new Error('MONEY_043_STRATEGY_EXECUTION_OUTCOME_REQUIRED')

  const currency=input.finalPortfolio.currency
  for(const outcome of input.executionOutcomes){
    if(outcome.paperRunId!==input.paperRunId)throw new Error('MONEY_043_STRATEGY_OUTCOME_RUN_MISMATCH')
    if(outcome.authority!=='LEARNING_ONLY')throw new Error('MONEY_043_STRATEGY_OUTCOME_AUTHORITY_INVALID')
    if(outcome.requestedNotional.currency!==currency||outcome.filledNotional.currency!==currency||outcome.feesPaid.currency!==currency)throw new Error('MONEY_043_STRATEGY_CURRENCY_MISMATCH')
    if(outcome.createdAt>input.endedAt)throw new Error('MONEY_043_STRATEGY_FUTURE_OUTCOME')
  }

  const marketValue=input.finalPortfolio.positions.reduce((n,p)=>{
    if(p.marketValue.currency!==currency||p.unrealizedPnl.currency!==currency||p.costBasis.currency!==currency)throw new Error('MONEY_043_STRATEGY_POSITION_CURRENCY_MISMATCH')
    return n+p.marketValue.minor
  },0n)
  const unrealized=input.finalPortfolio.positions.reduce((n,p)=>n+p.unrealizedPnl.minor,0n)
  const ending=input.finalPortfolio.cash.minor+marketValue
  const total=ending-input.startingValue.minor
  const decomposed=input.finalPortfolio.realizedPnl.minor+unrealized
  if(total!==decomposed)throw new Error('MONEY_043_STRATEGY_PNL_RECONCILIATION_FAILED')

  const requested=input.executionOutcomes.reduce((n,o)=>n+o.requestedNotional.minor,0n)
  const filled=input.executionOutcomes.reduce((n,o)=>n+o.filledNotional.minor,0n)
  const aggregateFillRateBps=requested?Number(filled*10000n/requested):0
  const weightedSlippageBps=filled?Number(input.executionOutcomes.reduce((n,o)=>n+BigInt(o.weightedSlippageBps)*o.filledNotional.minor,0n)/filled):0
  const returnBps=Number(total*10000n/input.startingValue.minor)
  const executionOutcomeIds=Object.freeze(input.executionOutcomes.map(o=>o.outcomeId).sort())
  const executionPlanIds=Object.freeze([...new Set(input.executionOutcomes.map(o=>o.executionPlanId))].sort())
  const evidenceIds=Object.freeze([...new Set([
    ...input.executionOutcomes.flatMap(o=>o.evidenceIds),
    ...input.finalPortfolio.positions.flatMap(p=>p.evidenceIds),
  ])].sort())
  if(!evidenceIds.length)throw new Error('MONEY_043_STRATEGY_EVIDENCE_REQUIRED')
  const stateHash=hash({
    paperRunId:input.paperRunId,
    portfolioStateHash:input.finalPortfolio.stateHash,
    startingValue:input.startingValue,
    ending,
    realized:input.finalPortfolio.realizedPnl.minor,
    unrealized,
    executionOutcomeIds,
    startedAt:input.startedAt,
    endedAt:input.endedAt,
  })
  return Object.freeze({
    strategyResultId:`paper-strategy:${stateHash}`,
    paperRunId:input.paperRunId,
    currency,
    startingValue:input.startingValue,
    endingValue:amount(ending,currency),
    realizedPnl:input.finalPortfolio.realizedPnl,
    unrealizedPnl:amount(unrealized,currency),
    totalPnl:amount(total,currency),
    returnBps,
    feesPaid:input.finalPortfolio.feesPaid,
    aggregateFillRateBps,
    weightedSlippageBps,
    executionOutcomeIds,
    executionPlanIds,
    terminalState:input.finalPortfolio.positions.length?'OPEN':'CLOSED',
    startedAt:input.startedAt,
    endedAt:input.endedAt,
    evidenceIds,
    stateHash,
    authority:'LEARNING_ONLY',
  })
}
