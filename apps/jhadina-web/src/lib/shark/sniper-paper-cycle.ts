import {assessSniperLiveRisk,type RugProtectionInput,type SniperVerifiedEvidence} from '@jhadina/shark-intelligence-core/meme-trader'
import {fuseSniperIntelligence,type SniperIntelObservation,type SniperIntelFusion,type SniperIndependentOutcomeProof} from './sniper-intel-fusion'
import type {SharkShadowCounterfactualLesson} from '@jhadina/money-core'
import {
 compareSniperLandingRoutes,runSniperPaperRoundTrip,acceptSniperLiveWiringPaper,
 type SniperLandingObservation,type SniperRouteStudyCandidate,
 type SniperPaperLeg,type SniperPaperTradeReceipt,type SniperLiveWiringPaperAcceptance,
 type SniperLatencyReceipt,type SniperExitDecision,
 type PurseOpportunityEnvelope,type SharkShadowDecisionTwin,
 assessSniperFastlane,type SniperFastlaneDecision,type SniperFastlaneInput,
} from '@jhadina/money-core'

export type SniperPaperCycleResult=Readonly<{
  tokenAddress:string
  disposition:'NO_TRADE'|'PAPER_RECORDED'
  intel:SniperIntelFusion
  risk:ReturnType<typeof assessSniperLiveRisk>
  route:ReturnType<typeof compareSniperLandingRoutes>
  urgency?:SniperFastlaneDecision
  paper?:SniperPaperTradeReceipt
  acceptance?:SniperLiveWiringPaperAcceptance
  reasonCodes:readonly string[]
  authority:'SHARK_MONEY_PAPER_ONLY'
  canExecute:false
}>
/** LIVE-WIRING.01–.05 app coordinator: SHARK hard veto -> Money fee/route
 * study -> canonical Money paper fill -> existing Shadow/Purse handoff.
 * Inputs must come from independently reconciled provider evidence;
 * this file neither opens sockets nor contacts wallets.
 */
export function runSniperPaperCycle(input:{
 tokenAddress:string
 tradeId:string
 now:string
 riskEvidence:SniperVerifiedEvidence
 rugInput:RugProtectionInput
 creatorBadLaunchRate?:number
 maxRiskEvidenceAgeMs:number
 landingCandidates:readonly SniperRouteStudyCandidate[]
 landingObservations:readonly SniperLandingObservation[]
 maxQuoteAgeMs:number
 minLandingSamples:number
 notionalLamports:bigint
 minimumNetEdgeBps:number
 maxFixedCostBps:number
 entry:SniperPaperLeg
 exit?:SniperPaperLeg
 exitRouteAttested:boolean
 paperStartingCashMinor:bigint
 paperMarkPriceMinor:bigint
 purse?:PurseOpportunityEnvelope
 shadow?:SharkShadowDecisionTwin
 latency?:SniperLatencyReceipt
 exitDecision?:SniperExitDecision
 evidenceIds:readonly string[]
 /** Snapshot / prior lessons are research-only; they never alter the hard safety gate. */
 intelObservations?:readonly SniperIntelObservation[]
 priorShadowLessons?:readonly SharkShadowCounterfactualLesson[]
 priorLessonProofs?:readonly SniperIndependentOutcomeProof[]
 /** If present, enforce one fast-entry deadline across event, risk, chosen quote and order.
  * The corroborated quote ID MUST match Money's chosen route; no quote inference. */
 fastlane?:Omit<SniperFastlaneInput,'now'|'riskEvidenceAvailableAt'|'entryOrderExpiresAt'> & {
  selectedQuoteEvidenceId:string
 }
}):SniperPaperCycleResult{
 const risk=assessSniperLiveRisk({
  evidence:input.riskEvidence,rug:input.rugInput,now:input.now,
  maxEvidenceAgeMs:input.maxRiskEvidenceAgeMs,
  creatorBadLaunchRate:input.creatorBadLaunchRate,
 })
 if(risk.tokenAddress!==input.tokenAddress||!input.tradeId.trim()||!input.evidenceIds.length){
  throw new Error('SNIPER_PAPER_CYCLE_IDENTITY_INVALID')
 }
 const intelFor=(paper?:SniperPaperTradeReceipt)=>fuseSniperIntelligence({
  decisionId:input.tradeId,tokenAddress:input.tokenAddress,chainId:'solana-mainnet',
  cutoff:input.now,risk,observations:input.intelObservations,
  priorShadowLessons:input.priorShadowLessons,priorLessonProofs:input.priorLessonProofs,paper,
 })
 const route=compareSniperLandingRoutes({
  candidates:input.landingCandidates,observations:input.landingObservations,cutoff:input.now,
  maxQuoteAgeMs:input.maxQuoteAgeMs,notionalLamports:input.notionalLamports,
  minimumNetEdgeBps:input.minimumNetEdgeBps,maxFixedCostBps:input.maxFixedCostBps,
  minLandingSamples:input.minLandingSamples,
 })
 const selectedQuote=input.landingCandidates.find(x=>x.lane===route.selectedForPaper)
 const urgency=input.fastlane?assessSniperFastlane({
  ...input.fastlane,now:input.now,riskEvidenceAvailableAt:input.riskEvidence.availableAt,
  selectedQuoteAvailableAt:selectedQuote?.evidenceId===input.fastlane.selectedQuoteEvidenceId
   ?input.fastlane.selectedQuoteAvailableAt:undefined,
  entryOrderExpiresAt:input.entry.order.expiresAt,
 }):undefined
 const reasons:string[]=[]
 if(urgency&&urgency.disposition!=='ENTRY_WINDOW_OPEN'){
  reasons.push('FAST_ENTRY_NOT_ADMITTED',...urgency.reasonCodes)
 }
 if(risk.disposition!=='PAPER_CANDIDATE')reasons.push('SHARK_SAFETY_VETO',...risk.reasonCodes)
 if(!route.selectedForPaper)reasons.push('NO_ADMISSIBLE_PAPER_LANDING_ROUTE')
 if(reasons.length){
  return Object.freeze({
   tokenAddress:input.tokenAddress,disposition:'NO_TRADE',
   risk,intel:intelFor(),route,urgency,reasonCodes:Object.freeze([...new Set(reasons)]),
   authority:'SHARK_MONEY_PAPER_ONLY',canExecute:false,
  })
 }
 const paper=runSniperPaperRoundTrip({
  tokenAddress:input.tokenAddress,entry:input.entry,exit:input.exit,
  exitRouteAttested:input.exitRouteAttested,
  startingCashMinor:input.paperStartingCashMinor,
  markPriceMinor:input.paperMarkPriceMinor,asOf:input.now,
 })
 const acceptance=acceptSniperLiveWiringPaper({
  tradeId:input.tradeId,tokenAddress:input.tokenAddress,informationCutoff:input.now,
  risk,routing:route,paper,purse:input.purse,shadow:input.shadow,latency:input.latency,
  exit:input.exitDecision,evidenceIds:input.evidenceIds,
 })
 return Object.freeze({
  tokenAddress:input.tokenAddress,disposition:'PAPER_RECORDED',risk,intel:intelFor(paper),route,urgency,paper,acceptance,
  reasonCodes:Object.freeze([...acceptance.reasonCodes]),
  authority:'SHARK_MONEY_PAPER_ONLY',canExecute:false,
 })
}
