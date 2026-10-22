/**
 * SHARK-FILTER.ACCEPT.15-.20 — deterministic, source-only acceptance controls.
 *
 * There is deliberately no network, persistence, host provisioning, signer,
 * balance, purchase or live order path. A pure certification boundary cannot
 * create independent market proof or self-promote a paper strategy.
 */
import type {PublicFilterCanary} from './shark-filter-live-public'
import type {LiveFilterPriceMark} from './shark-filter-live-paper'
import type {LiveFilterPaperReview} from './shark-filter-live-route-review'
import type {LatencyMeasurement} from './shark-filter-execution-research'

export const SHARK_ACCEPTANCE_SEQUENCE='SHARK-FILTER.ACCEPT.15-20' as const
export type ExternalReadiness='NOT_COMMISSIONED'|'READ_ONLY_ATTESTED'
export type BranchReconciliation=Readonly<{
  pr:number
  branch:string
  baseSha:string
  headSha:string
  ahead:number
  behind:number
  overlappingPaths:readonly string[]
  admission:'PRESERVE_PENDING_REBASE'|'REVIEW_CLEAN_INTEGRATION'
}>
/** .15: fail-closed PR reconciliation. A mergeable API flag is not a conflict audit. */
export function reconcileSharkFilterBranches(input:{
  canonicalChangedPaths:readonly string[]
  branches:readonly Omit<BranchReconciliation,'overlappingPaths'|'admission'>[]
}):readonly BranchReconciliation[]{
  const canonical=new Set(input.canonicalChangedPaths)
  if(canonical.size!==input.canonicalChangedPaths.length)throw new Error('shark_accept_duplicate_canonical_path')
  return Object.freeze(input.branches.map(b=>{
    if(!b.branch.trim()||!b.baseSha.trim()||!b.headSha.trim()||
       !Number.isInteger(b.ahead)||b.ahead<0||!Number.isInteger(b.behind)||b.behind<0)
      throw new Error('shark_accept_invalid_branch_evidence')
    const overlap=Object.freeze([...new Set(b.overlappingPaths)].filter(p=>canonical.has(p)).sort())
    return Object.freeze({...b,overlappingPaths:overlap,
      admission:b.behind>0||overlap.length>0?'PRESERVE_PENDING_REBASE' as const:'REVIEW_CLEAN_INTEGRATION' as const})
  }))
}

export type ReadOnlyHostReceipt=Readonly<{
  hostId:string
  identity:'OWNER_APPROVED_HOST'
  mode:'PUBLIC_READ_ONLY'
  availableAt:string
  ingestedAt:string
  providerReceiptId:string
  persistentLedgerVerified:boolean
  encryptedOffHostRestoreVerified:boolean
  alertsOnDeviceVerified:boolean
  commissioned:boolean
}>
export type HostAcceptance=Readonly<{
  disposition:'READ_ONLY_HOST_READY'|'UNCOMMISSIONED'
  blockers:readonly string[]
  canDeploy:false
  canTrade:false
}>
/** .16: host evidence can describe existing commissioning, never perform it. */
export function auditSharkReadOnlyHost(r?:ReadOnlyHostReceipt):HostAcceptance{
  const b:string[]=[]
  if(!r||!r.commissioned||r.identity!=='OWNER_APPROVED_HOST'||r.mode!=='PUBLIC_READ_ONLY')
    b.push('owner-approved-host-uncommissioned')
  if(!r?.hostId.trim()||!r?.providerReceiptId.trim())b.push('host-or-provider-receipt-missing')
  const a=r?Date.parse(r.availableAt):NaN,ing=r?Date.parse(r.ingestedAt):NaN
  if(!Number.isFinite(a)||!Number.isFinite(ing)||ing<a)b.push('source-latency-chronology-invalid')
  if(!r?.persistentLedgerVerified)b.push('persistent-ledger-not-verified')
  if(!r?.encryptedOffHostRestoreVerified)b.push('offhost-restore-not-verified')
  if(!r?.alertsOnDeviceVerified)b.push('private-device-readback-not-verified')
  return Object.freeze({disposition:b.length?'UNCOMMISSIONED':'READ_ONLY_HOST_READY',
    blockers:Object.freeze(b),canDeploy:false,canTrade:false})
}

export type RugMechanism='LIQUIDITY_REMOVAL'|'MINT_SUPPLY_CONTROL'|'FREEZE_OR_TRANSFER_RESTRICTION'|'COORDINATED_WALLET_DISTRIBUTION'|'UNKNOWN'
export type MechanismEvidence=Readonly<{
  mint:string
  mechanism:RugMechanism
  confirmations:readonly string[]
  independentSourceGroups:readonly string[]
  observedAt:string
  availableAt:string
}>
export type MechanismReview=Readonly<{
  mechanism:RugMechanism
  status:'MECHANISM_EVIDENCED'|'INSUFFICIENT_INDEPENDENT_EVIDENCE'
  authority:'DEFENSIVE_RESEARCH_ONLY'
  canLabelConfirmedRug:false
}>
/** .17: classify *mechanisms* without pretending certainty about intent. */
export function assessRugMechanism(m:MechanismEvidence):MechanismReview{
  const obs=Date.parse(m.observedAt),av=Date.parse(m.availableAt)
  if(!m.mint.trim()||!Number.isFinite(obs)||!Number.isFinite(av)||av<obs)
    throw new Error('shark_accept_mechanism_chronology_invalid')
  const verified=m.mechanism!=='UNKNOWN'&&m.confirmations.length>0&&
    m.independentSourceGroups.filter(x=>x.trim()).length>=2&&
    new Set(m.independentSourceGroups).size>=2
  return Object.freeze({mechanism:verified?m.mechanism:'UNKNOWN',
    status:verified?'MECHANISM_EVIDENCED':'INSUFFICIENT_INDEPENDENT_EVIDENCE',
    authority:'DEFENSIVE_RESEARCH_ONLY',canLabelConfirmedRug:false})
}

