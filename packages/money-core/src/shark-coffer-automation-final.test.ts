import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adaptPurseRebalanceIntentToCanonical,
  buildPurseAutonomousTradeIntent,
} from './purse-autonomous-bridge.js'
import {planExecution} from './execution-planning-engine.js'
import type {ExecutionMarketSnapshot,ExecutionRouteSnapshot} from './execution-planning-contracts.js'
import type {LiveExecutionPreflight} from './live-preflight-contracts.js'
import type {AutonomousTradingMandate} from './autonomous-trading-contracts.js'
import type {JhadinaPurseCharter} from './jhadina-purse-charter.js'
import type {PurseDecisionSet} from './purse-decision-engine.js'
import type {PurseOpportunityEnvelope} from './purse-opportunity-bus.js'
import type {PurseRebalancePlan} from './purse-rebalancer.js'

const now='2026-10-03T05:02:00Z'
const charter:JhadinaPurseCharter={
  charterId:'charter:1',charterVersion:'v1',userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',autonomyMode:'LIVE_GOVERNED_INTENTS',
  maxTotalDeployableBps:5000,minLiquidReserveMinor:10000n,minEmergencyReserveMinor:5000n,maxSingleOpportunityBps:1500,maxCorrelatedExposureBps:2500,maxRebalanceTurnoverBps:5000,
  lanePolicies:[{lane:'MEME',enabled:true,maxAllocationBps:2000,maxSinglePositionBps:1500,minConfidenceBps:6500}],
  verifiedOwnerPayoutDestinationId:'owner:bank',ownerProfitSweepProtected:true,charterMutationRequiresOwnerApproval:true,ownerDestinationMutationRequiresOwnerApproval:true,
  jhadinaMayAllocate:true,jhadinaMayRebalance:true,effectiveAt:'2026-10-03T04:00:00Z',evidenceIds:['charter:e1'],authority:'OWNER_TREASURY_CHARTER',canExecute:false,
}
const opportunityEnvelope=(status:'PASS'|'REVIEW'='PASS'):PurseOpportunityEnvelope=>({
  busEventId:'bus:1',charterId:charter.charterId,admitted:status==='PASS',reasonCodes:status==='PASS'?[]:['MIMS_PASS_REQUIRED_FOR_LIVE'],ingestedAt:'2026-10-03T05:00:04Z',
  authority:'OPPORTUNITY_BUS_ONLY',canExecute:false,
  opportunity:{
    opportunityId:'purse-shark:1',sourceId:'assessment:1',sourceKind:'SHARK',lane:'MEME',strategyId:'MIGRATION_CONFIRM',instrumentId:'meme:solana:TOKEN',action:'ENTER',
    thesis:'Verified migration candidate.',horizon:'INTRADAY',expectedNetEdgeBps:1500,expectedDownsideBps:800,confidenceBps:7200,evidenceQualityBps:8000,liquidityBps:7500,
    minimumCapitalMinor:1000n,maximumCapitalMinor:5000n,correlationGroupIds:['pump-migration'],observedAt:'2026-10-03T05:00:02Z',availableAt:'2026-10-03T05:00:03Z',expiresAt:'2026-10-03T05:10:00Z',
    evidenceIds:['shark:e1','mims:trade:1','money-validation:1'],provenanceHash:'opportunity:prov',
    governance:{mimsStage:'TRADE',mimsVoteId:'mims:trade:1',mimsStatus:status,mimsReasonCodes:[],sourceAssessmentId:'assessment:1',moneyOpportunityId:'money-opp:1',unresolvedContradictionCount:0,liveEligible:status==='PASS',evidenceIds:['mims:trade:1','money-validation:1'],authority:'GOVERNANCE_EVIDENCE_ONLY',canExecute:false},
    authority:'INTELLIGENCE_ONLY',canExecute:false,
  },
})
const decisionSet:PurseDecisionSet={
  decisionSetId:'decision-set:1',planId:'allocation-plan:1',charterId:charter.charterId,decidedAt:'2026-10-03T05:00:20Z',authority:'PURSE_DECISION_SET_ONLY',canExecute:false,
  allocations:[{
    decisionId:'purse-decision:1',planId:'allocation-plan:1',charterId:charter.charterId,opportunityId:'purse-shark:1',lane:'MEME',strategyId:'MIGRATION_CONFIRM',instrumentId:'meme:solana:TOKEN',
    decision:'ALLOCATE',amountMinor:5000n,reportingCurrency:'USD',thesis:'Verified migration candidate.',why:'Cleared governed allocation.',
    expectedNetEdgeBps:1500,expectedDownsideBps:800,confidenceBps:7200,scoreBps:6000,reasonCodes:['WITHIN_CHARTER_LIMITS'],
    evidenceIds:['shark:e1','mims:trade:1','money-validation:1'],decidedAt:'2026-10-03T05:00:20Z',expiresAt:'2026-10-03T05:10:00Z',
    authority:'PURSE_DECISION_ONLY',financialAuthority:'NONE',requiresDownstreamRiskAndAuthority:true,canExecute:false,
  }],
  cash:{decisionId:'cash:1',planId:'allocation-plan:1',charterId:charter.charterId,decision:'KEEP_CASH',amountMinor:95000n,reportingCurrency:'USD',why:'Optionality.',reasonCodes:['OPTIONALITY_PRESERVED'],decidedAt:'2026-10-03T05:00:20Z',authority:'PURSE_DECISION_ONLY',financialAuthority:'NONE',canExecute:false},
}
const rebalancePlan:PurseRebalancePlan={
  rebalancePlanId:'rebalance-plan:1',charterId:charter.charterId,decisionSetId:decisionSet.decisionSetId,portfolioSnapshotId:'portfolio:1',reportingCurrency:'USD',
  intents:[{
    intentId:'purse-rebalance:1',charterId:charter.charterId,decisionSetId:decisionSet.decisionSetId,lane:'MEME',strategyId:'MIGRATION_CONFIRM',instrumentId:'meme:solana:TOKEN',
    action:'INCREASE',currentValueMinor:0n,targetValueMinor:5000n,notionalMinor:5000n,reportingCurrency:'USD',reasonCodes:['PURSE_ALLOCATION_DECISION'],
    evidenceIds:['shark:e1','mims:trade:1','money-validation:1'],createdAt:'2026-10-03T05:00:30Z',expiresAt:'2026-10-03T05:10:00Z',
    authority:'PURSE_REBALANCE_INTENT_ONLY',financialAuthority:'NONE',requiresDownstreamRiskAndAuthority:true,canExecute:false,
  }],
  turnoverMinor:5000n,turnoverBps:500,cashTargetMinor:95000n,createdAt:'2026-10-03T05:00:30Z',expiresAt:'2026-10-03T05:10:00Z',
  evidenceIds:['rebalance:e1'],authority:'PURSE_REBALANCE_PLAN_ONLY',canExecute:false,requiresDownstreamRiskAndAuthority:true,
}
const purseIntent=rebalancePlan.intents[0]!
const mandate:AutonomousTradingMandate={
  mandateId:'mandate:1',userId:'u1',provider:'coffer-dex',accountId:'coffer:execution',currency:'USD',mode:'LIVE_AUTONOMOUS',
  allowedInstrumentPrefixes:['meme:solana:'],allowedStrategyIds:['MIGRATION_CONFIRM'],allowOpeningShorts:false,
  limits:{maxOrderNotionalMinor:10000n,maxDailySubmittedNotionalMinor:50000n,maxDailyOrders:10,maxDailyRealizedLossMinor:10000n,maxGrossExposureMinor:50000n,maxDrawdownBps:3000,maxLeverageBps:10000,minModelConfidenceBps:6500},
  startsAt:'2026-10-03T04:00:00Z',expiresAt:'2026-10-03T06:00:00Z',approvalReceiptId:'approval:mandate',actionCoreAuthorityId:'authority:mandate',policyVersion:'v1',policyHash:'policy:1',
  evidenceIds:['mandate:e1'],status:'ACTIVE',activatedAt:'2026-10-03T04:00:00Z',authority:'USER_APPROVED_MANDATE',canAuthorizeTrade:false,
}
const market:ExecutionMarketSnapshot={
  snapshotId:'market:1',instrumentId:'meme:solana:TOKEN',currency:'USD',bidMinor:99n,askMinor:100n,bidSize:'1000',askSize:'1000',visibleDepthNotionalMinor:100000n,
  observedAt:'2026-10-03T05:01:00Z',availableAt:'2026-10-03T05:01:01Z',expiresAt:'2026-10-03T05:05:00Z',evidenceIds:['market:e1'],provenanceHash:'market:prov',
}
const route:ExecutionRouteSnapshot={
  routeId:'route:1',provider:'coffer-dex',venue:'pumpswap',instrumentId:'meme:solana:TOKEN',status:'ACCEPTING',observedAt:'2026-10-03T05:01:00Z',availableAt:'2026-10-03T05:01:01Z',evidenceIds:['route:e1'],provenanceHash:'route:prov',
}

