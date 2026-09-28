import type { PositionExitIntentCandidate } from './position-management.js'
import type { DexSwapIntent } from './solana-dex-runtime-contracts.js'

export type MoneyTradeStageEmission=Readonly<{
 type:'RISK_APPROVED'|'ORDER_INTENT_CREATED'|'EXITED'
 tradeId:string
 runLineageId:string
 strategyId:string
 instrumentId:string
 tokenAddress?:string
 leg:'ENTRY'|'EXIT'
 occurredAt:string
 evidenceIds:readonly string[]
 details:Readonly<Record<string,unknown>>
 domain:'MONEY'
 authority:'TRADE_STAGE_EVENT_ONLY'
}>

export interface MoneyTradeStageEventSink{
 publish(event:MoneyTradeStageEmission):Promise<void>|void
}

const unique=(values:readonly string[])=>Object.freeze([...new Set(values)])

async function emit(sink:MoneyTradeStageEventSink,event:MoneyTradeStageEmission):Promise<void>{
 if(event.domain!=='MONEY'||event.authority!=='TRADE_STAGE_EVENT_ONLY')throw new Error('MONEY_TRADE_EVENT_AUTHORITY_INVALID')
 if(!event.tradeId.trim()||!event.runLineageId.trim()||!event.strategyId.trim()||!event.instrumentId.trim())throw new Error('MONEY_TRADE_EVENT_LINEAGE_REQUIRED')
 if(!event.evidenceIds.length)throw new Error('MONEY_TRADE_EVENT_EVIDENCE_REQUIRED')
 await sink.publish(Object.freeze({...event,evidenceIds:unique(event.evidenceIds),details:Object.freeze({...event.details})}))
}

export async function publishMoneyRiskApproved(input:{
 sink:MoneyTradeStageEventSink
 intent:DexSwapIntent
 evidenceIds:readonly string[]
}):Promise<void>{
 await emit(input.sink,Object.freeze({
  type:'RISK_APPROVED',
  tradeId:input.intent.tradeId,
  runLineageId:input.intent.runLineageId,
  strategyId:input.intent.strategyId,
  instrumentId:input.intent.instrumentId,
  leg:input.intent.leg,
  occurredAt:input.intent.approval.approvedAt,
  evidenceIds:unique([...input.intent.evidenceIds,...input.evidenceIds]),
  details:Object.freeze({
   riskDecisionId:input.intent.approval.moneyRiskDecisionId,
   sharkAssessmentId:input.intent.approval.sharkAssessmentId,
   thesisId:input.intent.approval.thesisId,
   edgeDecisionBundleHash:input.intent.approval.edgeDecisionBundleHash,
   integrityGuardHash:input.intent.approval.integrityGuardHash,
   approvalBindingHash:input.intent.approval.bindingHash,
  }),
  domain:'MONEY',
  authority:'TRADE_STAGE_EVENT_ONLY',
 }))
}

export async function publishOrderIntentCreated(input:{
 sink:MoneyTradeStageEventSink
 intent:DexSwapIntent
 createdAt:string
}):Promise<void>{
 await emit(input.sink,Object.freeze({
  type:'ORDER_INTENT_CREATED',
  tradeId:input.intent.tradeId,
  runLineageId:input.intent.runLineageId,
  strategyId:input.intent.strategyId,
  instrumentId:input.intent.instrumentId,
  leg:input.intent.leg,
  occurredAt:input.createdAt,
  evidenceIds:input.intent.evidenceIds,
  details:Object.freeze({
   intentId:input.intent.executionId,
   requestId:input.intent.requestId,
   inputMint:input.intent.inputMint,
   outputMint:input.intent.outputMint,
   inputAmountAtomic:input.intent.inputAmountAtomic.toString(),
   minimumOutputAtomic:input.intent.minimumOutputAtomic.toString(),
   notionalMinor:input.intent.notionalMinor.toString(),
   currency:input.intent.currency,
   approvalBindingHash:input.intent.approval.bindingHash,
   authority:input.intent.authority,
  }),
  domain:'MONEY',
  authority:'TRADE_STAGE_EVENT_ONLY',
 }))
}

export async function publishPositionExited(input:{
 sink:MoneyTradeStageEventSink
 tradeId:string
 runLineageId:string
 strategyId:string
 instrumentId:string
 tokenAddress?:string
 exitIntent:PositionExitIntentCandidate
 occurredAt:string
 realizedPnlMinor:bigint
 exitExecutionId:string
 exitSignature:string
 evidenceIds:readonly string[]
}):Promise<void>{
 if(input.exitIntent.action!=='EXIT')throw new Error('MONEY_TRADE_EXIT_EVENT_FULL_EXIT_REQUIRED')
 await emit(input.sink,Object.freeze({
  type:'EXITED',
  tradeId:input.tradeId,
  runLineageId:input.runLineageId,
  strategyId:input.strategyId,
  instrumentId:input.instrumentId,
  tokenAddress:input.tokenAddress,
  leg:'EXIT',
  occurredAt:input.occurredAt,
  evidenceIds:unique([...input.exitIntent.evidenceIds,...input.evidenceIds]),
  details:Object.freeze({
   exitIntentId:input.exitIntent.exitIntentId,
   positionDecisionId:input.exitIntent.sourceDecisionId,
   exitExecutionId:input.exitExecutionId,
   exitSignature:input.exitSignature,
   realizedPnlMinor:input.realizedPnlMinor.toString(),
   reasonCodes:input.exitIntent.reasonCodes,
  }),
  domain:'MONEY',
  authority:'TRADE_STAGE_EVENT_ONLY',
 }))
}
