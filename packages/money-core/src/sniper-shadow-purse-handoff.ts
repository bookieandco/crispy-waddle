import {createHash} from 'node:crypto'
import type {PurseOpportunityEnvelope} from './purse-opportunity-bus.js'
import type {SharkShadowDecisionTwin} from './shark-shadow-learning.js'
import type {SniperLatencyReceipt} from './sniper-latency-telemetry.js'
import type {SniperExitDecision} from './sniper-exit-sentinel.js'

export const SNIPER_HANDOFF_VERSION='SHARK-SNIPER.FASTPATH.08' as const
export type SniperSettlementEvidence=Readonly<{
 outcomeId:string
 tokenAddress:string
 settledAt:string
 availableAt:string
 realizedNetPnlLamports:bigint
 independentlyVerified:boolean
 evidenceIds:readonly string[]
 kind:'PAPER'|'ONCHAIN'
}>
export type SniperShadowPurseHandoff=Readonly<{
 version:typeof SNIPER_HANDOFF_VERSION
 handoffId:string
 tokenAddress:string
 tradeId:string
 purseOpportunityId?:string
 shadowDecisionId?:string
 latencyEndToEndMs?:number
 exitDisposition?:SniperExitDecision['action']
 settlementOutcomeId?:string
 shadowReplayReady:boolean
 purseAccountingCandidate:boolean
 deferredReasons:readonly string[]
 evidenceIds:readonly string[]
 availableAt:string
 authority:'RECONCILIATION_EVIDENCE_ONLY'
 canExecute:false
 canCreditPurse:false
 canMutateModel:false
}>
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
/**
 * Bridges canonical Purse opportunity + Shadow decision + exit/settlement
 * references. It is a PURE event projection: persistence, Purse accounting,
 * model training and money authorization still require their own gates.
 * All timestamps are availability-cutoff checked to prevent lookahead.
 */
export function buildSniperShadowPurseHandoff(input:{
 tradeId:string
 tokenAddress:string
 informationCutoff:string
 purse?:PurseOpportunityEnvelope
 shadow?:SharkShadowDecisionTwin
 latency?:SniperLatencyReceipt
 exit?:SniperExitDecision
 settlement?:SniperSettlementEvidence
 evidenceIds:readonly string[]
}):SniperShadowPurseHandoff{
 const {purse,shadow,settlement,exit,latency}=input
 const cutoff=Date.parse(input.informationCutoff)
 if(!input.tradeId.trim()||!input.tokenAddress.trim()||!Number.isFinite(cutoff)||!input.evidenceIds.length){
  throw new Error('SNIPER_HANDOFF_IDENTITY_REQUIRED')
 }
 if(purse){
  if(purse.authority!=='OPPORTUNITY_BUS_ONLY'||purse.canExecute!==false||
    purse.opportunity.sourceKind!=='SHARK'||purse.opportunity.lane!=='MEME'||
    !purse.opportunity.instrumentId.endsWith(':'+input.tokenAddress)||
    Date.parse(purse.ingestedAt)>cutoff)throw new Error('SNIPER_HANDOFF_PURSE_BINDING_INVALID')
 }
 if(shadow){
  if(shadow.authority!=='SHADOW_DECISION_ONLY'||shadow.canExecute!==false||
    shadow.tokenAddress!==input.tokenAddress||Date.parse(shadow.decidedAt)>cutoff||
    Date.parse(shadow.market.availableAt)>cutoff)throw new Error('SNIPER_HANDOFF_SHADOW_BINDING_INVALID')
 }
 if(exit&&(!exit.positionId.trim()||exit.canExecute!==false||exit.canSign!==false||exit.canBroadcast!==false)){
  throw new Error('SNIPER_HANDOFF_EXIT_AUTHORITY_INVALID')
 }
 if(latency&&(latency.tradeId!==input.tradeId||latency.canExecute!==false)){
  throw new Error('SNIPER_HANDOFF_LATENCY_BINDING_INVALID')
 }
 if(settlement){
  if(settlement.tokenAddress!==input.tokenAddress||!settlement.outcomeId.trim()||
    !settlement.evidenceIds.length||!Number.isFinite(Date.parse(settlement.settledAt))||
    !Number.isFinite(Date.parse(settlement.availableAt))||
    Date.parse(settlement.settledAt)>Date.parse(settlement.availableAt)||
    Date.parse(settlement.availableAt)>cutoff){
   throw new Error('SNIPER_HANDOFF_SETTLEMENT_INVALID')
  }
 }
 const deferredReasons:string[]=[]
 if(!purse)deferredReasons.push('PURSE_OPPORTUNITY_MISSING')
 else if(!purse.admitted)deferredReasons.push('PURSE_OPPORTUNITY_REJECTED')
 if(!shadow)deferredReasons.push('SHADOW_DECISION_MISSING')
 if(!settlement)deferredReasons.push('SETTLEMENT_MISSING')
 if(settlement&&!settlement.independentlyVerified)deferredReasons.push('SETTLEMENT_NOT_INDEPENDENTLY_VERIFIED')
 if(settlement?.kind==='PAPER')deferredReasons.push('PAPER_NOT_PURSE_ACCOUNTING')
 const shadowReplayReady=Boolean(shadow&&settlement?.independentlyVerified)
 const purseAccountingCandidate=Boolean(purse?.admitted&&settlement?.kind==='ONCHAIN'&&settlement.independentlyVerified)
 const evidenceIds=Object.freeze([...new Set([
  ...input.evidenceIds,...(purse?.opportunity.evidenceIds??[]),...(shadow?.evidenceIds??[]),
  ...(settlement?.evidenceIds??[]),
 ])].sort())
 return Object.freeze({
  version:SNIPER_HANDOFF_VERSION,
  handoffId:'sniper-handoff:'+hash({tradeId:input.tradeId,tokenAddress:input.tokenAddress,cutoff:input.informationCutoff,
   purseId:purse?.busEventId,shadowId:shadow?.decisionId,settlementId:settlement?.outcomeId,evidenceIds}),
  tradeId:input.tradeId,tokenAddress:input.tokenAddress,
  purseOpportunityId:purse?.opportunity.opportunityId,shadowDecisionId:shadow?.decisionId,
  latencyEndToEndMs:latency?.endToEndMs,exitDisposition:exit?.action,
  settlementOutcomeId:settlement?.outcomeId,shadowReplayReady,purseAccountingCandidate,
  deferredReasons:Object.freeze(deferredReasons),evidenceIds,availableAt:input.informationCutoff,
  authority:'RECONCILIATION_EVIDENCE_ONLY',canExecute:false,canCreditPurse:false,canMutateModel:false,
 })
}
