/**
 * SHARK-COMMISSION.27–.32 — receipt-based, read-only launch acceptance.
 * This is a pure audit of *caller-supplied* observations, never a market feed,
 * subscription, wallet, deployment, Telegram read, or trading authority.
 */
import {auditAlphaMissedWinners,type AlphaCohortLaunch,type AlphaCohortSelection,
  type AlphaCohortOutcome} from './alpha-missed-winners'
import {evaluateOperationalDiscovery,reviewOperationalRisk,
  evaluateOperationalSpeed,evaluateOperationalAcceptance,
  type SourceObservationReceipt,type OperationalRiskReceipt}
  from './shark-operational-21-26'
import type {LatencyMeasurement} from './shark-filter-execution-research'
import type {LiveFilterPaperReview} from './shark-filter-live-route-review'
import type {LiveFilterPriceMark} from './shark-filter-live-paper'
import type {PublicFilterCanary} from './shark-filter-live-public'

export type CommissionPair=Readonly<{
 mint:string
 pairAddress:string
 observationReceipt:SourceObservationReceipt
 riskReceipt?:OperationalRiskReceipt
 firstSeenAt:string
 receiptId:string
}>
export type CommissionCohort=Readonly<{
 discovered:number
 checked:number
 missingRiskCoverage:number
 pollOnly:number
 realStreamObservations:number
 canClaimWholeChainCoverage:false
 canExecute:false
}>
const time=(x:string)=>{
 const t=Date.parse(x)
 if(!x.trim()||!Number.isFinite(t))throw new Error('shark_commission_invalid_timestamp')
 return t
}
/** .29–.30: provenance and original-pair stability before risk scoring. */
export function auditCommissionObservations(pairs:readonly CommissionPair[]):CommissionCohort{
 const seen=new Set<string>()
 let missing=0,poll=0,stream=0
 for(const p of pairs){
   if(!p.mint.trim()||!p.pairAddress.trim()||!p.receiptId.trim()||
      seen.has(p.mint+':'+p.pairAddress))throw new Error('shark_commission_pair_identity_invalid')
   seen.add(p.mint+':'+p.pairAddress)
   if(p.observationReceipt.mint!==p.mint||
      p.observationReceipt.pairAddress!==p.pairAddress)
     throw new Error('shark_commission_cross_asset_evidence')
   const discovery=evaluateOperationalDiscovery(p.observationReceipt)
   if(discovery.eventToIngestMs===undefined)poll++
   else stream++
   const seenAt=time(p.firstSeenAt)
   if(seenAt<time(p.observationReceipt.locallyIngestedAt))
     throw new Error('shark_commission_lookahead')
   if(!p.riskReceipt){missing++;continue}
   if(p.riskReceipt.mint!==p.mint||time(p.riskReceipt.availableAt)>seenAt)
     throw new Error('shark_commission_future_risk_evidence')
   if(reviewOperationalRisk(p.riskReceipt).status!=='REVIEW_ONLY')missing++
 }
 return Object.freeze({discovered:pairs.length,checked:pairs.length-missing,
   missingRiskCoverage:missing,pollOnly:poll,realStreamObservations:stream,
   canClaimWholeChainCoverage:false,canExecute:false})
}
export type CommissionPaperReview=Readonly<{
 observedLaunches:number
 prospectiveLaunches:number
 missedMarked2x:number
 missingOrCensored:number
 indicativeShadowReviews:number
 priceOnlyFollowups:number
 verifiedMoneyFills:0
 estimatedExecutableReturn:false
 noLiveOrders:true
}>
/** .31: consumes selectively recovered Alpha Fabric, original SHARK & Money boundaries. */
export function auditCommissionPaper(input:{
 launches:readonly AlphaCohortLaunch[]
 selections:readonly AlphaCohortSelection[]
 outcomes:readonly AlphaCohortOutcome[]
 asOf:string
 canaries:readonly PublicFilterCanary[]
 marks:readonly LiveFilterPriceMark[]
 routes:readonly LiveFilterPaperReview[]
}):CommissionPaperReview{
 const alpha=auditAlphaMissedWinners({launches:input.launches,
   selections:input.selections,outcomes:input.outcomes,asOf:input.asOf})
 for(const c of input.canaries)if(c.canSign!==false||c.canBroadcast!==false)
   throw new Error('shark_commission_canary_authority_invalid')
 for(const m of input.marks)if(m.moneyCorePaperFill!==false||m.realTrade!==false)
   throw new Error('shark_commission_paper_authority_invalid')
 for(const r of input.routes)if(r.realFill!==false||r.signerPermitted!==false)
   throw new Error('shark_commission_route_authority_invalid')
 return Object.freeze({observedLaunches:alpha.observedLaunches,
   prospectiveLaunches:alpha.eligibleProspectiveLaunches,
   missedMarked2x:alpha.missedMarkedUp2xCount,
   missingOrCensored:alpha.missingOrCensored,
   indicativeShadowReviews:input.routes.filter(r=>r.status==='READ_ONLY_SHADOW_ESTIMATE').length,
   priceOnlyFollowups:input.marks.filter(m=>m.status==='PRICE_ONLY_UNVERIFIED').length,
   verifiedMoneyFills:0,estimatedExecutableReturn:false,noLiveOrders:true})
}
export type CommissionAcceptance=Readonly<{
 status:'NOT_COMMISSIONED'|'OWNER_REVIEW_REQUIRED'
 blockers:readonly string[]
 screeningP95Ms?:number
 screeningP99Ms?:number
 observedMints:number
 noDeployment:true
 noSpend:true
 noSign:true
 noLiveTrading:true
}>
/** .27/.32: never turn a green CI badge or public API request into certification. */
export function evaluateCommissionAcceptance(input:{
 exactHeadCiPassed:boolean
 mergeReconciled:boolean
 sourceReadOnlyHostCommissioned:boolean
 phoneReadbackVerified:boolean
 providerFeeDefinitionsVerified:boolean
 independentlyProvenSellability:boolean
 realProspectiveCasesVerified:boolean
 moneyCoreReviewCompleted:boolean
 pairs:readonly CommissionPair[]
 traces:readonly LatencyMeasurement[]
}):CommissionAcceptance{
 const cohort=auditCommissionObservations(input.pairs)
 const speed=evaluateOperationalSpeed(input.traces)
 const readiness=evaluateOperationalAcceptance({
  exactHeadCiPassed:input.exactHeadCiPassed,reconciledPRs:input.mergeReconciled,
  verifiedTerminalFees:input.providerFeeDefinitionsVerified,
  independentlyVerifiedSellability:input.independentlyProvenSellability,
  prospectiveHoldoutLabeled:input.realProspectiveCasesVerified,
  moneyCoreIndependentReview:input.moneyCoreReviewCompleted,
  phoneReadbackVerified:input.phoneReadbackVerified,
 })
 const blockers=[...readiness.blockers]
 if(!input.sourceReadOnlyHostCommissioned)blockers.push('persistent-read-only-host-not-commissioned')
 if(cohort.discovered===0)blockers.push('no-real-prospective-coin-observations')
 if(cohort.missingRiskCoverage>0)blockers.push('incomplete-independent-risk-coverage')
 if(cohort.realStreamObservations===0)blockers.push('real-event-stream-not-measured')
 return Object.freeze({status:blockers.length?'NOT_COMMISSIONED':'OWNER_REVIEW_REQUIRED',
   blockers:Object.freeze([...new Set(blockers)].sort()),
   screeningP95Ms:speed.sourceToScreenP95Ms,screeningP99Ms:speed.sourceToScreenP99Ms,
   observedMints:cohort.discovered,noDeployment:true,noSpend:true,noSign:true,noLiveTrading:true})
}
