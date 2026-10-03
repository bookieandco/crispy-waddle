import {createHash} from 'node:crypto'
import type {ExecutionPlan} from './execution-planning-contracts.js'
import type {LiveExecutionPreflight} from './live-preflight-contracts.js'
import {
  assertAutonomousIntent,
  assertAutonomousMandateActive,
  type AutonomousTradeIntent,
  type AutonomousTradingMandate,
} from './autonomous-trading-contracts.js'
import type {RebalanceIntent} from './portfolio-construction-contracts.js'
import type {JhadinaPurseCharter} from './jhadina-purse-charter.js'
import {assertJhadinaPurseCharter} from './jhadina-purse-charter.js'
import type {PurseDecisionSet,PurseCapitalDecision} from './purse-decision-engine.js'
import type {PurseOpportunityEnvelope} from './purse-opportunity-bus.js'
import type {PurseRebalanceIntent,PurseRebalancePlan} from './purse-rebalancer.js'

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const unique=(values:readonly string[])=>Object.freeze([...new Set(values)].sort())
const validIso=(value:string)=>!Number.isNaN(Date.parse(value))

function allocationFor(
  decisionSet:PurseDecisionSet,
  opportunityId:string,
):PurseCapitalDecision{
  const rows=decisionSet.allocations.filter(x=>x.opportunityId===opportunityId)
  if(rows.length!==1)throw new Error('PURSE_AUTO_ALLOCATION_DECISION_REQUIRED')
  return rows[0]!
}

export function adaptPurseRebalanceIntentToCanonical(input:Readonly<{
  rebalancePlan:PurseRebalancePlan
  purseIntent:PurseRebalanceIntent
}>):RebalanceIntent{
  const {rebalancePlan:plan,purseIntent:intent}=input
  if(plan.authority!=='PURSE_REBALANCE_PLAN_ONLY'||plan.canExecute!==false||plan.requiresDownstreamRiskAndAuthority!==true)throw new Error('PURSE_AUTO_REBALANCE_PLAN_AUTHORITY_INVALID')
  if(intent.authority!=='PURSE_REBALANCE_INTENT_ONLY'||intent.financialAuthority!=='NONE'||intent.canExecute!==false||intent.requiresDownstreamRiskAndAuthority!==true)throw new Error('PURSE_AUTO_REBALANCE_INTENT_AUTHORITY_INVALID')
  if(!plan.intents.some(x=>x.intentId===intent.intentId))throw new Error('PURSE_AUTO_REBALANCE_INTENT_NOT_IN_PLAN')
  if(intent.charterId!==plan.charterId||intent.decisionSetId!==plan.decisionSetId)throw new Error('PURSE_AUTO_REBALANCE_BINDING_MISMATCH')
  if(intent.notionalMinor<=0n||intent.action==='HOLD')throw new Error('PURSE_AUTO_REBALANCE_NOT_EXECUTABLE')
  const side=intent.action==='INCREASE'?'BUY':'SELL'
  const canonical:RebalanceIntent=Object.freeze({
    intentId:'canonical-purse-rebalance:'+hash({
      rebalancePlanId:plan.rebalancePlanId,
      purseIntentId:intent.intentId,
      instrumentId:intent.instrumentId,
      side,
      notionalMinor:intent.notionalMinor,
      currency:intent.reportingCurrency,
    }),
    planId:plan.rebalancePlanId,
    instrumentId:intent.instrumentId,
    side,
    notional:Object.freeze({minor:intent.notionalMinor,currency:intent.reportingCurrency}),
    reasonCodes:unique([...intent.reasonCodes,'PURSE_CANONICAL_EXECUTION_ADAPTER']),
    authority:'NONE',
  })
  return canonical
}

/**
 * Converts a fully planned/preflighted Purse allocation into the existing
 * AutonomousTradeIntent contract. This adapter grants no authority: the
 * autonomous engine must still independently verify the mandate, risk veto,
 * Action Core child authority, account entitlement, permit and canary limits.
 */
