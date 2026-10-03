import {
  adaptPurseRebalanceIntentToCanonical,
  buildPurseAutonomousTradeIntent,
} from './purse-autonomous-bridge.js'
import {planExecution,preflightExecution} from './execution-planning-engine.js'
import {preflightLiveExecution} from './live-preflight-engine.js'
import type {
  ExecutionMarketSnapshot,
  ExecutionRouteSnapshot,
  ExecutionUrgency,
} from './execution-planning-contracts.js'
import type {
  BrokerAccountCapabilitySnapshot,
} from './live-preflight-contracts.js'
import type {
  ShadowCertificationReport,
  ShadowReadinessAssessment,
} from './shadow-market-contracts.js'
import type {AutonomousTradingMandate,AutonomousTradeIntent} from './autonomous-trading-contracts.js'
import type {JhadinaPurseCharter} from './jhadina-purse-charter.js'
import type {PurseDecisionSet} from './purse-decision-engine.js'
import type {PurseOpportunityEnvelope} from './purse-opportunity-bus.js'
import type {PurseRebalanceIntent,PurseRebalancePlan} from './purse-rebalancer.js'

export type SharkCofferExecutionPolicy=Readonly<{
  urgency:ExecutionUrgency
  maxSpreadBps:number
  maxParticipationBps:number
  sliceCount:number
  preflightExpiresAt:string
  authority:'EXECUTION_POLICY_ONLY'
  canExecute:false
}>

export type SharkCofferExecutionEvidence=Readonly<{
  evidenceId:string
  market:ExecutionMarketSnapshot
  route:ExecutionRouteSnapshot
  account:BrokerAccountCapabilitySnapshot
  shadow:ShadowReadinessAssessment
  shadowCertification:ShadowCertificationReport
  mandate:AutonomousTradingMandate
  policy:SharkCofferExecutionPolicy
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
  source:string
  authority:'EXECUTION_EVIDENCE_ONLY'
  canExecute:false
}>

export type SharkCofferExecutionPackage=Readonly<{
  canonicalIntent:ReturnType<typeof adaptPurseRebalanceIntentToCanonical>
  executionPlan:ReturnType<typeof planExecution>
  executionPreflight:ReturnType<typeof preflightExecution>
  livePreflight:ReturnType<typeof preflightLiveExecution>
  autonomousIntent?:AutonomousTradeIntent
  disposition:'AUTONOMOUS_INTENT_READY'|'PREFLIGHT_BLOCKED'
  reasonCodes:readonly string[]
  authority:'EXECUTION_PACKAGE_ONLY'
  canExecute:false
}>

const validIso=(value:string)=>!Number.isNaN(Date.parse(value))
const bps=(value:number,code:string)=>{if(!Number.isInteger(value)||value<0||value>10000)throw new Error(code)}

export function assertSharkCofferExecutionEvidence(
  evidence:SharkCofferExecutionEvidence,
  now:string,
):void{
  if(
    !evidence.evidenceId.trim()||
    !evidence.source.trim()||
    !evidence.evidenceIds.length||
    evidence.authority!=='EXECUTION_EVIDENCE_ONLY'||
    evidence.canExecute!==false
  )throw new Error('SHARK_COFFER_EXECUTION_EVIDENCE_INVALID')
  if(!validIso(evidence.observedAt)||!validIso(evidence.availableAt)||evidence.availableAt<evidence.observedAt||evidence.availableAt>now)throw new Error('SHARK_COFFER_EXECUTION_EVIDENCE_TIME_INVALID')
  if(evidence.policy.authority!=='EXECUTION_POLICY_ONLY'||evidence.policy.canExecute!==false)throw new Error('SHARK_COFFER_EXECUTION_POLICY_AUTHORITY_INVALID')
  bps(evidence.policy.maxSpreadBps,'SHARK_COFFER_EXECUTION_SPREAD')
  bps(evidence.policy.maxParticipationBps,'SHARK_COFFER_EXECUTION_PARTICIPATION')
  if(!Number.isInteger(evidence.policy.sliceCount)||evidence.policy.sliceCount<1||evidence.policy.sliceCount>100)throw new Error('SHARK_COFFER_EXECUTION_SLICE_COUNT_INVALID')
  if(!validIso(evidence.policy.preflightExpiresAt)||evidence.policy.preflightExpiresAt<=now)throw new Error('SHARK_COFFER_EXECUTION_PREFLIGHT_WINDOW_INVALID')
  if(evidence.market.instrumentId!==evidence.route.instrumentId)throw new Error('SHARK_COFFER_EXECUTION_MARKET_ROUTE_INSTRUMENT_MISMATCH')
  if(evidence.market.availableAt>now||evidence.route.availableAt>now||evidence.account.availableAt>now)throw new Error('SHARK_COFFER_EXECUTION_FUTURE_EVIDENCE')
  if(evidence.mandate.authority!=='USER_APPROVED_MANDATE'||evidence.mandate.canAuthorizeTrade!==false)throw new Error('SHARK_COFFER_EXECUTION_MANDATE_AUTHORITY_INVALID')
}

