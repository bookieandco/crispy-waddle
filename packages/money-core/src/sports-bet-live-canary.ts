import { createHash } from 'node:crypto'
import { assertSportsMarketQuote,sportsOddsToDecimal,type SportsMarketQuote } from './sports-paper-betting.js'

export type SportsBetEvidenceClass='REAL_AS_OF'|'SYNTHETIC_TEST'

export type SportsBetLiveCanaryPolicy=Readonly<{
  policyId:string
  provider:string
  accountId:string
  currency:string
  maxStakeMinor:bigint
  maxDailyStakeMinor:bigint
  maxDailyWagers:number
  maxDailyRealizedLossMinor:bigint
  maxOpenUnknownExecutions:number
  maxQuoteAgeSeconds:number
  requireExplicitHumanTrigger:true
  autonomousBettingEnabled:false
  authority:'RISK_POLICY_ONLY'
}>

export type SportsBetLiveCanaryRuntimeState=Readonly<{
  tradingDate:string
  dailyStakeMinor:bigint
  dailyWagers:number
  dailyRealizedLossMinor:bigint
  openUnknownExecutions:number
  halted:boolean
  haltReason?:string
}>

export type SportsBetLiveWagerRequest=Readonly<{
  requestId:string
  provider:string
  accountId:string
  eventId:string
  marketId:string
  selectionId:string
  quote:SportsMarketQuote
  stakeMinor:bigint
  currency:string
  requestedAt:string
}>

export type SportsBetCanaryApproval=Readonly<{
  approvalId:string
  userId:string
  provider:string
  accountId:string
  requestFingerprint:string
  maximumStakeMinor:bigint
  approvedAt:string
  expiresAt:string
  evidenceIds:readonly string[]
  authority:'TINY_MANUAL_CANARY_ONLY'
  canIncreaseLimits:false
  autonomousBettingEnabled:false
}>

export type SportsBetManualCanaryTrigger=Readonly<{
  triggerId:string
  kind:'EXPLICIT_HUMAN_EXECUTE'
  source:'INTERACTIVE_USER_ACTION'
  userId:string
  approvalId:string
  confirmedAt:string
}>

export type SportsBetLiveSubmitContext=Readonly<{
  environment:'LIVE'
  canaryExecutionId:string
  idempotencyKey:string
  approvalId:string
  triggerId:string
  userId:string
  submittedAt:string
}>

export type SportsBetLiveSubmissionResult=Readonly<{
  providerReference:string
  providerEventId:string
  state:'ACKNOWLEDGED'|'REJECTED'|'UNKNOWN'
  occurredAt:string
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
}>

export interface SportsbookLiveCanaryAdapter{
  readonly provider:string
  readonly environment:'LIVE'
  submitCanaryWager(context:SportsBetLiveSubmitContext,request:SportsBetLiveWagerRequest):Promise<SportsBetLiveSubmissionResult>
}

export type SportsBetCanaryAttempt=Readonly<{
  executionId:string
  requestId:string
  approvalId:string
  triggerId:string
  provider:string
  accountId:string
  idempotencyKey:string
  requestFingerprint:string
  state:'STARTED'|'ACKNOWLEDGED'|'REJECTED'|'UNKNOWN'
  providerReference?:string
  startedAt:string
  completedAt?:string
}>

export interface SportsBetCanaryAttemptStore{
  get(executionId:string):Promise<SportsBetCanaryAttempt|undefined>|SportsBetCanaryAttempt|undefined
  start(attempt:SportsBetCanaryAttempt):Promise<void>|void
  complete(executionId:string,update:Pick<SportsBetCanaryAttempt,'state'|'providerReference'|'completedAt'>):Promise<void>|void
}

export type SportsBetCanaryExecutionResult=Readonly<{
  executionId:string
  idempotencyKey:string
  providerReference:string
  providerState:'ACKNOWLEDGED'|'REJECTED'|'UNKNOWN'
  stakeMinor:bigint
  currency:string
  sourceClass:SportsBetEvidenceClass
  evidenceIds:readonly string[]
  authority:'TINY_MANUAL_CANARY_ONLY'
  canIncreaseLimits:false
  autonomousBettingEnabled:false
}>

