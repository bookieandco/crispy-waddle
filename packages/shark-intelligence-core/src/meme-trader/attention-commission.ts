/**
 * SHARK-ATTENTION.COMMISSION.11–.15
 * Pure evidence reconciliation and owner-alert staging. These functions never
 * read the network, write a DB, dispatch notifications or authorize trading.
 */
import type {AttentionDexSnapshot} from './attention-public-dex'
import type {AttentionLivePaperCycle} from './attention-live-paper-cycle'
import type {AttentionResearchAlert} from './attention-research'
import type {ProspectiveAttentionReport} from './attention-prospective-paper'

const utc=(x:string)=>{
  if(typeof x!=='string'||!x.endsWith('Z')||!Number.isFinite(Date.parse(x)))
    throw new Error('ATTENTION_COMMISSION_TIME_INVALID')
  return Date.parse(x)
}
const mint=/^[1-9A-HJ-NP-Za-km-z]{32,44}$/
const ownerId=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export type AttentionSamplerBudget=Readonly<{
  provider:'DEXSCREENER_PUBLIC_PAIR'
  intervalSeconds:number
  maximumChecksPerCycle:number
  requestsInPreviousMinute:number
  requestBudgetPerMinute:number
  signedRequestsAllowed:false
  canTrade:false
}>
export type AttentionCommissionRateGate=Readonly<{
  schema:'SHARK_ATTENTION_PUBLIC_RATE_GATE_V1'
  decision:'ALLOW_ONE_MANUAL_READ'|'DENY_BUDGET'
  remainingRequests:number
  providerMaxPerMinute:300
  requiresTrustedHostClock:true
  canStartWorker:false
  canTrade:false
}>
/** .11 Advisory budget gate. Must be run atomically by a commissioned host.
 * This does not reserve tokens or prevent other processes using the same API.
 */
export function reviewAttentionPublicReadBudget(b:AttentionSamplerBudget):AttentionCommissionRateGate{
  if(b.provider!=='DEXSCREENER_PUBLIC_PAIR'||b.signedRequestsAllowed!==false||
    b.canTrade!==false||!Number.isSafeInteger(b.intervalSeconds)||b.intervalSeconds<15||
    !Number.isSafeInteger(b.maximumChecksPerCycle)||b.maximumChecksPerCycle<1||
    b.maximumChecksPerCycle>6||!Number.isSafeInteger(b.requestsInPreviousMinute)||
    b.requestsInPreviousMinute<0||!Number.isSafeInteger(b.requestBudgetPerMinute)||
    b.requestBudgetPerMinute<1||b.requestBudgetPerMinute>60)
    throw new Error('ATTENTION_COMMISSION_BUDGET_INVALID')
  const remaining=Math.max(0,b.requestBudgetPerMinute-b.requestsInPreviousMinute)
  return Object.freeze({schema:'SHARK_ATTENTION_PUBLIC_RATE_GATE_V1' as const,
    decision:remaining>=1?'ALLOW_ONE_MANUAL_READ' as const:'DENY_BUDGET' as const,
    remainingRequests:remaining,providerMaxPerMinute:300 as const,
    requiresTrustedHostClock:true as const,canStartWorker:false as const,canTrade:false as const})
}

export type AttentionContinuityReview=Readonly<{
  schema:'SHARK_ATTENTION_CONTINUITY_V1'
  status:'FIRST_OBSERVATION'|'CHAINED_FRESH'|'QUARANTINE_STALE'|'QUARANTINE_POOL_SWITCH'
  previousReceiptId:string|null
  currentReceiptId:string
  publicOriginUnattested:true
  canRecordAsFill:false
  canTrade:false
}>
/** .12 Pure receipt continuity; storage/replay remains with canonical worker. */
export function reviewAttentionContinuity(
  current:AttentionDexSnapshot,previous:AttentionDexSnapshot|null,
):AttentionContinuityReview{
  if(current.source!=='DEXSCREENER_PUBLIC_PAIR'||current.sourceAuthenticated!==false||
    current.canTrade!==false||!mint.test(current.mint)||!mint.test(current.pairAddress)||
    !current.receiptId)
    throw new Error('ATTENTION_COMMISSION_SNAPSHOT_INVALID')
  let status:AttentionContinuityReview['status']='FIRST_OBSERVATION'
  if(previous){
    if(previous.source!=='DEXSCREENER_PUBLIC_PAIR'||previous.canTrade!==false||
      previous.sourceAuthenticated!==false||previous.mint!==current.mint||
      !previous.receiptId||previous.receiptId===current.receiptId)
      throw new Error('ATTENTION_COMMISSION_LINEAGE_INVALID')
    const duration=utc(current.observedAt)-utc(previous.observedAt)
    status=duration<=0||duration>15*60_000?'QUARANTINE_STALE':
      previous.pairAddress!==current.pairAddress?'QUARANTINE_POOL_SWITCH':'CHAINED_FRESH'
  }else utc(current.observedAt)
  return Object.freeze({schema:'SHARK_ATTENTION_CONTINUITY_V1' as const,
    status,previousReceiptId:previous?.receiptId??null,currentReceiptId:current.receiptId,
    publicOriginUnattested:true as const,canRecordAsFill:false as const,canTrade:false as const})
}

