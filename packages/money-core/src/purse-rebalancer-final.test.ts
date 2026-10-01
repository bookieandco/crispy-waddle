import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCofferTreasurySnapshot, type CofferAssetBalanceEvidence } from './coffer-treasury-contracts.js'
import { buildPurseCharterBoundary, type JhadinaPurseCharter } from './jhadina-purse-charter.js'
import { ingestPurseOpportunity, type PurseOpportunity } from './purse-opportunity-bus.js'
import { allocatePurseCapital, type PurseAllocatorCapitalEvidence, type PurseExposureEvidence } from './purse-capital-allocator.js'
import { buildPurseDecisionSet } from './purse-decision-engine.js'
import { buildPursePortfolioSnapshot, type PurseAccountSnapshot, type PurseLedgerEntry, type PursePositionSnapshot } from './purse-portfolio.js'
import { buildPurseLiquiditySnapshot, type PurseLiquidityObligations } from './purse-liquidity.js'
import { adaptPositionManagementToPurseDirective, buildPurseRebalancePlan } from './purse-rebalancer.js'
import type { PositionManagementDecision } from './position-management.js'
import type { StrategyCalibration } from './autonomous-strategy-learning.js'
import type { PersonalityState } from '@jhadina/core-spine'
import {
 adaptPaperCalibrationToPurseMemory,
 adaptPurseOutcomeToLearningMemory,
 adaptSharkClosedTradeToPurseMemory,
 buildPurseStrategyLearningProfile,
 createPurseOutcomeLearningRecord,
 derivePurseDecisionStyle,
} from './purse-learning-personality.js'

const now='2026-10-01T05:00:00.000Z'
const later='2026-10-01T05:30:00.000Z'

const charter: JhadinaPurseCharter=Object.freeze({
 charterId:'purse-charter:1',charterVersion:'v1',userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',autonomyMode:'LIVE_GOVERNED_INTENTS',
 maxTotalDeployableBps:7000,minLiquidReserveMinor:20000n,minEmergencyReserveMinor:10000n,maxSingleOpportunityBps:4000,maxCorrelatedExposureBps:5000,maxRebalanceTurnoverBps:8000,
 lanePolicies:Object.freeze([
  {lane:'MEME',enabled:true,maxAllocationBps:2500,maxSinglePositionBps:1500,minConfidenceBps:6500},
  {lane:'CRYPTO',enabled:true,maxAllocationBps:3000,maxSinglePositionBps:2000,minConfidenceBps:6000},
  {lane:'SPORTS',enabled:true,maxAllocationBps:3000,maxSinglePositionBps:2000,minConfidenceBps:6500},
  {lane:'STOCK',enabled:true,maxAllocationBps:5000,maxSinglePositionBps:3000,minConfidenceBps:6000},
  {lane:'FOREX',enabled:true,maxAllocationBps:2500,maxSinglePositionBps:1500,minConfidenceBps:6500},
  {lane:'PREDICTION',enabled:true,maxAllocationBps:2000,maxSinglePositionBps:1000,minConfidenceBps:7000},
  {lane:'METALS',enabled:true,maxAllocationBps:2500,maxSinglePositionBps:1500,minConfidenceBps:6000},
 ] as const),
 verifiedOwnerPayoutDestinationId:'owner-bank:1',ownerProfitSweepProtected:true,charterMutationRequiresOwnerApproval:true,ownerDestinationMutationRequiresOwnerApproval:true,
 jhadinaMayAllocate:true,jhadinaMayRebalance:true,effectiveAt:'2026-10-01T00:00:00.000Z',evidenceIds:Object.freeze(['owner:approved-charter']),
 authority:'OWNER_TREASURY_CHARTER',canExecute:false,
})

