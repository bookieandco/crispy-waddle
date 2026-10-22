import {buildSniperShadowPurseHandoff,type SniperShadowPurseHandoff} from './sniper-shadow-purse-handoff.js'
import type {SharkShadowDecisionTwin} from './shark-shadow-learning.js'
import type {PurseOpportunityEnvelope} from './purse-opportunity-bus.js'
import type {SniperLatencyReceipt} from './sniper-latency-telemetry.js'
import type {SniperExitDecision} from './sniper-exit-sentinel.js'
import type {SniperLandingComparison} from './sniper-landing-route-study.js'
import type {SniperPaperTradeReceipt} from './sniper-paper-soak.js'

export type SniperLiveWiringPaperAcceptance=Readonly<{
 version:'SHARK-SNIPER.LIVE-WIRING.05'
 status:'PAPER_CLOSED_ACCEPTED'|'PAPER_INCOMPLETE'|'BLOCKED'
 reasonCodes:readonly string[]
 tradeId:string
 netPaperPnlMinor?:bigint
 handoff:SniperShadowPurseHandoff
 selectedPaperRoute?:string
 authority:'PAPER_ACCEPTANCE_ONLY'
 canAuthorizeLive:false
 canCreditPurse:false
 canExecute:false
}>
/**
 * The existing Money / Shadow Learn / Purse contracts are the only owners of
 * financial accounting and model memory. This projector never writes either,
 * and it never treats a simulated settlement as an on-chain money movement.
 * Consumers can journal this forward-only artifact in an authorized runtime.
 */
export function acceptSniperLiveWiringPaper(input:{
 tradeId:string
 tokenAddress:string
 informationCutoff:string
 risk:Readonly<{tokenAddress:string;disposition:'BLOCK'|'REVIEW'|'PAPER_CANDIDATE';authority:'RISK_RESEARCH_ONLY';canExecute:false;reasonCodes:readonly string[]}>
 routing:SniperLandingComparison
 paper:SniperPaperTradeReceipt
 purse?:PurseOpportunityEnvelope
 shadow?:SharkShadowDecisionTwin
 latency?:SniperLatencyReceipt
 exit?:SniperExitDecision
 evidenceIds:readonly string[]
}):SniperLiveWiringPaperAcceptance{
 if(!input.tradeId.trim()||input.tokenAddress!==input.risk.tokenAddress||
    input.paper.tokenAddress!==input.tokenAddress||input.risk.authority!=='RISK_RESEARCH_ONLY'||
    input.risk.canExecute!==false||input.routing.canSubmit!==false||
    input.routing.canExecute!==false||input.paper.canExecute!==false||
    !input.evidenceIds.length){
  throw new Error('SNIPER_ACCEPTANCE_BINDING_OR_AUTHORITY_INVALID')
 }
 const reasonCodes:string[]=[]
 if(input.risk.disposition!=='PAPER_CANDIDATE')reasonCodes.push('SHARK_RISK_NOT_PAPER_ADMISSIBLE')
 if(!input.routing.selectedForPaper)reasonCodes.push('LANDING_ROUTE_NOT_CALIBRATED')
 if(input.paper.status!=='CLOSED')reasonCodes.push('PAPER_POSITION_NOT_CLOSED')
 if(!input.paper.settlement||input.paper.settlement.kind!=='PAPER')reasonCodes.push('SIMULATED_SETTLEMENT_REQUIRED')
 const handoff=buildSniperShadowPurseHandoff({
  tradeId:input.tradeId,tokenAddress:input.tokenAddress,
  informationCutoff:input.informationCutoff,purse:input.purse,shadow:input.shadow,
  latency:input.latency,exit:input.exit,settlement:input.paper.settlement,
  evidenceIds:[...input.evidenceIds,...input.paper.evidenceIds],
 })
 // A PAPER result may be accepted for testing while the Purse remains untouched
 // and Shadow learning requires separately verified outcome evidence.
 const status:SniperLiveWiringPaperAcceptance['status']=reasonCodes.includes('SHARK_RISK_NOT_PAPER_ADMISSIBLE')
  ?'BLOCKED':reasonCodes.length?'PAPER_INCOMPLETE':'PAPER_CLOSED_ACCEPTED'
 return Object.freeze({
  version:'SHARK-SNIPER.LIVE-WIRING.05',status,
  reasonCodes:Object.freeze(reasonCodes),tradeId:input.tradeId,
  netPaperPnlMinor:input.paper.realizedNetPnlMinor,
  handoff,selectedPaperRoute:input.routing.selectedForPaper,
  authority:'PAPER_ACCEPTANCE_ONLY',canAuthorizeLive:false,canCreditPurse:false,canExecute:false,
 })
}