export type AttentionStagedOwnerAlert=Readonly<{
  owner_id:string;alert_id:string;mint:string
  code:AttentionResearchAlert['code']
  severity:AttentionResearchAlert['severity']
  source_url:string
  observed_at:string
}>
export type OwnerAttentionProjection=Readonly<{
  schema:'SHARK_ATTENTION_OWNER_PROJECTION_V1'
  records:readonly AttentionStagedOwnerAlert[]
  status:'STAGED_FOR_SEPARATE_TRUSTED_SERVICE_REVIEW'
  canPersist:false
  canNotify:false
  canTrade:false
}>
/** .13 Strict projection payload builder. The caller must independently bind
 * the supplied owner ID to an authenticated owner session on the server.
 * Returns inert rows, never performs an insert or notification.
 */
export function stageOwnerResearchAlerts(input:Readonly<{
  authenticatedOwnerId:string
  evaluatedAt:string
  cycle:AttentionLivePaperCycle
}>):OwnerAttentionProjection{
  if(!ownerId.test(input.authenticatedOwnerId))throw new Error('ATTENTION_COMMISSION_OWNER_ID_INVALID')
  const cutoff=utc(input.evaluatedAt),cycleTime=utc(input.cycle.evaluatedAt)
  if(input.cycle.authority!=='RESEARCH_ONLY'||input.cycle.canTrade!==false||
    input.cycle.canNotify!==false||input.cycle.orderCount!==0||
    input.cycle.signedTransactionCount!==0||cycleTime>cutoff||
    cutoff-cycleTime>15*60_000||!mint.test(input.cycle.mint)||
    !Array.isArray(input.cycle.alerts)||input.cycle.alerts.length>20)
    throw new Error('ATTENTION_COMMISSION_CYCLE_INVALID')
  const seen=new Set<string>()
  const records:AttentionStagedOwnerAlert[]=[]
  for(const a of input.cycle.alerts){
    if(!a||a.canExecute!==false||a.researchOnly!==true||a.mint!==input.cycle.mint||
      !a.eventId||!input.cycle.observedEventIds.includes(a.eventId)||
      typeof a.id!=='string'||a.id.length>256||seen.has(a.id)||
      !['PRICE_SWING','CONTRACT_COMPETITION','NARRATIVE_RETRACTED','ONCHAIN_DISTRIBUTION','LIQUIDITY_RISK'].includes(a.code)||
      !['WATCH','HIGH'].includes(a.severity))
      throw new Error('ATTENTION_COMMISSION_ALERT_INVALID')
    let parsed:URL
    try{parsed=new URL(a.sourceUrl)}catch{throw new Error('ATTENTION_COMMISSION_ALERT_URL_INVALID')}
    if(parsed.protocol!=='https:'||parsed.username||parsed.password||
      parsed.search||parsed.hash||parsed.port||!parsed.hostname||a.sourceUrl.length>512)
      throw new Error('ATTENTION_COMMISSION_ALERT_URL_INVALID')
    const at=utc(a.observedAt)
    if(at>cycleTime||cutoff-at>15*60_000)throw new Error('ATTENTION_COMMISSION_ALERT_STALE')
    seen.add(a.id)
    records.push(Object.freeze({
      owner_id:input.authenticatedOwnerId,alert_id:a.id,
      mint:a.mint,code:a.code,severity:a.severity,
      source_url:a.sourceUrl,observed_at:a.observedAt,
    }))
  }
  return Object.freeze({
    schema:'SHARK_ATTENTION_OWNER_PROJECTION_V1' as const,
    records:Object.freeze(records.sort((a,b)=>a.alert_id.localeCompare(b.alert_id))),
    status:'STAGED_FOR_SEPARATE_TRUSTED_SERVICE_REVIEW' as const,
    canPersist:false as const,canNotify:false as const,canTrade:false as const,
  })
}