const treasuryBalance:CofferAssetBalanceEvidence=Object.freeze({
 balanceId:'treasury:usd',cofferId:'coffer:1',userId:'u1',custodyId:'coffer:cash',custodyKind:'COFFER_CASH',provider:'money-core',
 assetId:'USD',assetKind:'FIAT',amountAtomic:100000n,decimals:2,reportingCurrency:'USD',reportingValueMinor:100000n,reservedReportingValueMinor:5000n,
 observedAt:now,evidenceIds:Object.freeze(['treasury:e']),authority:'TREASURY_BALANCE_EVIDENCE',canMoveMoney:false,
})
const treasury=buildCofferTreasurySnapshot({cofferId:'coffer:1',userId:'u1',reportingCurrency:'USD',balances:[treasuryBalance],observedAt:now})
const capital:PurseAllocatorCapitalEvidence=Object.freeze({
 capitalSnapshotId:'capital:1',cofferId:'coffer:1',userId:'u1',reportingCurrency:'USD',availableLiquidityMinor:60000n,observedAt:now,
 evidenceIds:Object.freeze(['liquidity:e']),authority:'CAPITAL_EVIDENCE',
})
const stockExposure:PurseExposureEvidence=Object.freeze({
 exposureId:'exp:stock',lane:'STOCK',strategyId:'stock-core',instrumentId:'AAPL',reportingValueMinor:20000n,correlationGroupIds:Object.freeze(['US_MEGA_CAP']),
 observedAt:now,evidenceIds:Object.freeze(['exp:e']),authority:'EXPOSURE_EVIDENCE',
})

const opportunity=(o:Partial<PurseOpportunity>={}):PurseOpportunity=>Object.freeze({
 opportunityId:'opp:stock',sourceId:'source:stock',sourceKind:'STOCK',lane:'STOCK',strategyId:'stock-core',instrumentId:'MSFT',action:'ENTER',
 thesis:'Fresh evidence supports a risk-adjusted allocation.',horizon:'SHORT',expectedNetEdgeBps:900,expectedDownsideBps:500,confidenceBps:8000,evidenceQualityBps:8500,liquidityBps:9500,
 minimumCapitalMinor:1000n,maximumCapitalMinor:30000n,correlationGroupIds:Object.freeze(['US_MEGA_CAP']),observedAt:'2026-10-01T04:55:00.000Z',
 availableAt:'2026-10-01T04:56:00.000Z',expiresAt:'2026-10-01T06:00:00.000Z',evidenceIds:Object.freeze(['opp:e']),
 provenanceHash:'prov:stock',authority:'INTELLIGENCE_ONLY',canExecute:false,...o,
})

test('JHADINA-PURSE.1 charter makes owner boundaries non-self-modifiable',()=>{
 const boundary=buildPurseCharterBoundary(charter,now)
 assert.equal(boundary.canChangeOwnCharter,false)
 assert.equal(boundary.canChangeOwnerDestination,false)
 assert.equal(boundary.canDisableOwnerSweep,false)
 assert.equal(boundary.ownerPayoutDestinationId,'owner-bank:1')
 assert.equal(boundary.canExecute,false)
})

test('PURSE-OPPORTUNITY-BUS.FINAL admits evidence-backed lanes and rejects weak confidence',()=>{
 const good=ingestPurseOpportunity({charter,opportunity:opportunity(),ingestedAt:now})
 assert.equal(good.admitted,true)
 const weak=ingestPurseOpportunity({charter,opportunity:opportunity({opportunityId:'opp:weak',confidenceBps:1000,provenanceHash:'prov:weak'}),ingestedAt:now})
 assert.equal(weak.admitted,false)
 assert.ok(weak.reasonCodes.includes('CONFIDENCE_BELOW_LANE_FLOOR'))
})

