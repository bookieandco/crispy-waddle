import type {PublicFilterCanary} from './shark-filter-live-public'
import type {LiveFilterPriceMark} from './shark-filter-live-paper'
import type {LiveFilterPaperReview} from './shark-filter-live-route-review'
import {evaluateSharkFilterReviewGate,type SharkFilterAcceptanceEvidence}
  from './shark-filter-release-gate'

export type LiveFilterAcceptance=Readonly<{
  status:'SOURCE_READY_EXTERNAL_BLOCKERS'|'INCOMPLETE_SOURCE_ACCEPTANCE'
  canaryCount:number
  priceOnlyMarks:number
  censoredOrOpen:number
  indicativeRoundTrips:number
  certifiedMoneyPaperFills:0
  realOrders:0
  blockers:readonly string[]
  releaseReview:ReturnType<typeof evaluateSharkFilterReviewGate>
  authority:'SOURCE_AND_PUBLIC_RESEARCH_ONLY'
  canDeploy:false
  canTrade:false
  canSpend:false
}>
/**
 * A public market quote is NOT a signed proof of provider authenticity,
 * launchpad stage, fee semantics, 24h winner, or Money trade permission.
 * The release review remains controlled by externally evidenced approvals.
 */
export function assessLiveFilterAcceptance(input:{
  canaries:readonly PublicFilterCanary[]
  marks:readonly LiveFilterPriceMark[]
  shadowReviews:readonly LiveFilterPaperReview[]
  external:SharkFilterAcceptanceEvidence
}):LiveFilterAcceptance{
  const blockers:string[]=[]
  if(input.canaries.length===0)blockers.push('no-public-market-canary-evidence')
  for(const canary of input.canaries){
    if(canary.canSign!==false||canary.canBroadcast!==false||canary.prospectivePaperEntry!==false)
      throw new Error('shark_live_canary_authority_escalation')
  }
  for(const mark of input.marks){
    if(mark.moneyCorePaperFill!==false||mark.realTrade!==false||mark.sellableReturnProven!==false)
      throw new Error('shark_live_mark_authority_escalation')
  }
  for(const route of input.shadowReviews){
    if(route.moneyCorePaperFill!==false||route.realFill!==false||route.signerPermitted!==false)
      throw new Error('shark_live_route_authority_escalation')
  }
  const observed=input.canaries.filter(c=>c.status==='SCREENED_RESEARCH_ONLY').length
  const priceOnly=input.marks.filter(x=>x.status==='PRICE_ONLY_UNVERIFIED').length
  const indicative=input.shadowReviews.filter(x=>x.status==='READ_ONLY_SHADOW_ESTIMATE').length
  if(!observed)blockers.push('no-canonical-stage-screened-observations')
  if(!priceOnly)blockers.push('no-mature-prospective-original-pair-price-marks')
  if(!indicative)blockers.push('no-independent-two-sided-shadow-quotes')
  // Source-only canary code cannot make these credentials true. Flagged
  // external booleans are subject to separate independent human evidence review.
  const releaseReview=evaluateSharkFilterReviewGate(input.external)
  blockers.push(...releaseReview.blockers)
  return Object.freeze({
    status:blockers.length?'INCOMPLETE_SOURCE_ACCEPTANCE':'SOURCE_READY_EXTERNAL_BLOCKERS',
    canaryCount:input.canaries.length,priceOnlyMarks:priceOnly,
    censoredOrOpen:input.marks.length-priceOnly,indicativeRoundTrips:indicative,
    certifiedMoneyPaperFills:0,realOrders:0,blockers:Object.freeze([...new Set(blockers)].sort()),
    releaseReview,authority:'SOURCE_AND_PUBLIC_RESEARCH_ONLY',
    canDeploy:false,canTrade:false,canSpend:false,
  })
}