export type SportsBetLiveCanaryEvidence=Readonly<{
  evidenceClass:SportsBetEvidenceClass
  environment:'LIVE'
  provider:string
  accountId:string
  executionId:string
  requestId:string
  approvalId:string
  triggerId:string
  stakeMinor:bigint
  currency:string
  providerReference:string
  providerStates:readonly string[]
  receiptIds:readonly string[]
  settlementEvidenceIds:readonly string[]
  reconciliationId:string
  reconciliationStatus:'MATCH'|'DISCREPANCY'
  credentialVerificationEvidenceIds:readonly string[]
  jurisdictionEvidenceIds:readonly string[]
  ageEligibilityEvidenceIds:readonly string[]
  killSwitchDrillVerified:boolean
  killSwitchEvidenceIds:readonly string[]
  duplicateSubmissionBlocked:boolean
  unknownExecutionBlocksNewCanary:boolean
  settlementReconciled:boolean
  recordedAt:string
  evidenceIds:readonly string[]
}>

export type SportsBetLiveCanaryCertification=Readonly<{
  certificateId:string
  status:'SOFTWARE_ONLY'|'REJECTED'|'LIVE_CANARY_CERTIFIED'
  passed:boolean
  liveCanaryCertified:boolean
  provider:string
  accountId:string
  executionId:string
  scope:'TINY_MANUAL_CANARY_ONLY'
  canIncreaseLimits:false
  autonomousBettingEnabled:false
  reasonCodes:readonly string[]
  evidenceIds:readonly string[]
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

const stable=(v:unknown)=>JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)
const hash=(v:unknown)=>createHash('sha256').update(stable(v)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())
const time=(v:string,c:string)=>{const n=Date.parse(v);if(Number.isNaN(n))throw new Error(c);return n}
const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}

export function fingerprintSportsBetLiveWagerRequest(request:SportsBetLiveWagerRequest):string{
  return hash({
    requestId:request.requestId,provider:request.provider,accountId:request.accountId,eventId:request.eventId,marketId:request.marketId,selectionId:request.selectionId,
    quoteId:request.quote.quoteId,oddsFormat:request.quote.oddsFormat,odds:request.quote.odds,stakeMinor:request.stakeMinor.toString(),currency:request.currency,requestedAt:request.requestedAt,
  })
}

export function assertSportsBetLiveCanaryPolicy(policy:SportsBetLiveCanaryPolicy):void{
  for(const [v,c] of [[policy.policyId,'SPORT_BET_CANARY_POLICY_ID_REQUIRED'],[policy.provider,'SPORT_BET_CANARY_PROVIDER_REQUIRED'],[policy.accountId,'SPORT_BET_CANARY_ACCOUNT_REQUIRED'],[policy.currency,'SPORT_BET_CANARY_CURRENCY_REQUIRED']] as const)nonEmpty(v,c)
  if(policy.authority!=='RISK_POLICY_ONLY'||policy.requireExplicitHumanTrigger!==true||policy.autonomousBettingEnabled!==false)throw new Error('SPORT_BET_CANARY_POLICY_AUTHORITY_INVALID')
  if(policy.maxStakeMinor<=0n||policy.maxDailyStakeMinor<=0n||policy.maxDailyRealizedLossMinor<0n)throw new Error('SPORT_BET_CANARY_POLICY_LIMIT_INVALID')
  if(policy.maxDailyStakeMinor<policy.maxStakeMinor)throw new Error('SPORT_BET_CANARY_DAILY_LIMIT_BELOW_ORDER_LIMIT')
  if(!Number.isInteger(policy.maxDailyWagers)||policy.maxDailyWagers<1||!Number.isInteger(policy.maxOpenUnknownExecutions)||policy.maxOpenUnknownExecutions<0||!Number.isInteger(policy.maxQuoteAgeSeconds)||policy.maxQuoteAgeSeconds<1)throw new Error('SPORT_BET_CANARY_POLICY_LIMIT_INVALID')
}