export function buildPurseAutonomousTradeIntent(input:Readonly<{
  charter:JhadinaPurseCharter
  opportunityEnvelope:PurseOpportunityEnvelope
  decisionSet:PurseDecisionSet
  rebalancePlan:PurseRebalancePlan
  purseIntent:PurseRebalanceIntent
  canonicalIntent:RebalanceIntent
  mandate:AutonomousTradingMandate
  executionPlan:ExecutionPlan
  preflight:LiveExecutionPreflight
  decidedAt:string
}>):AutonomousTradeIntent{
  const {charter,opportunityEnvelope:env,decisionSet,rebalancePlan,purseIntent,canonicalIntent,mandate,executionPlan:plan,preflight}=input
  assertJhadinaPurseCharter(charter,input.decidedAt)
  if(charter.autonomyMode!=='LIVE_GOVERNED_INTENTS')throw new Error('PURSE_AUTO_LIVE_GOVERNED_CHARTER_REQUIRED')
  if(env.authority!=='OPPORTUNITY_BUS_ONLY'||env.canExecute!==false||!env.admitted)throw new Error('PURSE_AUTO_OPPORTUNITY_NOT_ADMITTED')
  if(env.charterId!==charter.charterId)throw new Error('PURSE_AUTO_OPPORTUNITY_CHARTER_MISMATCH')
  if(env.opportunity.sourceKind!=='SHARK'||env.opportunity.lane!=='MEME')throw new Error('PURSE_AUTO_SHARK_MEME_OPPORTUNITY_REQUIRED')
  const governance=env.opportunity.governance
  if(!governance||governance.mimsStage!=='TRADE'||governance.mimsStatus!=='PASS'||governance.liveEligible!==true||governance.unresolvedContradictionCount!==0)throw new Error('PURSE_AUTO_SHARK_MIMS_LIVE_GATE')
  if(governance.authority!=='GOVERNANCE_EVIDENCE_ONLY'||governance.canExecute!==false)throw new Error('PURSE_AUTO_SHARK_GOVERNANCE_AUTHORITY_INVALID')

  if(decisionSet.authority!=='PURSE_DECISION_SET_ONLY'||decisionSet.canExecute!==false||decisionSet.charterId!==charter.charterId)throw new Error('PURSE_AUTO_DECISION_SET_INVALID')
  if(rebalancePlan.decisionSetId!==decisionSet.decisionSetId||rebalancePlan.charterId!==charter.charterId)throw new Error('PURSE_AUTO_REBALANCE_DECISION_BINDING_MISMATCH')
  if(!rebalancePlan.intents.some(x=>x.intentId===purseIntent.intentId))throw new Error('PURSE_AUTO_REBALANCE_INTENT_MISSING')
  if(purseIntent.action!=='INCREASE'||purseIntent.lane!=='MEME')throw new Error('PURSE_AUTO_SHARK_ENTRY_INCREASE_ONLY')
  if(purseIntent.strategyId!==env.opportunity.strategyId||purseIntent.instrumentId!==env.opportunity.instrumentId)throw new Error('PURSE_AUTO_OPPORTUNITY_INTENT_MISMATCH')

  const allocation=allocationFor(decisionSet,env.opportunity.opportunityId)
  if(allocation.decision!=='ALLOCATE'||allocation.decisionId.trim()===''||allocation.amountMinor!==purseIntent.notionalMinor)throw new Error('PURSE_AUTO_ALLOCATION_BINDING_MISMATCH')
  if(allocation.strategyId!==purseIntent.strategyId||allocation.instrumentId!==purseIntent.instrumentId)throw new Error('PURSE_AUTO_ALLOCATION_INSTRUMENT_MISMATCH')
  if(allocation.requiresDownstreamRiskAndAuthority!==true||allocation.canExecute!==false||allocation.financialAuthority!=='NONE')throw new Error('PURSE_AUTO_ALLOCATION_AUTHORITY_INVALID')

  const expectedCanonical=adaptPurseRebalanceIntentToCanonical({rebalancePlan,purseIntent})
  if(
    canonicalIntent.intentId!==expectedCanonical.intentId||
    canonicalIntent.planId!==expectedCanonical.planId||
    canonicalIntent.instrumentId!==expectedCanonical.instrumentId||
    canonicalIntent.side!==expectedCanonical.side||
    canonicalIntent.notional.minor!==expectedCanonical.notional.minor||
    canonicalIntent.notional.currency!==expectedCanonical.notional.currency||
    canonicalIntent.authority!=='NONE'
  )throw new Error('PURSE_AUTO_CANONICAL_REBALANCE_MISMATCH')

  assertAutonomousMandateActive(mandate,input.decidedAt)
  if(mandate.currency!==purseIntent.reportingCurrency)throw new Error('PURSE_AUTO_MANDATE_CURRENCY_MISMATCH')
  if(!mandate.allowedStrategyIds.includes(purseIntent.strategyId))throw new Error('PURSE_AUTO_STRATEGY_NOT_MANDATED')
  if(!mandate.allowedInstrumentPrefixes.some(prefix=>purseIntent.instrumentId.startsWith(prefix)))throw new Error('PURSE_AUTO_INSTRUMENT_NOT_MANDATED')
  if(purseIntent.notionalMinor>mandate.limits.maxOrderNotionalMinor)throw new Error('PURSE_AUTO_ORDER_EXCEEDS_MANDATE')
  if(allocation.confidenceBps<mandate.limits.minModelConfidenceBps)throw new Error('PURSE_AUTO_CONFIDENCE_BELOW_MANDATE')

  if(plan.authority!=='ANALYSIS_ONLY'||plan.requiresHumanApproval!==true)throw new Error('PURSE_AUTO_EXECUTION_PLAN_GOVERNANCE_INVALID')
  if(plan.rebalanceIntentId!==canonicalIntent.intentId||plan.portfolioPlanId!==rebalancePlan.rebalancePlanId)throw new Error('PURSE_AUTO_EXECUTION_PLAN_LINEAGE_MISMATCH')
  if(plan.instrumentId!==purseIntent.instrumentId||plan.side!=='BUY'||plan.notional.minor!==purseIntent.notionalMinor||plan.notional.currency!==purseIntent.reportingCurrency)throw new Error('PURSE_AUTO_EXECUTION_PLAN_ECONOMICS_MISMATCH')
  if(!plan.slices.length||plan.slices.some(slice=>slice.limitPriceMinor<=0n))throw new Error('PURSE_AUTO_EXECUTION_PRICE_REQUIRED')

  if(
    preflight.authority!=='PREFLIGHT_ONLY'||
    preflight.status!=='PASS_FOR_HUMAN_APPROVAL'||
    preflight.canSubmitOrders!==false||
    preflight.canAuthorizeLive!==false||
    preflight.executionPlanId!==plan.executionPlanId||
    preflight.provider!==mandate.provider||
    preflight.accountId!==mandate.accountId
  )throw new Error('PURSE_AUTO_PREFLIGHT_INVALID')
  const decidedAtMs=Date.parse(input.decidedAt)
  if(
    !validIso(input.decidedAt)||
    decidedAtMs<Date.parse(preflight.checkedAt)||
    decidedAtMs>=Date.parse(preflight.expiresAt)||
    decidedAtMs>=Date.parse(plan.expiresAt)||
    decidedAtMs>=Date.parse(purseIntent.expiresAt)
  )throw new Error('PURSE_AUTO_DECISION_WINDOW_INVALID')

  const firstSlice=plan.slices[0]!
  const evidenceIds=unique([
    ...env.opportunity.evidenceIds,
    ...governance.evidenceIds,
    ...allocation.evidenceIds,
    ...purseIntent.evidenceIds,
    ...rebalancePlan.evidenceIds,
    ...mandate.evidenceIds,
    'execution-plan:'+plan.executionPlanId,
    'live-preflight:'+preflight.preflightId,
  ])

  const intent:AutonomousTradeIntent=Object.freeze({
    intentId:'purse-autonomous-intent:'+hash({
      purseIntentId:purseIntent.intentId,
      allocationDecisionId:allocation.decisionId,
      opportunityId:env.opportunity.opportunityId,
      mandateId:mandate.mandateId,
      executionPlanId:plan.executionPlanId,
      preflightId:preflight.preflightId,
      decidedAt:input.decidedAt,
    }),
    mandateId:mandate.mandateId,
    strategyId:purseIntent.strategyId,
    instrumentId:purseIntent.instrumentId,
    side:'BUY',
    opensShort:false,
    notionalMinor:purseIntent.notionalMinor,
    currency:purseIntent.reportingCurrency,
    limitPriceMinor:firstSlice.limitPriceMinor,
    modelConfidenceBps:allocation.confidenceBps,
    opportunityId:env.opportunity.opportunityId,
    allocationDecisionId:allocation.decisionId,
    executionPlanId:plan.executionPlanId,
    preflightId:preflight.preflightId,
    evidenceIds,
    decidedAt:input.decidedAt,
    authority:'INTELLIGENCE_ONLY',
    canExecute:false,
  })
  assertAutonomousIntent(intent)
  return intent
}