function prepared(){
  const canonical=adaptPurseRebalanceIntentToCanonical({rebalancePlan,purseIntent})
  const plan=planExecution({
    intent:canonical,portfolioPlanId:rebalancePlan.rebalancePlanId,market,route,informationCutoff:'2026-10-03T05:01:02Z',expiresAt:'2026-10-03T05:05:00Z',
    urgency:'HIGH',maxSpreadBps:200,maxParticipationBps:10000,sliceCount:1,
  })
  const preflight:LiveExecutionPreflight={
    preflightId:'live-preflight:1',executionPlanId:plan.executionPlanId,provider:mandate.provider,accountId:mandate.accountId,status:'PASS_FOR_HUMAN_APPROVAL',reasonCodes:[],
    accountCapabilitySnapshotId:'cap:1',routeSnapshotId:route.routeId,marketSnapshotId:market.snapshotId,shadowCertificationReportId:'shadow:cert',
    checkedAt:'2026-10-03T05:01:30Z',expiresAt:'2026-10-03T05:04:30Z',inputHash:'preflight:input',provenanceHash:'preflight:prov',
    authority:'PREFLIGHT_ONLY',requiresHumanApproval:true,canSubmitOrders:false,canAuthorizeLive:false,
  }
  return {canonical,plan,preflight}
}