export function assertSportsBetLiveWagerRequest(request:SportsBetLiveWagerRequest,now:string):void{
  assertSportsMarketQuote(request.quote)
  for(const [v,c] of [[request.requestId,'SPORT_BET_CANARY_REQUEST_ID_REQUIRED'],[request.provider,'SPORT_BET_CANARY_PROVIDER_REQUIRED'],[request.accountId,'SPORT_BET_CANARY_ACCOUNT_REQUIRED'],[request.eventId,'SPORT_BET_CANARY_EVENT_REQUIRED'],[request.marketId,'SPORT_BET_CANARY_MARKET_REQUIRED'],[request.selectionId,'SPORT_BET_CANARY_SELECTION_REQUIRED'],[request.currency,'SPORT_BET_CANARY_CURRENCY_REQUIRED']] as const)nonEmpty(v,c)
  if(request.quote.eventId!==request.eventId||request.quote.marketId!==request.marketId||request.quote.selectionId!==request.selectionId)throw new Error('SPORT_BET_CANARY_QUOTE_BINDING_MISMATCH')
  if(request.stakeMinor<=0n)throw new Error('SPORT_BET_CANARY_STAKE_INVALID')
  time(request.requestedAt,'SPORT_BET_CANARY_REQUEST_TIME_INVALID')
  if(time(request.requestedAt,'SPORT_BET_CANARY_REQUEST_TIME_INVALID')>time(now,'SPORT_BET_CANARY_NOW_INVALID'))throw new Error('SPORT_BET_CANARY_REQUEST_FROM_FUTURE')
  sportsOddsToDecimal(request.quote.oddsFormat,request.quote.odds)
}

export function createSportsBetCanaryApproval(input:{
  approvalId:string
  userId:string
  request:SportsBetLiveWagerRequest
  maximumStakeMinor:bigint
  approvedAt:string
  expiresAt:string
  evidenceIds:readonly string[]
}):SportsBetCanaryApproval{
  for(const [v,c] of [[input.approvalId,'SPORT_BET_CANARY_APPROVAL_ID_REQUIRED'],[input.userId,'SPORT_BET_CANARY_APPROVAL_USER_REQUIRED']] as const)nonEmpty(v,c)
  if(input.maximumStakeMinor<=0n||input.maximumStakeMinor<input.request.stakeMinor)throw new Error('SPORT_BET_CANARY_APPROVAL_STAKE_LIMIT_INVALID')
  if(time(input.expiresAt,'SPORT_BET_CANARY_APPROVAL_EXPIRY_INVALID')<=time(input.approvedAt,'SPORT_BET_CANARY_APPROVED_AT_INVALID'))throw new Error('SPORT_BET_CANARY_APPROVAL_WINDOW_INVALID')
  if(!input.evidenceIds.length)throw new Error('SPORT_BET_CANARY_APPROVAL_EVIDENCE_REQUIRED')
  return Object.freeze({
    approvalId:input.approvalId,userId:input.userId,provider:input.request.provider,accountId:input.request.accountId,
    requestFingerprint:fingerprintSportsBetLiveWagerRequest(input.request),maximumStakeMinor:input.maximumStakeMinor,approvedAt:input.approvedAt,expiresAt:input.expiresAt,
    evidenceIds:unique(input.evidenceIds),authority:'TINY_MANUAL_CANARY_ONLY',canIncreaseLimits:false,autonomousBettingEnabled:false,
  })
}

