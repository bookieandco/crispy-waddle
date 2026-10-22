import type {PublicFilterCanary} from './shark-filter-live-public'
import type {LiveFilterPriceMark} from './shark-filter-live-paper'
import type {LiveFilterPaperReview} from './shark-filter-live-route-review'
import type {LatencyMeasurement} from './shark-filter-execution-research'
import {auditSharkLatency,finalizeSharkFilterAcceptance,auditSharkReadOnlyHost,
  type ReadOnlyHostReceipt} from './shark-filter-acceptance-15-20'

/**
 * SHARK-OPERATIONAL.21-.26. Pure orchestration of EXISTING research contracts.
 * An uncommissioned external host cannot be inferred from source-level tests.
 */
export type OperationalPR=Readonly<{
  number:number
  ahead:number
  behind:number
  changedPaths:readonly string[]
  headSha:string
  scope:'FILTER'|'BOTS_PAPER'|'CLOSE_PAPER'|'CLOUDFLARE'|'ALPHA'
}>
export type OperationalReconciliation=Readonly<{
  sourceFilesCompatible:boolean
  safeToMergeMain:boolean
  pendingPRs:readonly number[]
  collisions:readonly string[]
  authority:'REVIEW_ONLY'
}>
/** .21: don't wholesale-merge stale drafts or the stacked alpha branch. */
export function reconcileOperationalPRs(input:{
  mainChangedPaths:readonly string[]
  prs:readonly OperationalPR[]
}):OperationalReconciliation{
  const canonical=new Set(input.mainChangedPaths)
  const seen=new Set<number>()
  const collisions=new Set<string>()
  const pending:number[]=[]
  for(const pr of input.prs){
    if(seen.has(pr.number)||!pr.headSha.trim()||pr.ahead<0||pr.behind<0||
      !Number.isInteger(pr.ahead)||!Number.isInteger(pr.behind))
      throw new Error('SHARK_OPERATIONAL_PR_EVIDENCE_INVALID')
    seen.add(pr.number)
    if(pr.behind>0||pr.scope==='ALPHA')pending.push(pr.number)
    for(const path of pr.changedPaths){
      if(canonical.has(path))collisions.add(path)
    }
  }
  return Object.freeze({
    sourceFilesCompatible:collisions.size===0,safeToMergeMain:false,
    pendingPRs:Object.freeze(pending.sort((a,b)=>a-b)),
    collisions:Object.freeze([...collisions].sort()),authority:'REVIEW_ONLY',
  })
}
export type SourceObservationReceipt=Readonly<{
  source:'PUBLIC_POLL'|'SOLANA_EVENT_STREAM'
  mint:string
  pairAddress:string
  eventAt?:string
  providerAvailableAt:string
  locallyIngestedAt:string
  sourceEvidenceId:string
  protocolVerified:boolean
  chainEvidenceIndependentlyVerified:boolean
}>
export type DiscoveryOperationalEvidence=Readonly<{
  status:'SOURCE_ONLY'|'CANARY_OBSERVED_UNATTESTED'|'INCOMPLETE'
  eventToIngestMs?:number
  missing:readonly string[]
  authority:'PUBLIC_RESEARCH_ONLY'
  canTrade:false
}>
const time=(s:string):number=>{
  const t=Date.parse(s)
  if(!s.trim()||!Number.isFinite(t))throw new Error('SHARK_OPERATIONAL_TIME_INVALID')
  return t
}
/** .22: event visibility is UNKNOWN for public polling; never fabricate latency. */
export function evaluateOperationalDiscovery(r?:SourceObservationReceipt):DiscoveryOperationalEvidence{
  if(!r)return Object.freeze({status:'INCOMPLETE',missing:Object.freeze(['provider-receipt-missing']),
    authority:'PUBLIC_RESEARCH_ONLY',canTrade:false})
  if(!r.mint.trim()||!r.pairAddress.trim()||!r.sourceEvidenceId.trim())
    throw new Error('SHARK_OPERATIONAL_SOURCE_IDENTITY_INVALID')
  const available=time(r.providerAvailableAt),ingested=time(r.locallyIngestedAt)
  if(ingested<available)throw new Error('SHARK_OPERATIONAL_FUTURE_EVIDENCE')
  const missing:string[]=[]
  if(!r.protocolVerified)missing.push('launch-protocol-unverified')
  if(!r.chainEvidenceIndependentlyVerified)missing.push('chain-evidence-unverified')
  if(r.source==='PUBLIC_POLL')missing.push('event-time-unavailable-in-public-poll')
  const event=r.eventAt?time(r.eventAt):undefined
  if(event!==undefined&&event>available)throw new Error('SHARK_OPERATIONAL_EVENT_ORDER_INVALID')
  if(r.source==='SOLANA_EVENT_STREAM'&&event===undefined)missing.push('event-time-missing')
  const supportedEvent=r.source==='SOLANA_EVENT_STREAM'&&event!==undefined
  return Object.freeze({
    status:missing.length?'SOURCE_ONLY':'CANARY_OBSERVED_UNATTESTED',
    eventToIngestMs:supportedEvent?ingested-event:undefined,
    missing:Object.freeze(missing),authority:'PUBLIC_RESEARCH_ONLY',canTrade:false,
  })
}
export type OperationalRiskReceipt=Readonly<{
  mint:string
  labels:readonly string[]
  evidenceIds:readonly string[]
  independentSources:readonly string[]
  sellabilityReviewed:boolean
  tokenControlReviewed:boolean
  liquidityReviewed:boolean
  actorClustersReviewed:boolean
  observedAt:string
  availableAt:string
}>
export type OperationalRiskReview=Readonly<{
  status:'REVIEW_ONLY'|'INSUFFICIENT_COVERAGE'
  unknownChecks:readonly string[]
  labels:readonly string[]
  canDeclareSafe:false
  canTrade:false
}>
/** .23: mechanism evidence never implies safety, nor does it bypass SHARK. */
export function reviewOperationalRisk(r?:OperationalRiskReceipt):OperationalRiskReview{
  if(!r)return Object.freeze({status:'INSUFFICIENT_COVERAGE',
    unknownChecks:Object.freeze(['all-independent-risk-checks-missing']),
    labels:Object.freeze([]),canDeclareSafe:false,canTrade:false})
  if(!r.mint.trim()||r.evidenceIds.length===0||r.evidenceIds.some(x=>!x.trim())||
     time(r.availableAt)<time(r.observedAt))
    throw new Error('SHARK_OPERATIONAL_RISK_PROVENANCE_INVALID')
  const missing:string[]=[]
  if(!r.sellabilityReviewed)missing.push('sellability')
  if(!r.tokenControlReviewed)missing.push('token-controls')
  if(!r.liquidityReviewed)missing.push('liquidity')
  if(!r.actorClustersReviewed)missing.push('actor-clusters')
  if(new Set(r.independentSources.filter(Boolean)).size<2)missing.push('independent-source-coverage')
  return Object.freeze({status:missing.length?'INSUFFICIENT_COVERAGE':'REVIEW_ONLY',
    unknownChecks:Object.freeze(missing),labels:Object.freeze([...new Set(r.labels)].sort()),
    canDeclareSafe:false,canTrade:false})
}
export type OperationalPaperAudit=Readonly<{
  decisions:number
  censored:number
  priceOnly:number
  indicativeShadow:number
  netExecutedPnlVerified:false
  fillClaimAllowed:false
}>
/** .24: preserve unscored outcomes and no-fill; delegated fill authority = Money. */
export function auditOperationalPaper(input:{
  canaries:readonly PublicFilterCanary[]
  marks:readonly LiveFilterPriceMark[]
  routes:readonly LiveFilterPaperReview[]
}):OperationalPaperAudit{
  for(const c of input.canaries)if(c.canBroadcast!==false||c.canSign!==false)
    throw new Error('SHARK_OPERATIONAL_CANARY_AUTHORITY_INVALID')
  for(const x of input.marks)if(x.realTrade!==false||x.moneyCorePaperFill!==false)
    throw new Error('SHARK_OPERATIONAL_PAPER_AUTHORITY_INVALID')
  for(const x of input.routes)if(x.signerPermitted!==false||x.realFill!==false)
    throw new Error('SHARK_OPERATIONAL_ROUTE_AUTHORITY_INVALID')
  return Object.freeze({
    decisions:input.canaries.length,
    censored:input.marks.filter(x=>x.status!=='PRICE_ONLY_UNVERIFIED').length,
    priceOnly:input.marks.filter(x=>x.status==='PRICE_ONLY_UNVERIFIED').length,
    indicativeShadow:input.routes.filter(x=>x.status==='READ_ONLY_SHADOW_ESTIMATE').length,
    netExecutedPnlVerified:false,fillClaimAllowed:false,
  })
}
export type OperationalSpeed=Readonly<{
  sourceToScreenP95Ms?:number
  sourceToScreenP99Ms?:number
  actualCompleteFillCount:number
  canClaimSubsecondExecution:false
  simulatedOptimizationAllowed:true
}>
/** .25: a reported 616ms lookup never becomes 616ms entry/exit. */
export function evaluateOperationalSpeed(rows:readonly LatencyMeasurement[]):OperationalSpeed{
  const report=auditSharkLatency(rows)
  return Object.freeze({sourceToScreenP95Ms:report.eventToScreenP95Ms,
    sourceToScreenP99Ms:report.eventToScreenP99Ms,
    actualCompleteFillCount:report.certifiedEndToEndCount,
    canClaimSubsecondExecution:false,simulatedOptimizationAllowed:true})
}
export type OperationalGate=Readonly<{
  status:'BLOCKED_PENDING_REAL_ACCEPTANCE'|'READY_FOR_OWNER_REVIEW'
  blockers:readonly string[]
  deploy:false
  spend:false
  trade:false
  sign:false
}>
/** .26: no host deployment, release or capital authorization on this path. */
export function evaluateOperationalAcceptance(input:{
  exactHeadCiPassed:boolean
  reconciledPRs:boolean
  host?:ReadOnlyHostReceipt
  verifiedTerminalFees:boolean
  independentlyVerifiedSellability:boolean
  prospectiveHoldoutLabeled:boolean
  moneyCoreIndependentReview:boolean
  phoneReadbackVerified:boolean
}):OperationalGate{
  const host=auditSharkReadOnlyHost(input.host)
  const final=finalizeSharkFilterAcceptance({
    exactHeadCiPassed:input.exactHeadCiPassed,
    branchesReconciled:input.reconciledPRs,
    readOnlyHost:host,independentlyVerifiedFees:input.verifiedTerminalFees,
    independentSellability:input.independentlyVerifiedSellability,
    prospectiveHoldoutLabeled:input.prospectiveHoldoutLabeled,
    independentMoneyCoreReview:input.moneyCoreIndependentReview,
  })
  const blockers=[...final.missing]
  if(!input.phoneReadbackVerified)blockers.push('private-phone-readback-unverified')
  return Object.freeze({
    status:blockers.length?'BLOCKED_PENDING_REAL_ACCEPTANCE':'READY_FOR_OWNER_REVIEW',
    blockers:Object.freeze([...new Set(blockers)].sort()),
    deploy:false,spend:false,trade:false,sign:false,
  })
}