test('SHARK-COFFER-AUTO.1 canonicalizes Purse allocation into Money execution planning without authority',()=>{
  const canonical=adaptPurseRebalanceIntentToCanonical({rebalancePlan,purseIntent})
  assert.equal(canonical.side,'BUY')
  assert.equal(canonical.notional.minor,5000n)
  assert.equal(canonical.planId,rebalancePlan.rebalancePlanId)
  assert.equal(canonical.authority,'NONE')
})

test('SHARK-COFFER-AUTO.2 MIMS PASS + Money plan/preflight + active mandate produce only a non-authorizing autonomous intent',()=>{
  const {canonical,plan,preflight}=prepared()
  const intent=buildPurseAutonomousTradeIntent({
    charter,opportunityEnvelope:opportunityEnvelope('PASS'),decisionSet,rebalancePlan,purseIntent,canonicalIntent:canonical,mandate,executionPlan:plan,preflight,decidedAt:now,
  })
  assert.equal(intent.opportunityId,'purse-shark:1')
  assert.equal(intent.allocationDecisionId,'purse-decision:1')
  assert.equal(intent.executionPlanId,plan.executionPlanId)
  assert.equal(intent.preflightId,preflight.preflightId)
  assert.equal(intent.side,'BUY')
  assert.equal(intent.canExecute,false)
  assert.equal(intent.authority,'INTELLIGENCE_ONLY')
})

test('SHARK-COFFER-AUTO.3 REVIEW or non-live-eligible SHARK governance cannot reach autonomous intent creation',()=>{
  const {canonical,plan,preflight}=prepared()
  assert.throws(()=>buildPurseAutonomousTradeIntent({
    charter,opportunityEnvelope:opportunityEnvelope('REVIEW'),decisionSet,rebalancePlan,purseIntent,canonicalIntent:canonical,mandate,executionPlan:plan,preflight,decidedAt:now,
  }),/OPPORTUNITY_NOT_ADMITTED|MIMS_LIVE_GATE/)
})

test('SHARK-COFFER-AUTO.4 execution plan, mandate and allocation mismatches fail closed',()=>{
  const {canonical,plan,preflight}=prepared()
  assert.throws(()=>buildPurseAutonomousTradeIntent({
    charter,opportunityEnvelope:opportunityEnvelope('PASS'),decisionSet,rebalancePlan,purseIntent,canonicalIntent:canonical,
    mandate:{...mandate,allowedStrategyIds:['OTHER']},executionPlan:plan,preflight,decidedAt:now,
  }),/STRATEGY_NOT_MANDATED/)
  assert.throws(()=>buildPurseAutonomousTradeIntent({
    charter,opportunityEnvelope:opportunityEnvelope('PASS'),decisionSet,rebalancePlan,purseIntent,canonicalIntent:canonical,mandate,
    executionPlan:{...plan,notional:{minor:4999n,currency:'USD'}},preflight,decidedAt:now,
  }),/EXECUTION_PLAN_ECONOMICS_MISMATCH/)
})