test('PURSE-DECISION-ENGINE.FINAL allocates across lanes without breaching reserve, lane or correlation caps',()=>{
 const stock=ingestPurseOpportunity({charter,opportunity:opportunity(),ingestedAt:now})
 const sports=ingestPurseOpportunity({charter,opportunity:opportunity({
  opportunityId:'opp:sports',sourceId:'source:sports',sourceKind:'SPORTS',lane:'SPORTS',strategyId:'sports-core',instrumentId:'NBA:GAME:1',action:'BET',
  expectedNetEdgeBps:1100,expectedDownsideBps:700,confidenceBps:8200,evidenceQualityBps:8000,liquidityBps:8000,maximumCapitalMinor:20000n,
  correlationGroupIds:['NBA:GAME:1'],provenanceHash:'prov:sports',
 }),ingestedAt:now})
 const plan=allocatePurseCapital({charter,treasury,capital,opportunities:[stock,sports],currentExposures:[stockExposure],informationCutoff:now,expiresAt:later})
 assert.equal(plan.maximumDeployableMinor,70000n)
 assert.equal(plan.currentExposureMinor,20000n)
 assert.equal(plan.incrementalCapacityMinor,50000n)
 assert.equal(plan.allocatedIncrementMinor,50000n)
 assert.equal(plan.canExecute,false)
 const decisions=buildPurseDecisionSet({charter,plan,opportunities:[stock,sports],decidedAt:'2026-10-01T05:05:00.000Z'})
 assert.equal(decisions.allocations.length,2)
 assert.ok(decisions.allocations.every(x=>x.financialAuthority==='NONE'&&x.canExecute===false))
 assert.ok(decisions.allocations.every(x=>x.why.includes('expected net edge')))
})

const cashAccount:PurseAccountSnapshot=Object.freeze({
 accountId:'cash:1',provider:'bank',kind:'CASH',nativeCurrency:'USD',nativeBalanceMinor:80000n,reportingCurrency:'USD',reportingValueMinor:80000n,
 liquidReportingValueMinor:80000n,unsettledReportingValueMinor:5000n,reservedReportingValueMinor:10000n,observedAt:now,evidenceIds:Object.freeze(['cash:e']),
 valueBasis:'CASH_AND_NONPOSITION_ONLY',authority:'ACCOUNT_EVIDENCE',
})
const brokerageCash:PurseAccountSnapshot=Object.freeze({
 accountId:'broker:1',provider:'broker',kind:'BROKERAGE',nativeCurrency:'USD',nativeBalanceMinor:20000n,reportingCurrency:'USD',reportingValueMinor:20000n,
 liquidReportingValueMinor:20000n,unsettledReportingValueMinor:0n,reservedReportingValueMinor:0n,observedAt:now,evidenceIds:Object.freeze(['broker:e']),
 valueBasis:'CASH_AND_NONPOSITION_ONLY',authority:'ACCOUNT_EVIDENCE',
})
const stockPosition:PursePositionSnapshot=Object.freeze({
 positionId:'pos:stock',accountId:'broker:1',lane:'STOCK',strategyId:'stock-core',instrumentId:'AAPL',reportingCurrency:'USD',
 marketValueMinor:20000n,executableExitValueMinor:19500n,costBasisMinor:18000n,unrealizedPnlMinor:2000n,correlationGroupIds:Object.freeze(['US_MEGA_CAP']),
 observedAt:now,evidenceIds:Object.freeze(['position:stock:e']),authority:'POSITION_EVIDENCE',
})
const cryptoPosition:PursePositionSnapshot=Object.freeze({
 positionId:'pos:crypto',accountId:'broker:1',lane:'CRYPTO',strategyId:'crypto-core',instrumentId:'SOL',reportingCurrency:'USD',
 marketValueMinor:10000n,executableExitValueMinor:9700n,costBasisMinor:12000n,unrealizedPnlMinor:-2000n,correlationGroupIds:Object.freeze(['CRYPTO_BETA']),
 observedAt:now,evidenceIds:Object.freeze(['position:crypto:e']),authority:'POSITION_EVIDENCE',
})
const valuation:PurseLedgerEntry=Object.freeze({
 entryId:'ledger:valuation',accountId:'broker:1',kind:'VALUATION',nativeCurrency:'USD',nativeAmountMinor:5000n,reportingCurrency:'USD',reportingAmountMinor:5000n,
 cashImpactMinor:0n,realizedPnlImpactMinor:0n,valuationImpactMinor:5000n,occurredAt:now,reconciled:true,evidenceIds:Object.freeze(['valuation:e']),authority:'LEDGER_EVIDENCE',
})
const realized:PurseLedgerEntry=Object.freeze({
 entryId:'ledger:pnl',accountId:'broker:1',kind:'REALIZED_PNL',nativeCurrency:'USD',nativeAmountMinor:1200n,reportingCurrency:'USD',reportingAmountMinor:1200n,
 cashImpactMinor:1200n,realizedPnlImpactMinor:1200n,valuationImpactMinor:0n,occurredAt:now,reconciled:true,evidenceIds:Object.freeze(['pnl:e']),authority:'LEDGER_EVIDENCE',
})