export async function executeSportsBetLiveCanary(input:{
  adapter:SportsbookLiveCanaryAdapter
  store:SportsBetCanaryAttemptStore
  policy:SportsBetLiveCanaryPolicy
  runtime:SportsBetLiveCanaryRuntimeState
  request:SportsBetLiveWagerRequest
  approval:SportsBetCanaryApproval
  trigger:SportsBetManualCanaryTrigger
  now:string
  sourceClass:SportsBetEvidenceClass
  jurisdictionStatus:'ALLOWED'|'BLOCKED'|'UNKNOWN'
  ageEligibilityVerified:boolean
  credentialVerified:boolean
  evidenceIds:readonly string[]
}):Promise<SportsBetCanaryExecutionResult>{
  assertSportsBetLiveCanaryPolicy(input.policy)
  assertSportsBetLiveWagerRequest(input.request,input.now)
  if(input.adapter.environment!=='LIVE')throw new Error('SPORT_BET_CANARY_LIVE_ADAPTER_REQUIRED')
  if(input.adapter.provider!==input.policy.provider||input.request.provider!==input.policy.provider||input.approval.provider!==input.policy.provider)throw new Error('SPORT_BET_CANARY_PROVIDER_MISMATCH')
  if(input.request.accountId!==input.policy.accountId||input.approval.accountId!==input.policy.accountId)throw new Error('SPORT_BET_CANARY_ACCOUNT_MISMATCH')
  if(input.request.currency!==input.policy.currency)throw new Error('SPORT_BET_CANARY_CURRENCY_MISMATCH')
  if(input.jurisdictionStatus!=='ALLOWED')throw new Error('SPORT_BET_CANARY_JURISDICTION_NOT_ALLOWED')
  if(!input.ageEligibilityVerified)throw new Error('SPORT_BET_CANARY_AGE_ELIGIBILITY_REQUIRED')
  if(!input.credentialVerified)throw new Error('SPORT_BET_CANARY_CREDENTIAL_VERIFICATION_REQUIRED')
  if(input.runtime.halted)throw new Error('SPORT_BET_CANARY_KILL_SWITCH_ACTIVE')
  if(input.runtime.openUnknownExecutions>0&&input.runtime.openUnknownExecutions>=input.policy.maxOpenUnknownExecutions)throw new Error('SPORT_BET_CANARY_UNKNOWN_EXECUTION_LIMIT')
  if(input.runtime.dailyWagers>=input.policy.maxDailyWagers)throw new Error('SPORT_BET_CANARY_DAILY_WAGER_LIMIT')
  if(input.runtime.dailyStakeMinor+input.request.stakeMinor>input.policy.maxDailyStakeMinor)throw new Error('SPORT_BET_CANARY_DAILY_STAKE_LIMIT')
  if(input.runtime.dailyRealizedLossMinor>input.policy.maxDailyRealizedLossMinor)throw new Error('SPORT_BET_CANARY_DAILY_LOSS_LIMIT')
  if(input.request.stakeMinor>input.policy.maxStakeMinor||input.request.stakeMinor>input.approval.maximumStakeMinor)throw new Error('SPORT_BET_CANARY_STAKE_LIMIT')
  if(input.approval.authority!=='TINY_MANUAL_CANARY_ONLY'||input.approval.autonomousBettingEnabled!==false||input.approval.canIncreaseLimits!==false)throw new Error('SPORT_BET_CANARY_APPROVAL_AUTHORITY_INVALID')
  if(input.approval.requestFingerprint!==fingerprintSportsBetLiveWagerRequest(input.request))throw new Error('SPORT_BET_CANARY_APPROVAL_BINDING_MISMATCH')
  const nowMs=time(input.now,'SPORT_BET_CANARY_NOW_INVALID')
  if(nowMs<time(input.approval.approvedAt,'SPORT_BET_CANARY_APPROVED_AT_INVALID')||nowMs>=time(input.approval.expiresAt,'SPORT_BET_CANARY_APPROVAL_EXPIRY_INVALID'))throw new Error('SPORT_BET_CANARY_APPROVAL_EXPIRED')
  if(input.trigger.kind!=='EXPLICIT_HUMAN_EXECUTE'||input.trigger.source!=='INTERACTIVE_USER_ACTION')throw new Error('SPORT_BET_CANARY_AUTONOMOUS_TRIGGER_FORBIDDEN')
  if(input.trigger.userId!==input.approval.userId||input.trigger.approvalId!==input.approval.approvalId)throw new Error('SPORT_BET_CANARY_TRIGGER_BINDING_MISMATCH')
  const triggerMs=time(input.trigger.confirmedAt,'SPORT_BET_CANARY_TRIGGER_TIME_INVALID')
  if(triggerMs<time(input.approval.approvedAt,'SPORT_BET_CANARY_APPROVED_AT_INVALID')||triggerMs>=time(input.approval.expiresAt,'SPORT_BET_CANARY_APPROVAL_EXPIRY_INVALID')||triggerMs>nowMs)throw new Error('SPORT_BET_CANARY_TRIGGER_WINDOW_INVALID')
  const quoteAgeSeconds=Math.floor((nowMs-time(input.request.quote.availableAt,'SPORT_BET_CANARY_QUOTE_TIME_INVALID'))/1000)
  if(quoteAgeSeconds<0)throw new Error('SPORT_BET_CANARY_FUTURE_QUOTE')
  if(quoteAgeSeconds>input.policy.maxQuoteAgeSeconds)throw new Error('SPORT_BET_CANARY_STALE_QUOTE')
  if(!input.evidenceIds.length)throw new Error('SPORT_BET_CANARY_RUNTIME_EVIDENCE_REQUIRED')
  const requestFingerprint=fingerprintSportsBetLiveWagerRequest(input.request)
  const idempotencyKey=hash({approvalId:input.approval.approvalId,requestFingerprint})
  const executionId='sport-bet-canary:'+idempotencyKey
  if(await input.store.get(executionId))throw new Error('SPORT_BET_CANARY_DUPLICATE_SUBMISSION_BLOCKED')
  const attempt:SportsBetCanaryAttempt=Object.freeze({
    executionId,requestId:input.request.requestId,approvalId:input.approval.approvalId,triggerId:input.trigger.triggerId,provider:input.request.provider,accountId:input.request.accountId,
    idempotencyKey,requestFingerprint,state:'STARTED',startedAt:input.now,
  })
  await input.store.start(attempt)
  const result=await input.adapter.submitCanaryWager({
    environment:'LIVE',canaryExecutionId:executionId,idempotencyKey,approvalId:input.approval.approvalId,triggerId:input.trigger.triggerId,userId:input.approval.userId,submittedAt:input.now,
  },input.request)
  if(!result.providerReference.trim()||!result.providerEventId.trim()||!result.evidenceIds.length)throw new Error('SPORT_BET_CANARY_PROVIDER_EVIDENCE_REQUIRED')
  if(time(result.availableAt,'SPORT_BET_CANARY_PROVIDER_AVAILABLE_INVALID')<time(result.observedAt,'SPORT_BET_CANARY_PROVIDER_OBSERVED_INVALID'))throw new Error('SPORT_BET_CANARY_PROVIDER_CLOCK_INVALID')
  await input.store.complete(executionId,{state:result.state,providerReference:result.providerReference,completedAt:result.availableAt})
  return Object.freeze({
    executionId,idempotencyKey,providerReference:result.providerReference,providerState:result.state,stakeMinor:input.request.stakeMinor,currency:input.request.currency,sourceClass:input.sourceClass,
    evidenceIds:unique([...input.approval.evidenceIds,...input.evidenceIds,...input.request.quote.evidenceIds,...result.evidenceIds]),authority:'TINY_MANUAL_CANARY_ONLY',canIncreaseLimits:false,autonomousBettingEnabled:false,
  })
}

