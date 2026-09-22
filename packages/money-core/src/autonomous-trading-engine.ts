import { createHash, randomUUID } from 'node:crypto'
import { assertActionCoreAuthorityMatches, issueActionCoreBoundExecutionPermit } from './action-core-authority-bridge.js'
import { requireBrokerAccountEntitlement, assertBrokerAccountEntitlement, type BrokerAccountEntitlement, type BrokerAccountEntitlementStore } from './broker-account-entitlement.js'
import { createExecutionAttempt, type ExecutionAttempt, type ExecutionAttemptStore } from './execution-attempt.js'
import { authorizeAndConsumeMoneyPermit, type MoneyExecutionPermit } from './execution-permit-gate.js'
import type { ExecutionAction, ExecutionPermit, PermitStore } from './execution-permit.js'
import type { ExecutionPlan } from './execution-planning-contracts.js'
import type { LiveExecutionPreflight } from './live-preflight-contracts.js'
import type { LiveBrokerOrderRequest, LiveBrokerSubmissionResult, ManualLiveBrokerAdapter } from './manual-live-broker-contracts.js'
import { assertAutonomousIntent, assertAutonomousMandateActive, type AutonomousCertificationCase, type AutonomousCertificationReport, type AutonomousRiskDecision, type AutonomousRiskSnapshot, type AutonomousTradeActionRequest, type AutonomousTradeIntent, type AutonomousTradingMandate } from './autonomous-trading-contracts.js'
import type { MoneyActionCoreAuthority } from './action-core-authority-bridge.js'
import { type CanaryReservation, type LiveCanaryPolicy, type LiveCanaryStateStore } from './live-canary-contracts.js'
import type { ProviderExecutionEvent } from './execution-receipt-contracts.js'

export type AutonomousTradePermitPackage=Readonly<{
  request:AutonomousTradeActionRequest
  authority:MoneyActionCoreAuthority
  permit:ExecutionPermit
  action:ExecutionAction
  mandateId:string
  strategyId:string
  riskDecisionId:string
  allocationDecisionId:string
  approvalReceiptId:string
  mode:'LIVE_AUTONOMOUS'
  autonomous:true
}>