test('PURSE-PORTFOLIO.FINAL separates cash, holdings, valuation changes and realized pnl',()=>{
 const portfolio=buildPursePortfolioSnapshot({userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',accounts:[cashAccount,brokerageCash],positions:[stockPosition,cryptoPosition],ledgerEntries:[valuation,realized],observedAt:now})
 assert.equal(portfolio.totalAccountValueMinor,100000n)
 assert.equal(portfolio.totalPositionValueMinor,30000n)
 assert.equal(portfolio.realizedPnlMinor,1200n)
 assert.equal(portfolio.unrealizedPnlMinor,0n)
 assert.throws(()=>buildPursePortfolioSnapshot({
  userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',accounts:[cashAccount],positions:[],
  ledgerEntries:[Object.freeze({...valuation,entryId:'bad:valuation',accountId:'cash:1',cashImpactMinor:100n})],observedAt:now,
 }),/NONCASH_ENTRY_CANNOT_CREATE_CASH_OR_REALIZED_PNL/)
})

test('PURSE-LIQUIDITY.FINAL never treats unsettled, reserved, owner-sweep or protected reserves as allocatable',()=>{
 const portfolio=buildPursePortfolioSnapshot({userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',accounts:[cashAccount,brokerageCash],positions:[stockPosition,cryptoPosition],ledgerEntries:[valuation,realized],observedAt:now})
 const obligations:PurseLiquidityObligations=Object.freeze({
  pendingWithdrawalsMinor:0n,pendingFeesMinor:5000n,pendingTaxReserveMinor:0n,ownerSweepHoldMinor:10000n,chainFeeReserveMinor:0n,otherRestrictedMinor:0n,
  evidenceIds:Object.freeze(['obligations:e']),authority:'LIQUIDITY_OBLIGATION_EVIDENCE',
 })
 const liquidity=buildPurseLiquiditySnapshot({charter,portfolio,obligations,observedAt:now})
 assert.equal(liquidity.grossLiquidMinor,100000n)
 assert.equal(liquidity.availableToAllocateMinor,40000n)
 assert.equal(liquidity.ownerSweepHoldMinor,10000n)
 assert.equal(liquidity.canExecute,false)
})

test('PURSE-REBALANCER.FINAL combines new allocation decisions with risk-driven exits without gaining execution authority',()=>{
 const stock=ingestPurseOpportunity({charter,opportunity:opportunity(),ingestedAt:now})
 const sports=ingestPurseOpportunity({charter,opportunity:opportunity({
  opportunityId:'opp:sports2',sourceId:'source:sports2',sourceKind:'SPORTS',lane:'SPORTS',strategyId:'sports-core',instrumentId:'NBA:GAME:2',action:'BET',
  expectedNetEdgeBps:1200,expectedDownsideBps:600,confidenceBps:8500,evidenceQualityBps:8500,liquidityBps:8500,maximumCapitalMinor:20000n,
  correlationGroupIds:['NBA:GAME:2'],provenanceHash:'prov:sports2',
 }),ingestedAt:now})
 const plan=allocatePurseCapital({charter,treasury,capital,opportunities:[stock,sports],currentExposures:[stockExposure],informationCutoff:now,expiresAt:later})
 const decisions=buildPurseDecisionSet({charter,plan,opportunities:[stock,sports],decidedAt:'2026-10-01T05:05:00.000Z'})
 const portfolio=buildPursePortfolioSnapshot({userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',accounts:[cashAccount,brokerageCash],positions:[stockPosition,cryptoPosition],ledgerEntries:[valuation,realized],observedAt:now})
 const management:PositionManagementDecision=Object.freeze({
  decisionId:'position-review:crypto',positionId:'pos:crypto',domain:'CRYPTO',instrumentId:'SOL',action:'EXIT',automationDisposition:'LIVE_INTENT_CANDIDATE',
  winning:false,edgeAfterCostsBps:-700,pros:Object.freeze([]),cons:Object.freeze(['Thesis invalidated.']),reasonCodes:Object.freeze(['THESIS_EXPLICITLY_INVALIDATED']),
  alphaRouteIds:Object.freeze([]),evidenceIds:Object.freeze(['position-review:e']),evaluatedAt:now,authority:'INTELLIGENCE_ONLY',financialAuthority:'NONE',
  requiresDownstreamRiskAndAuthority:true,canExecute:false,
 })
 const directive=adaptPositionManagementToPurseDirective({decision:management,position:cryptoPosition,strategyId:'crypto-core',observedAt:now})
 const rebalance=buildPurseRebalancePlan({charter,decisions,portfolio,riskDirectives:[directive],createdAt:'2026-10-01T05:10:00.000Z',expiresAt:later})
 assert.ok(rebalance.intents.some(x=>x.action==='EXIT'&&x.instrumentId==='SOL'))
 assert.ok(rebalance.intents.some(x=>x.action==='INCREASE'))
 assert.equal(rebalance.canExecute,false)
 assert.ok(rebalance.intents.every(x=>x.financialAuthority==='NONE'&&x.requiresDownstreamRiskAndAuthority===true&&x.canExecute===false))
})


test('PURSE-LEARNING-BRIDGE uses paper calibration and SHARK review as learning-only evidence',()=>{
 const calibration:StrategyCalibration=Object.freeze({
  calibrationId:'cal:stock',domain:'STOCK',strategyId:'stock-core',sampleSize:30,meanReturnBps:240,downsideRateBps:3200,meanFillRateBps:9400,
  meanAbsSlippageBps:40,meanOutcomeScore:.15,evidenceStrength:.9,status:'SIMULATION_SUPPORTED',recommendedConfidenceBps:7800,
  learningRecordIds:Object.freeze(['paper:l1','paper:l2']),calibratedAt:now,authority:'LEARNING_ONLY',canAuthorizeLive:false,
 })
 const paper=adaptPaperCalibrationToPurseMemory(calibration)
 const shark=adaptSharkClosedTradeToPurseMemory(Object.freeze({
  learningRecordId:'shark:review:1',strategyId:'shark-scalp',instrumentId:'solana:token:1',realized:Object.freeze({netReturnBps:-250}),
  execution:Object.freeze({diagnosis:'WORSE_THAN_MODELED' as const}),sizing:Object.freeze({diagnosis:'OVER_SIZED' as const}),
  narrative:Object.freeze({held:false}),lessonTags:Object.freeze(['NET_LOSS','NARRATIVE_FAILED_OR_DEGRADED']),
  evidenceIds:Object.freeze(['shark:e1']),createdAt:now,authority:'LEARNING_ONLY' as const,financialAuthority:'NONE' as const,canExecute:false as const,
 }))
 assert.equal(paper.source,'PAPER_STRATEGY')
 assert.equal(paper.lane,'STOCK')
 assert.equal(paper.canAuthorizeLive,false)
 assert.equal(shark.source,'SHARK_CLOSED_TRADE')
 assert.equal(shark.lane,'MEME')
 assert.ok(shark.sizeMultiplierBps<10000)
 assert.equal(shark.canAuthorizeLive,false)
})

test('Purse allocation consumes learning memory and personality only as bounded evidence',()=>{
 const calibration:StrategyCalibration=Object.freeze({
  calibrationId:'cal:stock2',domain:'STOCK',strategyId:'stock-core',sampleSize:30,meanReturnBps:300,downsideRateBps:3000,meanFillRateBps:9500,
  meanAbsSlippageBps:30,meanOutcomeScore:.2,evidenceStrength:.95,status:'SIMULATION_SUPPORTED',recommendedConfidenceBps:8000,
  learningRecordIds:Object.freeze(['paper:stock:1','paper:stock:2']),calibratedAt:now,authority:'LEARNING_ONLY',canAuthorizeLive:false,
 })
 const memory=adaptPaperCalibrationToPurseMemory(calibration)
 const profile=buildPurseStrategyLearningProfile({lane:'STOCK',strategyId:'stock-core',memories:[memory],evaluatedAt:now})
 const personality:PersonalityState={
  version:4,
  traits:[{
   id:'trait:money:concentration',statement:'prefers disciplined concentration limits',sourcePatternId:'personality-signal:money:concentration-discipline',
   dimension:'temperament',confidence:1,stability:1,evidence:[{id:'personality:e1',source:'memory',observedAt:now,summary:'Approved stable finance decision-style evidence.',immutable:true}],
   contradictions:[],status:'accepted',firstObservedAt:now,lastObservedAt:now,revision:0,
  }],
  independentAssessmentRequired:false,
  updatedAt:now,
 }
 const style=derivePurseDecisionStyle(personality)
 const stock=ingestPurseOpportunity({charter,opportunity:opportunity(),ingestedAt:now})
 const baseline=allocatePurseCapital({charter,treasury,capital,opportunities:[stock],currentExposures:[stockExposure],informationCutoff:now,expiresAt:later})
 const learned=allocatePurseCapital({charter,treasury,capital,opportunities:[stock],currentExposures:[stockExposure],learningProfiles:[profile],decisionStyle:style,informationCutoff:now,expiresAt:later})
 assert.equal(style.canRelaxCharter,false)
 assert.equal(style.canAuthorizeLive,false)
 assert.equal(learned.learningProfileIds[0],profile.profileId)
 assert.equal(learned.decisionStyleId,style.styleId)
 assert.ok(learned.targets[0]!.targetIncrementMinor<=baseline.targets[0]!.targetIncrementMinor)
 assert.ok(learned.targets[0]!.effectiveConfidenceBps>=stock.opportunity.confidenceBps)
 assert.ok(learned.targets[0]!.sizeMultiplierBps<=10000)
 assert.equal(learned.canExecute,false)
})

test('A rejected paper calibration blocks the strategy rather than letting personality override it',()=>{
 const rejectedCalibration:StrategyCalibration=Object.freeze({
  calibrationId:'cal:rejected',domain:'STOCK',strategyId:'stock-core',sampleSize:40,meanReturnBps:-800,downsideRateBps:8000,meanFillRateBps:9000,
  meanAbsSlippageBps:100,meanOutcomeScore:-.4,evidenceStrength:.95,status:'SIMULATION_REJECTED',recommendedConfidenceBps:null,
  learningRecordIds:Object.freeze(['paper:bad:1']),calibratedAt:now,authority:'LEARNING_ONLY',canAuthorizeLive:false,
 })
 const profile=buildPurseStrategyLearningProfile({lane:'STOCK',strategyId:'stock-core',memories:[adaptPaperCalibrationToPurseMemory(rejectedCalibration)],evaluatedAt:now})
 const personality:PersonalityState={version:1,traits:[],independentAssessmentRequired:false,updatedAt:now}
 const style=derivePurseDecisionStyle(personality)
 const stock=ingestPurseOpportunity({charter,opportunity:opportunity(),ingestedAt:now})
 const plan=allocatePurseCapital({charter,treasury,capital,opportunities:[stock],currentExposures:[stockExposure],learningProfiles:[profile],decisionStyle:style,informationCutoff:now,expiresAt:later})
 assert.equal(profile.status,'REJECTED')
 assert.equal(plan.targets.length,0)
 assert.ok(plan.rejectedOpportunityIds.includes(stock.opportunity.opportunityId))
})

test('Purse decisions feed realized outcomes back into learning memory without gaining live authority',()=>{
 const outcome=createPurseOutcomeLearningRecord({
  decisionId:'purse-decision:closed:1',lane:'SPORTS',strategyId:'sports-core',instrumentId:'NBA:GAME:9',allocatedMinor:5000n,
  realizedReturnBps:-600,maxAdverseExcursionBps:-900,thesisHeld:false,evidenceIds:['settlement:e1'],evaluatedAt:later,
 })
 const memory=adaptPurseOutcomeToLearningMemory(outcome)
 const profile=buildPurseStrategyLearningProfile({lane:'SPORTS',strategyId:'sports-core',memories:[memory],evaluatedAt:later})
 assert.ok(outcome.decisionQualityScoreBps<0)
 assert.ok(outcome.lessonTags.includes('THESIS_FAILED_OR_DEGRADED'))
 assert.ok(memory.sizeMultiplierBps<10000)
 assert.equal(profile.canAuthorizeLive,false)
})