export type PaperCohortSummary=Readonly<{
  total:number
  priceOnly:number
  unknownOrCensored:number
  shadowIndicative:number
  moneyCoreFilled:0
  realizedProfitVerified:false
  cannotClaimWinRate:true
}>
/** .18: no misleading price-only P&L or selective exclusion of censored cases. */
export function summarizeSharkPaperCohort(input:{
  canaries:readonly PublicFilterCanary[]
  priceMarks:readonly LiveFilterPriceMark[]
  routeReviews:readonly LiveFilterPaperReview[]
}):PaperCohortSummary{
  for(const c of input.canaries)if(c.canSign!==false||c.canBroadcast!==false)
    throw new Error('shark_accept_canary_authority_escalation')
  for(const m of input.priceMarks)if(m.moneyCorePaperFill!==false||m.realTrade!==false)
    throw new Error('shark_accept_paper_authority_escalation')
  for(const p of input.routeReviews)if(p.moneyCorePaperFill!==false||p.realFill!==false)
    throw new Error('shark_accept_route_authority_escalation')
  return Object.freeze({
    total:input.priceMarks.length,priceOnly:input.priceMarks.filter(p=>p.status==='PRICE_ONLY_UNVERIFIED').length,
    unknownOrCensored:input.priceMarks.filter(p=>p.status!=='PRICE_ONLY_UNVERIFIED').length,
    shadowIndicative:input.routeReviews.filter(p=>p.status==='READ_ONLY_SHADOW_ESTIMATE').length,
    moneyCoreFilled:0,realizedProfitVerified:false,cannotClaimWinRate:true,
  })
}
export type LatencyAudit=Readonly<{
  sampleSize:number
  eventToScreenMedianMs?:number
  eventToScreenP95Ms?:number
  eventToScreenP99Ms?:number
  certifiedEndToEndCount:number
  endToEndLatencyCertified:false
  authority:'READ_ONLY_TIMING_RESEARCH'
}>
const quantile=(sorted:number[],q:number)=>sorted.length?sorted[Math.ceil(q*sorted.length)-1]:undefined
/** .19: observed fast lookup != settled executable round trip. */
export function auditSharkLatency(rows:readonly LatencyMeasurement[]):LatencyAudit{
  const valid=rows.filter(r=>r.origin==='REAL_PROVIDER_RECEIPTS'&&r.eventToScreenMs!==undefined)
    .map(r=>r.eventToScreenMs!).sort((a,b)=>a-b)
  if(valid.some(x=>!Number.isFinite(x)||x<0))throw new Error('shark_accept_latency_invalid')
  return Object.freeze({sampleSize:valid.length,eventToScreenMedianMs:quantile(valid,.5),
    eventToScreenP95Ms:quantile(valid,.95),eventToScreenP99Ms:quantile(valid,.99),
    certifiedEndToEndCount:rows.filter(r=>r.endToEndConfirmed).length,
    endToEndLatencyCertified:false,authority:'READ_ONLY_TIMING_RESEARCH'})
}
export type SharkFinalAcceptance=Readonly<{
  status:'EXTERNAL_ACCEPTANCE_BLOCKED'|'ELIGIBLE_FOR_OWNER_REVIEW'
  missing:readonly string[]
  sourceSequenceCompleted:true
  deployed:false
  signingAllowed:false
  spendingAllowed:false
  liveTradingAllowed:false
}>
/** .20: no auto-commissioning. Explicit external evidence required. */
export function finalizeSharkFilterAcceptance(input:{
  exactHeadCiPassed:boolean
  branchesReconciled:boolean
  readOnlyHost:HostAcceptance
  independentlyVerifiedFees:boolean
  independentSellability:boolean
  prospectiveHoldoutLabeled:boolean
  independentMoneyCoreReview:boolean
}):SharkFinalAcceptance{
  const missing:string[]=[]
  if(!input.exactHeadCiPassed)missing.push('exact-head-ci-unverified')
  if(!input.branchesReconciled)missing.push('stale-pr-reconciliation-pending')
  if(input.readOnlyHost.disposition!=='READ_ONLY_HOST_READY')missing.push(...input.readOnlyHost.blockers)
  if(!input.independentlyVerifiedFees)missing.push('terminal-fee-definition-unverified')
  if(!input.independentSellability)missing.push('two-sided-sellability-unverified')
  if(!input.prospectiveHoldoutLabeled)missing.push('prospective-outcome-labels-insufficient')
  if(!input.independentMoneyCoreReview)missing.push('money-core-review-pending')
  return Object.freeze({status:missing.length?'EXTERNAL_ACCEPTANCE_BLOCKED':'ELIGIBLE_FOR_OWNER_REVIEW',
    missing:Object.freeze([...new Set(missing)].sort()),sourceSequenceCompleted:true,
    deployed:false,signingAllowed:false,spendingAllowed:false,liveTradingAllowed:false})
}
