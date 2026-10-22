import {assessSniperLiveRisk,type RugProtectionInput,type SniperVerifiedEvidence} from '@jhadina/shark-intelligence-core/meme-trader'
import {
 compareSniperLandingRoutes,runSniperPaperRoundTrip,acceptSniperLiveWiringPaper,
 type SniperLandingObservation,type SniperRouteStudyCandidate,
 type SniperPaperLeg,type SniperPaperTradeReceipt,type SniperLiveWiringPaperAcceptance,
 type SniperLatencyReceipt,type SniperExitDecision,
 type PurseOpportunityEnvelope,type SharkShadowDecisionTwin,
} from '@jhadina/money-core'

export type SniperPaperCycleResult=Readonly<{
  tokenAddress:string
  disposition:'NO_TRADE'|'PAPER_RECORDED'
  risk:ReturnType<typeof assessSniperLiveRisk>
  route:ReturnType<typeof compareSniperLandingRoutes>
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
}):SniperPaperCycleResult{
 const risk=assessSniperLiveRisk({
  evidence:input.riskEvidence,rug:input.rugInput,now:input.now,
  maxEvidenceAgeMs:input.maxRiskEvidenceAgeMs,
  creatorBadLaunchRate:input.creatorBadLaunchRate,
 })
 if(risk.tokenAddress!==input.tokenAddress||!input.tradeId.trim()||!input.evidenceIds.length){
  throw new Error('SNIPER_PAPER_CYCLE_IDENTITY_INVALID')
 }
 const route=compareSniperLandingRoutes({
  candidates:input.landingCandidates,observations:input.landingObservations,cutoff:input.now,
  maxQuoteAgeMs:input.maxQuoteAgeMs,notionalLamports:input.notionalLamports,
  minimumNetEdgeBps:input.minimumNetEdgeBps,maxFixedCostBps:input.maxFixedCostBps,
  minLandingSamples:input.minLandingSamples,
 })
 const reasons:string[]=[]
 if(risk.disposition!=='PAPER_CANDIDATE')reasons.push('SHARK_SAFETY_VETO',...risk.reasonCodes)
 if(!route.selectedForPaper)reasons.push('NO_ADMISSIBLE_PAPER_LANDING_ROUTE')
 if(reasons.length){
  return Object.freeze({
   tokenAddress:input.tokenAddress,disposition:'NO_TRADE',
   risk,route,reasonCodes:Object.freeze([...new Set(reasons)]),
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
  tokenAddress:input.tokenAddress,disposition:'PAPER_RECORDED',risk,route,paper,acceptance,
  reasonCodes:Object.freeze([...acceptance.reasonCodes]),
  authority:'SHARK_MONEY_PAPER_ONLY',canExecute:false,
 })
}