export type AutonomousLiveExecutionResult=Readonly<{
  attempt:ExecutionAttempt
  providerEvent:ProviderExecutionEvent
  providerReference?:string
  state:'SUBMITTED'|'REJECTED'|'UNKNOWN'
  reservation:CanaryReservation
  tradingDate:string
  retryAllowed:false
  authority:'AUTONOMOUS_LIVE_EXECUTION'
  autonomous:true
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const bps=(n:number)=>Number.isInteger(n)&&n>=0&&n<=10000
const day=(iso:string)=>{if(Number.isNaN(Date.parse(iso)))throw new Error('MONEY_AUTO_TIME_INVALID');return new Date(iso).toISOString().slice(0,10)}

function instrumentAllowed(m:AutonomousTradingMandate,instrumentId:string){return m.allowedInstrumentPrefixes.some(prefix=>instrumentId.startsWith(prefix))}

export function evaluateAutonomousRisk(input:{
  mandate:AutonomousTradingMandate
  intent:AutonomousTradeIntent
  snapshot:AutonomousRiskSnapshot
  now:string
}):AutonomousRiskDecision{
  const {mandate:m,intent:i,snapshot:s}=input
  assertAutonomousMandateActive(m,input.now);assertAutonomousIntent(i)
  const reasons:string[]=[]
  if(i.mandateId!==m.mandateId)reasons.push('MANDATE_MISMATCH')
  if(i.currency!==m.currency||s.currency!==m.currency)reasons.push('CURRENCY_MISMATCH')
  if(s.provider!==m.provider||s.accountId!==m.accountId)reasons.push('ACCOUNT_BINDING_MISMATCH')
  if(i.notionalMinor>m.limits.maxOrderNotionalMinor)reasons.push('ORDER_NOTIONAL_LIMIT')
  if(!instrumentAllowed(m,i.instrumentId))reasons.push('INSTRUMENT_NOT_ALLOWED')
  if(!m.allowedStrategyIds.includes(i.strategyId))reasons.push('STRATEGY_NOT_ALLOWED')
  if(i.opensShort&&!m.allowOpeningShorts)reasons.push('OPENING_SHORT_NOT_ALLOWED')
  if(i.modelConfidenceBps<m.limits.minModelConfidenceBps)reasons.push('MODEL_CONFIDENCE_BELOW_FLOOR')
  if(!bps(s.drawdownBps)||s.drawdownBps>m.limits.maxDrawdownBps)reasons.push('DRAWDOWN_LIMIT')
  if(!Number.isInteger(s.leverageBps)||s.leverageBps<0||s.leverageBps>100000||s.leverageBps>m.limits.maxLeverageBps)reasons.push('LEVERAGE_LIMIT')
  const realizedLoss=s.realizedPnlMinor<0n?-s.realizedPnlMinor:0n
  if(realizedLoss>m.limits.maxDailyRealizedLossMinor)reasons.push('DAILY_REALIZED_LOSS_LIMIT')
  const projected=i.side==='BUY'?s.grossExposureMinor+i.notionalMinor:s.grossExposureMinor
  if(projected>m.limits.maxGrossExposureMinor)reasons.push('GROSS_EXPOSURE_LIMIT')
  if(s.unresolvedExecutions>0)reasons.push('UNRESOLVED_EXECUTION_BLOCK')
  if(!s.evidenceIds.length||s.authority!=='EVIDENCE_ONLY')reasons.push('RISK_EVIDENCE_INVALID')
  if(Number.isNaN(Date.parse(s.observedAt))||Number.isNaN(Date.parse(s.availableAt))||s.availableAt>input.now)reasons.push('RISK_SNAPSHOT_TIME_INVALID')
  const reasonCodes=Object.freeze([...new Set(reasons)].sort())
  return Object.freeze({
    riskDecisionId:'auto-risk:'+hash({mandate:m.mandateId,intent:i.intentId,snapshot:s.snapshotId,now:input.now,reasons:reasonCodes}),
    mandateId:m.mandateId,intentId:i.intentId,allowed:reasonCodes.length===0,reasonCodes,snapshotId:s.snapshotId,evaluatedAt:input.now,
    authority:'RISK_VETO_ONLY',canAuthorizeTrade:false,
  })
}

export function buildAutonomousTradeActionRequest(input:{
  actionId:string
  mandate:AutonomousTradingMandate
  intent:AutonomousTradeIntent
  requestedAt:string
}):AutonomousTradeActionRequest{
  const {mandate:m,intent:i}=input
  assertAutonomousMandateActive(m,input.requestedAt);assertAutonomousIntent(i)
  if(i.mandateId!==m.mandateId||!instrumentAllowed(m,i.instrumentId)||!m.allowedStrategyIds.includes(i.strategyId))throw new Error('MONEY_AUTO_INTENT_OUTSIDE_MANDATE')
  if(i.notionalMinor>m.limits.maxOrderNotionalMinor)throw new Error('MONEY_AUTO_INTENT_ORDER_LIMIT')
  const action=Object.freeze({capability:'money.trade.submit' as const,provider:m.provider,accountId:m.accountId,instrumentId:i.instrumentId,side:i.side,notionalMinor:i.notionalMinor.toString(),currency:i.currency,executionPlanId:i.executionPlanId,preflightId:i.preflightId,mandateId:m.mandateId,strategyId:i.strategyId})
  return Object.freeze({id:input.actionId,userId:m.userId,type:'money.trade.submit',action,requestedAt:input.requestedAt,approvalReceiptId:m.approvalReceiptId})
}

function actionFrom(request:AutonomousTradeActionRequest):ExecutionAction{
  const a=request.action
  return Object.freeze({actionId:request.id,userId:request.userId,capability:a.capability,provider:a.provider,accountId:a.accountId,instrumentId:a.instrumentId,side:a.side,executionPlanId:a.executionPlanId,preflightId:a.preflightId,mandateId:a.mandateId,strategyId:a.strategyId,amount:a.notionalMinor,currency:a.currency})
}

export async function issueAutonomousTradePermitPackage(input:{
  permitStore:PermitStore
  request:AutonomousTradeActionRequest
  authority:MoneyActionCoreAuthority
  mandate:AutonomousTradingMandate
  intent:AutonomousTradeIntent
  risk:AutonomousRiskDecision
  plan:ExecutionPlan
  preflight:LiveExecutionPreflight
  entitlement:BrokerAccountEntitlement
  authorizedAt:string
  permitExpiresAt:string
  permitId?:string
  nonce?:string
}):Promise<AutonomousTradePermitPackage>{
  const {request,authority,mandate:m,intent:i,risk,plan,preflight,entitlement}=input
  assertAutonomousMandateActive(m,input.authorizedAt);assertAutonomousIntent(i);assertActionCoreAuthorityMatches(request,authority)
  if(authority.decision!=='allow')throw new Error('MONEY_AUTO_CHILD_AUTHORITY_MUST_ALLOW')
  if(authority.approvalReceiptId!==m.approvalReceiptId)throw new Error('MONEY_AUTO_MANDATE_APPROVAL_LINEAGE_MISMATCH')
  if(input.authorizedAt<authority.authorizedAt||input.authorizedAt>=authority.expiresAt)throw new Error('MONEY_AUTO_CHILD_AUTHORITY_WINDOW_INVALID')
  if(i.mandateId!==m.mandateId||risk.mandateId!==m.mandateId||risk.intentId!==i.intentId||!risk.allowed||risk.authority!=='RISK_VETO_ONLY')throw new Error('MONEY_AUTO_RISK_VETO')
  if(plan.executionPlanId!==i.executionPlanId||plan.instrumentId!==i.instrumentId||plan.side!==i.side||plan.notional.minor!==i.notionalMinor||plan.notional.currency!==i.currency)throw new Error('MONEY_AUTO_PLAN_BINDING_MISMATCH')
  if(preflight.preflightId!==i.preflightId||preflight.executionPlanId!==plan.executionPlanId||preflight.provider!==m.provider||preflight.accountId!==m.accountId||preflight.status!=='PASS_FOR_HUMAN_APPROVAL'||preflight.canSubmitOrders||preflight.canAuthorizeLive)throw new Error('MONEY_AUTO_PREFLIGHT_INVALID')
  if(input.permitExpiresAt>m.expiresAt||input.permitExpiresAt>preflight.expiresAt||input.permitExpiresAt>authority.expiresAt||input.permitExpiresAt<=input.authorizedAt)throw new Error('MONEY_AUTO_PERMIT_WINDOW_INVALID')
  assertBrokerAccountEntitlement(entitlement,{userId:m.userId,provider:m.provider,accountId:m.accountId,capability:'money.trade.submit',now:input.authorizedAt})
  const action=actionFrom(request)
  const permit=issueActionCoreBoundExecutionPermit(request,action,authority,{expiresAt:input.permitExpiresAt,now:input.authorizedAt,opportunityId:i.opportunityId,riskDecisionId:risk.riskDecisionId,allocationDecisionId:i.allocationDecisionId,permitId:input.permitId,nonce:input.nonce})
  await input.permitStore.issue(permit)
  return Object.freeze({request,authority,permit,action,mandateId:m.mandateId,strategyId:i.strategyId,riskDecisionId:risk.riskDecisionId,allocationDecisionId:i.allocationDecisionId,approvalReceiptId:m.approvalReceiptId,mode:'LIVE_AUTONOMOUS',autonomous:true})
}

function permitView(pkg:AutonomousTradePermitPackage):MoneyExecutionPermit{return{permitId:pkg.permit.permitId,nonce:pkg.permit.nonce,authorityId:pkg.permit.binding.authorityId,actionRequestFingerprint:pkg.permit.binding.actionRequestFingerprint,policyVersion:pkg.permit.binding.policyVersion,policyHash:pkg.permit.binding.policyHash,approvalId:pkg.permit.binding.approvalId,opportunityId:pkg.permit.binding.opportunityId,riskDecisionId:pkg.permit.binding.riskDecisionId,allocationDecisionId:pkg.permit.binding.allocationDecisionId}}

function orderFrom(pkg:AutonomousTradePermitPackage,plan:ExecutionPlan,attempt:ExecutionAttempt):LiveBrokerOrderRequest{
  const slice=plan.slices[0];if(!slice)throw new Error('MONEY_AUTO_EXECUTION_SLICE_REQUIRED')
  return Object.freeze({clientOrderId:attempt.idempotencyKey,accountId:pkg.action.accountId!,instrumentId:pkg.action.instrumentId!,side:pkg.action.side!,orderType:'LIMIT',notionalMinor:pkg.action.amount,limitPriceMinor:slice.limitPriceMinor.toString(),currency:pkg.action.currency,timeInForce:'DAY'})
}

function eventFrom(input:{attempt:ExecutionAttempt;result?:LiveBrokerSubmissionResult;now:string}):ProviderExecutionEvent{
  const r=input.result
  return Object.freeze({eventId:r?.providerEventId??'auto-unknown:'+input.attempt.attemptId,providerEventId:r?.providerEventId??'unknown:'+input.attempt.attemptId,provider:input.attempt.provider,executionId:input.attempt.attemptId,actionFingerprint:input.attempt.actionFingerprint,providerReference:r?.providerReference,state:r?.state??'UNKNOWN',occurredAt:r?.occurredAt??input.now,observedAt:r?.observedAt??input.now,receivedAt:r?.receivedAt??input.now,availableAt:r?.availableAt??input.now,sequence:1,evidenceIds:Object.freeze(r?.evidenceIds??['auto-provider-unknown:'+input.attempt.attemptId]),payloadHash:hash(r??{unknown:true}),provenanceHash:hash({attempt:input.attempt.attemptId,result:r??null}),authority:'EVIDENCE_ONLY'})
}

function completedAttempt(a:ExecutionAttempt,state:'SUCCEEDED'|'FAILED'|'UNKNOWN',providerReference:string|undefined,completedAt:string,errorCode?:string):ExecutionAttempt{return Object.freeze({...a,state,providerReference,errorCode,recoveryRequired:state==='UNKNOWN',completedAt})}

export async function executeAutonomousLiveTrade(input:{
  adapter:ManualLiveBrokerAdapter
  permitStore:PermitStore
  attemptStore:ExecutionAttemptStore
  entitlementStore:BrokerAccountEntitlementStore
  canaryStore:LiveCanaryStateStore
  canaryPolicy:LiveCanaryPolicy
  mandate:AutonomousTradingMandate
  package:AutonomousTradePermitPackage
  plan:ExecutionPlan
  now:string
  commandId?:string
  attemptIdFactory?:()=>string
}):Promise<AutonomousLiveExecutionResult>{
  const {mandate:m,package:pkg,plan}=input
  assertAutonomousMandateActive(m,input.now)
  if(pkg.mode!=='LIVE_AUTONOMOUS'||!pkg.autonomous||pkg.mandateId!==m.mandateId||pkg.request.approvalReceiptId!==m.approvalReceiptId)throw new Error('MONEY_AUTO_PACKAGE_INVALID')
  if(input.adapter.environment!=='LIVE'||input.adapter.provider!==m.provider)throw new Error('MONEY_AUTO_ADAPTER_BINDING_MISMATCH')
  await requireBrokerAccountEntitlement(input.entitlementStore,{userId:m.userId,provider:m.provider,accountId:m.accountId,capability:'money.trade.submit',now:input.now})
  const tradingDate=day(input.now)
  const reserved=await input.canaryStore.reserve({provider:m.provider,accountId:m.accountId,tradingDate,currency:plan.notional.currency,notionalMinor:plan.notional.minor,side:plan.side,policy:input.canaryPolicy,now:input.now})
  if(!reserved.allowed)throw new Error('MONEY_AUTO_CANARY_BLOCK:'+reserved.reasonCodes.join(','))
  const attempt=createExecutionAttempt({attemptId:input.attemptIdFactory?.()??randomUUID(),requestId:pkg.request.id,permitId:pkg.permit.permitId,action:pkg.action,operation:'money.trade.submit',now:input.now})
  try{
    await authorizeAndConsumeMoneyPermit(input.permitStore,permitView(pkg),pkg.request,pkg.action,input.now)
    await input.attemptStore.start(attempt)
    const result=await input.adapter.submitOrder(Object.freeze({environment:'LIVE',executionMode:'AUTONOMOUS',executionId:attempt.attemptId,idempotencyKey:attempt.idempotencyKey,actionFingerprint:attempt.actionFingerprint,permitId:pkg.permit.permitId,userId:m.userId,autonomousCommandId:input.commandId??'auto-command:'+pkg.request.id,mandateId:m.mandateId,now:input.now}),orderFrom(pkg,plan,attempt))
    const providerEvent=eventFrom({attempt,result,now:input.now})
    if(result.state==='UNKNOWN'){await input.attemptStore.complete(attempt.attemptId,{state:'UNKNOWN',providerReference:result.providerReference,errorCode:'MONEY_PROVIDER_OUTCOME_UNKNOWN',recoveryRequired:true},input.now);await input.canaryStore.markUnknown(m.provider,m.accountId,tradingDate,attempt.attemptId,input.now);return Object.freeze({attempt:completedAttempt(attempt,'UNKNOWN',result.providerReference,input.now,'MONEY_PROVIDER_OUTCOME_UNKNOWN'),providerEvent,providerReference:result.providerReference,state:'UNKNOWN',reservation:reserved.reservation,tradingDate,retryAllowed:false,authority:'AUTONOMOUS_LIVE_EXECUTION',autonomous:true})}
    if(result.state==='REJECTED'){await input.attemptStore.complete(attempt.attemptId,{state:'FAILED',providerReference:result.providerReference,errorCode:'MONEY_PROVIDER_REJECTED',recoveryRequired:false},input.now);return Object.freeze({attempt:completedAttempt(attempt,'FAILED',result.providerReference,input.now,'MONEY_PROVIDER_REJECTED'),providerEvent,providerReference:result.providerReference,state:'REJECTED',reservation:reserved.reservation,tradingDate,retryAllowed:false,authority:'AUTONOMOUS_LIVE_EXECUTION',autonomous:true})}
    await input.attemptStore.complete(attempt.attemptId,{state:'SUCCEEDED',providerReference:result.providerReference,recoveryRequired:false},input.now)
    return Object.freeze({attempt:completedAttempt(attempt,'SUCCEEDED',result.providerReference,input.now),providerEvent,providerReference:result.providerReference,state:'SUBMITTED',reservation:reserved.reservation,tradingDate,retryAllowed:false,authority:'AUTONOMOUS_LIVE_EXECUTION',autonomous:true})
  }catch(error){await input.canaryStore.release(reserved.reservation,input.now);throw error}
}

export function certifyMoneyAuto(input:{cases:readonly AutonomousCertificationCase[]}):AutonomousCertificationReport{
  const required=['explicit-mandate-approval','action-core-child-authority','mandate-expiry-revocation','instrument-strategy-allowlists','order-daily-loss-exposure-limits','drawdown-leverage-confidence-veto','opening-short-policy','paper-shadow-promotion-is-review-only','single-use-child-permit','provider-account-entitlement','unknown-execution-block','kill-switch-halts-permits','manual-mode-preserved','model-cannot-mutate-hard-limits','cross-domain-learning-no-authority']
  const passedNames=new Set(input.cases.filter(x=>x.passed).map(x=>x.name)),passed=required.every(x=>passedNames.has(x))&&input.cases.every(x=>x.passed)
  return Object.freeze({reportId:'money-auto-final:'+hash({cases:input.cases,required}),cases:Object.freeze([...input.cases]),passed,mode:'LIVE_AUTONOMOUS',authority:'CERTIFICATION_ONLY',autonomousTradingEnabled:passed,hardRiskLimitsMutableByModel:false})
}