export function certifySportsBetLiveCanary(input:{evidence:SportsBetLiveCanaryEvidence;maxCanaryStakeMinor:bigint}):SportsBetLiveCanaryCertification{
  const e=input.evidence,reasons:string[]=[]
  if(input.maxCanaryStakeMinor<=0n)throw new Error('SPORT_BET_CANARY_CERT_LIMIT_INVALID')
  if(e.environment!=='LIVE')reasons.push('LIVE_ENVIRONMENT_REQUIRED')
  if(!e.provider.trim()||!e.accountId.trim()||!e.executionId.trim()||!e.requestId.trim()||!e.approvalId.trim()||!e.triggerId.trim()||!e.providerReference.trim())reasons.push('CANARY_LINEAGE_REQUIRED')
  if(e.stakeMinor<=0n||e.stakeMinor>input.maxCanaryStakeMinor)reasons.push('CANARY_STAKE_LIMIT')
  if(!e.currency.trim())reasons.push('CANARY_CURRENCY_REQUIRED')
  if(!e.providerStates.includes('ACKNOWLEDGED')||!e.providerStates.some(x=>x==='FILLED'||x==='SETTLED'||x==='CANCELLED'||x==='REJECTED'||x==='VOID'))reasons.push('PROVIDER_LIFECYCLE_INCOMPLETE')
  if(!e.receiptIds.length)reasons.push('PROVIDER_RECEIPTS_REQUIRED')
  if(!e.settlementEvidenceIds.length||!e.settlementReconciled)reasons.push('SETTLEMENT_RECONCILIATION_REQUIRED')
  if(e.reconciliationStatus!=='MATCH'||!e.reconciliationId.trim())reasons.push('ACCOUNT_RECONCILIATION_REQUIRED')
  if(!e.credentialVerificationEvidenceIds.length)reasons.push('CREDENTIAL_VERIFICATION_REQUIRED')
  if(!e.jurisdictionEvidenceIds.length)reasons.push('JURISDICTION_EVIDENCE_REQUIRED')
  if(!e.ageEligibilityEvidenceIds.length)reasons.push('AGE_ELIGIBILITY_EVIDENCE_REQUIRED')
  if(!e.killSwitchDrillVerified||!e.killSwitchEvidenceIds.length)reasons.push('KILL_SWITCH_DRILL_REQUIRED')
  if(!e.duplicateSubmissionBlocked)reasons.push('IDEMPOTENCY_DRILL_REQUIRED')
  if(!e.unknownExecutionBlocksNewCanary)reasons.push('UNKNOWN_EXECUTION_DRILL_REQUIRED')
  if(!e.evidenceIds.length)reasons.push('LIVE_EVIDENCE_REQUIRED')
  time(e.recordedAt,'SPORT_BET_CANARY_CERT_TIME_INVALID')
  let status:SportsBetLiveCanaryCertification['status']
  if(e.evidenceClass==='SYNTHETIC_TEST')status=reasons.length?'REJECTED':'SOFTWARE_ONLY'
  else status=reasons.length?'REJECTED':'LIVE_CANARY_CERTIFIED'
  const liveCanaryCertified=status==='LIVE_CANARY_CERTIFIED'
  return Object.freeze({
    certificateId:'sport-bet-live-canary-cert:'+hash({executionId:e.executionId,evidenceClass:e.evidenceClass,maxCanaryStakeMinor:input.maxCanaryStakeMinor.toString(),evidenceIds:[...e.evidenceIds].sort()}),
    status,passed:status==='SOFTWARE_ONLY'||liveCanaryCertified,liveCanaryCertified,provider:e.provider,accountId:e.accountId,executionId:e.executionId,scope:'TINY_MANUAL_CANARY_ONLY',
    canIncreaseLimits:false,autonomousBettingEnabled:false,reasonCodes:unique(reasons),evidenceIds:unique([...e.evidenceIds,...e.receiptIds,...e.settlementEvidenceIds,...e.credentialVerificationEvidenceIds,...e.jurisdictionEvidenceIds,...e.ageEligibilityEvidenceIds,...e.killSwitchEvidenceIds]),
    authority:'CERTIFICATION_ONLY',canExecute:false,
  })
}