export function buildSharkCofferExecutionPackage(input:Readonly<{
  charter:JhadinaPurseCharter
  opportunityEnvelope:PurseOpportunityEnvelope
  decisionSet:PurseDecisionSet
  rebalancePlan:PurseRebalancePlan
  purseIntent:PurseRebalanceIntent
  evidence:SharkCofferExecutionEvidence
  decidedAt:string
}>):SharkCofferExecutionPackage{
  assertSharkCofferExecutionEvidence(input.evidence,input.decidedAt)
  const canonicalIntent=adaptPurseRebalanceIntentToCanonical({
    rebalancePlan:input.rebalancePlan,
    purseIntent:input.purseIntent,
  })
  const planExpiresAt=
    input.purseIntent.expiresAt<input.evidence.market.expiresAt
      ?input.purseIntent.expiresAt
      :input.evidence.market.expiresAt
  if(planExpiresAt<=input.decidedAt)throw new Error('SHARK_COFFER_EXECUTION_PLAN_WINDOW_INVALID')
  const executionPlan=planExecution({
    intent:canonicalIntent,
    portfolioPlanId:input.rebalancePlan.rebalancePlanId,
    market:input.evidence.market,
    route:input.evidence.route,
    informationCutoff:input.decidedAt,
    expiresAt:planExpiresAt,
    urgency:input.evidence.policy.urgency,
    maxSpreadBps:input.evidence.policy.maxSpreadBps,
    maxParticipationBps:input.evidence.policy.maxParticipationBps,
    sliceCount:input.evidence.policy.sliceCount,
  })
  const executionPreflight=preflightExecution({
    plan:executionPlan,
    market:input.evidence.market,
    route:input.evidence.route,
    checkedAt:input.decidedAt,
  })
  const livePreflight=preflightLiveExecution({
    plan:executionPlan,
    market:input.evidence.market,
    route:input.evidence.route,
    executionPreflight,
    account:input.evidence.account,
    shadow:input.evidence.shadow,
    shadowCertification:input.evidence.shadowCertification,
    provider:input.evidence.mandate.provider,
    accountId:input.evidence.mandate.accountId,
    checkedAt:input.decidedAt,
    expiresAt:
      input.evidence.policy.preflightExpiresAt<planExpiresAt
        ?input.evidence.policy.preflightExpiresAt
        :planExpiresAt,
  })
  if(livePreflight.status!=='PASS_FOR_HUMAN_APPROVAL'){
    return Object.freeze({
      canonicalIntent,
      executionPlan,
      executionPreflight,
      livePreflight,
      disposition:'PREFLIGHT_BLOCKED',
      reasonCodes:Object.freeze([...livePreflight.reasonCodes]),
      authority:'EXECUTION_PACKAGE_ONLY',
      canExecute:false,
    })
  }
  const autonomousIntent=buildPurseAutonomousTradeIntent({
    charter:input.charter,
    opportunityEnvelope:input.opportunityEnvelope,
    decisionSet:input.decisionSet,
    rebalancePlan:input.rebalancePlan,
    purseIntent:input.purseIntent,
    canonicalIntent,
    mandate:input.evidence.mandate,
    executionPlan,
    preflight:livePreflight,
    decidedAt:input.decidedAt,
  })
  return Object.freeze({
    canonicalIntent,
    executionPlan,
    executionPreflight,
    livePreflight,
    autonomousIntent,
    disposition:'AUTONOMOUS_INTENT_READY',
    reasonCodes:Object.freeze([]),
    authority:'EXECUTION_PACKAGE_ONLY',
    canExecute:false,
  })
}