/** .14 Descriptive acceptance only; censoring cannot be excluded. */
export function auditProspectiveCoverage(report:ProspectiveAttentionReport):Readonly<{
  status:'NEEDS_MORE_PROSPECTIVE_EVIDENCE'|'REVIEWABLE_DESCRIPTIVE_PAPER'
  marked:number;censored:number;coverage:number|null
  observedFills:0;canClaimAlpha:false;canTrade:false
}>{
  if(report.schema!=='SHARK_ATTENTION_PROSPECTIVE_PAPER_V1'||
    report.observedFillCount!==0||report.canTrade!==false||
    report.independentlyValidated!==false||
    !Number.isSafeInteger(report.considered)||!Number.isSafeInteger(report.marked)||
    !Number.isSafeInteger(report.censored)||report.marked+report.censored!==report.considered||
    report.paired.sampleCount!==report.marked)
    throw new Error('ATTENTION_COMMISSION_PAPER_INVALID')
  const coverage=report.considered?report.marked/report.considered:null
  if(report.coverage!==coverage)throw new Error('ATTENTION_COMMISSION_COVERAGE_MISMATCH')
  return Object.freeze({
    status:report.marked>=30&&coverage!==null&&coverage>=.8?
      'REVIEWABLE_DESCRIPTIVE_PAPER' as const:'NEEDS_MORE_PROSPECTIVE_EVIDENCE' as const,
    marked:report.marked,censored:report.censored,coverage,
    observedFills:0 as const,canClaimAlpha:false as const,canTrade:false as const,
  })
}

export type AttentionCommissionGateId=
 'PARENT_PR_RECONCILED'|'EXACT_HEAD_CI'|'PUBLIC_ADAPTER_PROVENANCE'|
 'BOUNDED_WORKER_RECOVERY'|'PROSPECTIVE_CASES'|'OWNER_RLS_STAGING'|
 'OWNER_DEVICE_READBACK'|'EXTERNAL_COST_APPROVAL'
export type AttentionCommissionGate=Readonly<{
  gate:AttentionCommissionGateId
  status:'PENDING'|'EVIDENCED'
  // Immutable review link or external receipt; not an assertion of authenticity.
  receipt:string|null
}>
const REQUIRED:readonly AttentionCommissionGateId[]=[
  'PARENT_PR_RECONCILED','EXACT_HEAD_CI','PUBLIC_ADAPTER_PROVENANCE',
  'BOUNDED_WORKER_RECOVERY','PROSPECTIVE_CASES','OWNER_RLS_STAGING',
  'OWNER_DEVICE_READBACK','EXTERNAL_COST_APPROVAL',
]
/** .15 Source-only owner staging review. Never promotes live-money authority. */
export function reconcileAttentionCommissionGates(gates:readonly AttentionCommissionGate[]){
  if(!Array.isArray(gates)||gates.length!==REQUIRED.length||
    new Set(gates.map(g=>g.gate)).size!==REQUIRED.length||
    gates.some(g=>!REQUIRED.includes(g.gate)||!['PENDING','EVIDENCED'].includes(g.status)||
      (g.status==='EVIDENCED'&&(!g.receipt||g.receipt.length>512))||
      (g.status==='PENDING'&&g.receipt!==null)))
    throw new Error('ATTENTION_COMMISSION_GATE_SET_INVALID')
  const blocked=gates.filter(g=>g.status!=='EVIDENCED').map(g=>g.gate)
  return Object.freeze({
    schema:'SHARK_ATTENTION_COMMISSION_GATE_V1' as const,
    status:blocked.length?'BLOCKED' as const:'READY_FOR_SEPARATE_OWNER_STAGING_REVIEW' as const,
    blocked:Object.freeze(blocked),
    sourceOnly:true as const,productionCommissioned:false as const,
    signerAuthorized:false as const,canStartWorker:false as const,
    canNotify:false as const,canTrade:false as const,
  })
}
