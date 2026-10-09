import {createHash} from 'node:crypto'
import {assertJhadinaPurseCharter,type JhadinaPurseCharter} from './jhadina-purse-charter.js'
import {assertAutonomousMandateActive,type AutonomousTradingMandate} from './autonomous-trading-contracts.js'
import {assertCanaryPolicy,type LiveCanaryPolicy,type LiveCanaryState} from './live-canary-contracts.js'
import type {PurseLiquiditySnapshot} from './purse-liquidity.js'
import type {CofferAccountantDecision} from './coffer-accountant.js'

/**
 * Owner-authorized live capital management is the end state.
 * This is a fail-closed independent admission *before* downstream Money/Action Core.
 * It cannot itself issue, consume or bypass an execution permit.
 */
export type PurseLiveCommissioningEvidence=Readonly<{
  evidenceId:string
  ownerUserId:string
  cofferId:string
  provider:string
  accountId:string
  custodyReadbackId:string
  sourceRightsReceiptId:string
  durableLedgerReadbackId:string
  encryptedBackupRestoreReceiptId:string
  forwardLearningReviewId:string
  ownerLiveMandateReadbackId:string
  verifiedBy:string
  verifiedAt:string
  expiresAt:string
  sourceKind:'INDEPENDENT_READBACK'
  synthetic:false
  historicalLineage:'RESTORED_ORIGINAL'|'NEW_FORWARD_ONLY'
  originalLedgerRecovered:boolean
  newForwardLedgerIsolated:boolean
  withdrawalRailCommissioned:boolean
  executionProviderCommissioned:boolean
  operationalPaperReviewPassed:boolean
  workerPersistentAfterRestart:boolean
  accountOwnershipVerified:boolean
  liveMarketFeedLicensed:boolean
  authority:'COMMISSIONING_EVIDENCE_ONLY'
  canExecute:false
}>
export type PurseLiveCofferAdmission=Readonly<{
 admissionId:string
 charterId:string
 cofferId:string
 userId:string
 provider:string
 accountId:string
 permittedStrategyIds:readonly string[]
 disposition:'READY_FOR_DOWNSTREAM_MONEY_AUTHORIZATION'|'BLOCKED'
 reasonCodes:readonly string[]
 maximumCandidateNotionalMinor:bigint
 ownerDestinationId:string
 evidenceIds:readonly string[]
 financialAuthority:'NONE'
 canMoveMoney:false
 canExecute:false
 canAuthorizeLive:false
 authority:'PURSE_LIVE_CANDIDATE_ONLY'
}>
const fresh=(a:string,now:string,maxMs:number)=>Number.isFinite(Date.parse(a))&&Date.parse(a)<=Date.parse(now)&&Date.parse(now)-Date.parse(a)<=maxMs
const hash=(x:unknown)=>createHash('sha256').update(JSON.stringify(x,(_k,v)=>typeof v==='bigint'?v.toString():v)).digest('hex')
const min=(a:bigint,b:bigint)=>a<b?a:b
export function reviewPurseLiveCofferAdmission(input:{
 charter:JhadinaPurseCharter
 mandate:AutonomousTradingMandate|null
 canaryPolicy:LiveCanaryPolicy
 canaryState:LiveCanaryState|null
 liquidity:PurseLiquiditySnapshot
 accountant:CofferAccountantDecision
 evidence:PurseLiveCommissioningEvidence|null
 now:string
}):PurseLiveCofferAdmission{
 const {charter:c,mandate:m,canaryPolicy:p,canaryState:s,liquidity:l,accountant:a,evidence:e,now}=input
 assertJhadinaPurseCharter(c,now)
 assertCanaryPolicy(p)
 const reasons:string[]=[]
 if(c.autonomyMode!=='LIVE_GOVERNED_INTENTS')reasons.push('OWNER_LIVE_CHARTER_REQUIRED')
 if(!m)reasons.push('OWNER_MANDATE_MISSING')
 else{
  try{assertAutonomousMandateActive(m,now)}catch{reasons.push('OWNER_MANDATE_INACTIVE')}
  if(m.userId!==c.userId||m.currency!==c.reportingCurrency||m.approvalReceiptId.trim()===''||
     m.actionCoreAuthorityId.trim()===''||m.evidenceIds.length===0||m.mode!=='LIVE_AUTONOMOUS')reasons.push('OWNER_MANDATE_SCOPE_MISMATCH')
  if(!m.allowedStrategyIds.length||!m.allowedInstrumentPrefixes.length)reasons.push('OWNER_MANDATE_EMPTY_SCOPE')
  if(m.limits.maxOrderNotionalMinor<=0n||m.limits.maxDailyOrders<1)reasons.push('OWNER_MANDATE_LIMITS_MISSING')
 }
 if(l.authority!=='LIQUIDITY_EVIDENCE'||l.canExecute!==false||l.charterId!==c.charterId||l.reportingCurrency!==c.reportingCurrency||
    !l.evidenceIds.length||!fresh(l.observedAt,now,300000))reasons.push('OWNER_LIQUIDITY_READBACK_INVALID')
 if(a.authority!=='ACCOUNTANT_DECISION_ONLY'||a.canMoveMoney!==false||a.cofferId!==c.cofferId||
    a.survivalState!=='ACTIVE')reasons.push('COFFER_SURVIVAL_OR_ACCOUNTANT_INVALID')
 if(l.availableToAllocateMinor<=0n||a.deployableCashMinor<=0n)reasons.push('PROTECTED_RESERVES_OR_CASH_UNAVAILABLE')
 if(l.ownerSweepHoldMinor<0n||c.ownerProfitSweepProtected!==true||!c.verifiedOwnerPayoutDestinationId)reasons.push('OWNER_PAYDAY_PROTECTION_INVALID')
 if(p.currency!==c.reportingCurrency||p.maxOrderNotionalMinor<=0n)reasons.push('CANARY_POLICY_INCOMPATIBLE')
 if(!s||s.halted||s.unresolvedExecutionIds.length>0||!fresh(s.updatedAt,now,300000))reasons.push('CANARY_HALTED_UNKNOWN_OR_STALE')
 else if(!m||s.provider!==m.provider||s.accountId!==m.accountId||s.currency!==m.currency||
   s.submittedNotionalMinor>=p.maxDailySubmittedNotionalMinor||s.submittedOrders>=p.maxDailyOrders||
   s.realizedLossMinor>=p.maxDailyRealizedLossMinor||s.grossExposureMinor>=p.maxGrossExposureMinor)reasons.push('CANARY_EXPOSURE_OR_DAILY_LIMIT')
 if(!e)reasons.push('INDEPENDENT_LIVE_COMMISSIONING_MISSING')
 else{
  if(e.sourceKind!=='INDEPENDENT_READBACK'||e.synthetic!==false||e.authority!=='COMMISSIONING_EVIDENCE_ONLY'||e.canExecute!==false||
     !e.evidenceId||!e.verifiedBy||!fresh(e.verifiedAt,now,300000)||e.expiresAt<=now||
     !e.custodyReadbackId||!e.sourceRightsReceiptId||!e.durableLedgerReadbackId||!e.encryptedBackupRestoreReceiptId||
     !e.forwardLearningReviewId||!e.ownerLiveMandateReadbackId)reasons.push('LIVE_COMMISSIONING_READBACK_INVALID')
  if(e.ownerUserId!==c.userId||e.cofferId!==c.cofferId||!m||e.provider!==m.provider||e.accountId!==m.accountId)
    reasons.push('LIVE_COMMISSIONING_ACCOUNT_MISMATCH')
  if(!e.executionProviderCommissioned||!e.accountOwnershipVerified||!e.liveMarketFeedLicensed||
     !e.operationalPaperReviewPassed||!e.workerPersistentAfterRestart)reasons.push('REAL_LIVE_PROVIDER_OR_WORKER_NOT_COMMISSIONED')
  if(e.historicalLineage==='RESTORED_ORIGINAL'&&!e.originalLedgerRecovered||
     e.historicalLineage==='NEW_FORWARD_ONLY'&&(!e.newForwardLedgerIsolated||e.originalLedgerRecovered))
    reasons.push('HISTORY_LINEAGE_NOT_VERIFIED')
 }
 const maxAmount=m?min(min(min(l.availableToAllocateMinor,a.deployableCashMinor),p.maxOrderNotionalMinor),m.limits.maxOrderNotionalMinor):0n
 const available=maxAmount>0n&&!reasons.length
 return Object.freeze({
  admissionId:'purse-live-admission:'+hash({charterId:c.charterId,mandateId:m?.mandateId,sourceId:e?.evidenceId,
    liquidityId:l.liquiditySnapshotId,now,status:available,reasonCodes:[...new Set(reasons)].sort()}),
  charterId:c.charterId,cofferId:c.cofferId,userId:c.userId,provider:m?.provider??'',accountId:m?.accountId??'',
  permittedStrategyIds:Object.freeze([...(m?.allowedStrategyIds??[])]),
  disposition:available?'READY_FOR_DOWNSTREAM_MONEY_AUTHORIZATION':'BLOCKED',
  reasonCodes:Object.freeze([...new Set(reasons)].sort()),maximumCandidateNotionalMinor:available?maxAmount:0n,
  ownerDestinationId:c.verifiedOwnerPayoutDestinationId,
  evidenceIds:Object.freeze([...new Set([...c.evidenceIds,...l.evidenceIds,...(m?.evidenceIds??[]),
    ...(e?[e.evidenceId,e.custodyReadbackId,e.sourceRightsReceiptId,e.durableLedgerReadbackId,e.encryptedBackupRestoreReceiptId,
      e.forwardLearningReviewId,e.ownerLiveMandateReadbackId]:[])])].sort()),
  financialAuthority:'NONE',canMoveMoney:false,canExecute:false,canAuthorizeLive:false,
  authority:'PURSE_LIVE_CANDIDATE_ONLY',
 })
}
