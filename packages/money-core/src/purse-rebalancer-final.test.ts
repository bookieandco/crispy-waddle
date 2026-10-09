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
import {buildPurseProfitWaterfall, buildOwnerPaydayProposal} from './purse-profit-waterfall.js'
import {preparePurseUsdFunding,preparePursePhantomFunding,assessPurseFundingReadiness} from './purse-funding-contracts.js'
import {reviewPurseShadowEvidence} from './purse-shadow-evidence-admission.js'
import {buildAutonomousPursePaperCycle,recordAutonomousPursePaperCycle} from './purse-paper-autonomy.js'
import {PostgresPursePaperStore,fingerprintPursePaperCycle} from './postgres-purse-paper-store.js'
import {comparePursePaperLearning} from './purse-paper-learning-evaluation.js'
import {reconcilePursePaperPayday} from './purse-paper-payday-reconciliation.js'
import {reviewPursePaperCertification} from './purse-auto-paper-certification.js'
import type {PursePaperCycle} from './purse-paper-autonomy.js'
import type {PurseProfitWaterfall} from './purse-profit-waterfall.js'
import type {SqlClient} from './postgres-idempotency-store.js'
import type {CofferPolicy, CofferAccountingSnapshot} from './coffer-accountant.js'
import type { StrategyCalibration } from './autonomous-strategy-learning.js'
import type { PersonalityState } from '@jhadina/core-spine'
import {
 adaptPaperCalibrationToPurseMemory,
 adaptPurseOutcomeToLearningMemory,
 assemblePurseLearningContext,
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


test('Purse learning context composes paper, SHARK and governed personality into allocator inputs',()=>{
 const calibration:StrategyCalibration=Object.freeze({
  calibrationId:'cal:compose',domain:'STOCK',strategyId:'stock-core',sampleSize:25,meanReturnBps:220,downsideRateBps:3600,meanFillRateBps:9300,
  meanAbsSlippageBps:35,meanOutcomeScore:.12,evidenceStrength:.88,status:'SIMULATION_SUPPORTED',recommendedConfidenceBps:7600,
  learningRecordIds:Object.freeze(['paper:compose:1']),calibratedAt:now,authority:'LEARNING_ONLY',canAuthorizeLive:false,
 })
 const personality:PersonalityState={
  version:7,
  traits:[{
   id:'trait:money:patience',statement:'prefers patient capital decisions',sourcePatternId:'personality-signal:money:patience',
   dimension:'temperament',confidence:.95,stability:.9,evidence:[{id:'personality:patience:e1',source:'memory',observedAt:now,summary:'Approved stable patience evidence.',immutable:true}],
   contradictions:[],status:'accepted',firstObservedAt:now,lastObservedAt:now,revision:1,
  }],
  independentAssessmentRequired:false,
  updatedAt:now,
 }
 const shark=Object.freeze({
  learningRecordId:'shark:compose:1',strategyId:'shark-scalp',instrumentId:'solana:token:compose',realized:Object.freeze({netReturnBps:420}),
  execution:Object.freeze({diagnosis:'AS_MODELED' as const}),sizing:Object.freeze({diagnosis:'APPROPRIATE' as const}),
  narrative:Object.freeze({held:true}),lessonTags:Object.freeze(['NET_PROFITABLE']),evidenceIds:Object.freeze(['shark:compose:e1']),
  createdAt:now,authority:'LEARNING_ONLY' as const,financialAuthority:'NONE' as const,canExecute:false as const,
 })
 const context=assemblePurseLearningContext({paperCalibrations:[calibration],sharkClosedTrades:[shark],personality,evaluatedAt:now})
 assert.equal(context.authority,'LEARNING_CONTEXT_ONLY')
 assert.equal(context.canAuthorizeLive,false)
 assert.equal(context.profiles.length,2)
 assert.ok(context.profiles.some(x=>x.lane==='STOCK'&&x.strategyId==='stock-core'))
 assert.ok(context.profiles.some(x=>x.lane==='MEME'&&x.strategyId==='shark-scalp'))
 assert.ok(context.decisionStyle.patienceBiasBps>0)
 const stock=ingestPurseOpportunity({charter,opportunity:opportunity(),ingestedAt:now})
 const plan=allocatePurseCapital({
  charter,treasury,capital,opportunities:[stock],currentExposures:[stockExposure],
  learningProfiles:context.profiles,decisionStyle:context.decisionStyle,informationCutoff:now,expiresAt:later,
 })
 assert.equal(plan.learningProfileIds.length,1)
 assert.equal(plan.decisionStyleId,context.decisionStyle.styleId)
 assert.equal(plan.canExecute,false)
})

test('PURSE-FINISH P0 rejects replayed account, position and ledger IDs before summing money',()=>{
 const args={userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',observedAt:now}
 assert.throws(()=>buildPursePortfolioSnapshot({...args,accounts:[cashAccount,cashAccount],positions:[]}),/PURSE_DUPLICATE_ACCOUNT_ID/)
 assert.throws(()=>buildPursePortfolioSnapshot({...args,accounts:[cashAccount,brokerageCash],positions:[stockPosition,stockPosition]}),/PURSE_DUPLICATE_POSITION_ID/)
 assert.throws(()=>buildPursePortfolioSnapshot({...args,accounts:[cashAccount,brokerageCash],positions:[],ledgerEntries:[realized,realized]}),/PURSE_DUPLICATE_LEDGER_ENTRY_ID/)
 const first=buildPursePortfolioSnapshot({...args,accounts:[cashAccount,brokerageCash],positions:[stockPosition],ledgerEntries:[realized]})
 const corrected=buildPursePortfolioSnapshot({...args,accounts:[cashAccount,brokerageCash],positions:[stockPosition],ledgerEntries:[{...realized,realizedPnlImpactMinor:1100n}]})
 assert.notEqual(first.snapshotId,corrected.snapshotId)
})

test('PURSE-FINISH P0 aggregates pre-existing and newly allocated exposure per instrument',()=>{
 const first=ingestPurseOpportunity({charter,opportunity:opportunity({instrumentId:'AAPL'}),ingestedAt:now})
 const second=ingestPurseOpportunity({charter,opportunity:opportunity({opportunityId:'opp:stock:2',instrumentId:'AAPL',provenanceHash:'prov:stock:2'}),ingestedAt:now})
 const plan=allocatePurseCapital({charter,treasury,capital,opportunities:[first,second],currentExposures:[stockExposure],informationCutoff:now,expiresAt:later})
 const combined=plan.targets.reduce((sum,x)=>sum+x.targetIncrementMinor,0n)
 assert.ok(combined<=10000n) // 30% of 100,000 total, minus 20,000 already in AAPL
 assert.ok(plan.targets.every(x=>x.canExecute===false))
 assert.throws(()=>allocatePurseCapital({charter,treasury,capital,opportunities:[first,first],currentExposures:[stockExposure],informationCutoff:now,expiresAt:later}),/PURSE_DUPLICATE_OPPORTUNITY_ID/)
 assert.throws(()=>allocatePurseCapital({charter,treasury,capital,opportunities:[first],currentExposures:[stockExposure,stockExposure],informationCutoff:now,expiresAt:later}),/PURSE_DUPLICATE_EXPOSURE_ID/)
})

test('PURSE-FINISH P0 fails closed rather than guessing which account owns an increase',()=>{
 const stock=ingestPurseOpportunity({charter,opportunity:opportunity({instrumentId:'AAPL'}),ingestedAt:now})
 const plan=allocatePurseCapital({charter,treasury,capital,opportunities:[stock],currentExposures:[stockExposure],informationCutoff:now,expiresAt:later})
 const decisions=buildPurseDecisionSet({charter,plan,opportunities:[stock],decidedAt:'2026-10-01T05:05:00.000Z'})
 const other={...stockPosition,positionId:'pos:stock:other-account',accountId:'cash:1',marketValueMinor:5000n,executableExitValueMinor:4800n,costBasisMinor:4500n,unrealizedPnlMinor:500n,evidenceIds:['other-account:e']}
 const portfolio=buildPursePortfolioSnapshot({userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',accounts:[cashAccount,brokerageCash],positions:[stockPosition,other],observedAt:now})
 assert.throws(()=>buildPurseRebalancePlan({charter,decisions,portfolio,riskDirectives:[],createdAt:'2026-10-01T05:10:00.000Z',expiresAt:later}),/PURSE_REBALANCE_AMBIGUOUS_POSITION/)
})

test('PURSE-FINISH profit waterfall and owner payday remain non-executing, held and reconciliable',()=>{
 const portfolio=buildPursePortfolioSnapshot({userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',accounts:[cashAccount,brokerageCash],positions:[],observedAt:now})
 const makeLiquidity=(ownerSweepHoldMinor:bigint)=>buildPurseLiquiditySnapshot({charter,portfolio,obligations:{
  pendingWithdrawalsMinor:0n,pendingFeesMinor:0n,pendingTaxReserveMinor:0n,ownerSweepHoldMinor,chainFeeReserveMinor:0n,otherRestrictedMinor:0n,
  evidenceIds:['owner-hold:e'],authority:'LIQUIDITY_OBLIGATION_EVIDENCE',
 },observedAt:now})
 const policy:CofferPolicy={
  policyId:'coffer:policy:1',currency:'USD',principalCapitalMinor:100000n,hardStopFloorMinor:10000n,survivalFloorMinor:20000n,defensiveFloorMinor:30000n,maxDeployableBps:5000,
  profitSweepThresholdMinor:2000n,profitRetainMinor:5000n,planningReserveBps:1000,autoSweepEnabled:true,
  verifiedOwnerDestinationId:charter.verifiedOwnerPayoutDestinationId,standingSweepMandateId:'paper:mandate:1',authority:'OWNER_POLICY',
 }
 const accounting:CofferAccountingSnapshot={
  cofferId:'coffer:1',currency:'USD',settledCashMinor:100000n,unsettledCashMinor:5000n,reservedCashMinor:10000n,realizedGrossProfitMinor:50000n,realizedCostsMinor:5000n,
  priorSweptProfitMinor:0n,observedAt:now,evidenceIds:['verified:coffer-accounting'],authority:'ACCOUNTING_EVIDENCE',
 }
 const waterfall=buildPurseProfitWaterfall({charter,policy,accounting,portfolio,liquidity:makeLiquidity(10000n),evaluatedAt:now})
 assert.equal(waterfall.status,'PAPER_READY')
 assert.equal(waterfall.proposedOwnerPaydayMinor,10000n)
 assert.equal(waterfall.canExecute,false)
 const payday=buildOwnerPaydayProposal({charter,waterfall,sourceAccount:'coffer:cash',destinationAccount:charter.verifiedOwnerPayoutDestinationId})
 assert.equal(payday.executionMode,'NON_EXECUTING')
 assert.equal(payday.canMoveMoney,false)
 assert.equal(payday.journal.canPost,false)
 assert.equal(payday.journal.lines.length,2)
 assert.equal(payday.amountMinor,10000n)
 assert.throws(()=>buildOwnerPaydayProposal({charter,waterfall,sourceAccount:'coffer:cash',destinationAccount:'attacker:account'}),/PURSE_PAYDAY_DESTINATION_UNVERIFIED/)
 assert.equal(buildPurseProfitWaterfall({charter,policy,accounting,portfolio,liquidity:makeLiquidity(0n),evaluatedAt:now}).status,'HOLD_NOT_FUNDED')
 const stale=buildPurseProfitWaterfall({charter,policy,accounting,portfolio,liquidity:makeLiquidity(10000n),evaluatedAt:'2026-10-01T05:30:00.000Z'})
 assert.equal(stale.status,'STALE_EVIDENCE')
 assert.equal(stale.proposedOwnerPaydayMinor,0n)
 assert.throws(()=>buildPurseProfitWaterfall({charter,policy:{...policy,verifiedOwnerDestinationId:'attacker:account'},accounting,portfolio,liquidity:makeLiquidity(10000n),evaluatedAt:now}),/PURSE_WATERFALL_OWNER_DESTINATION_MISMATCH/)
})

test('PURSE-FINISH withdrawal availability subtracts pending withdrawals before payday eligibility',()=>{
 const portfolio=buildPursePortfolioSnapshot({userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',accounts:[cashAccount,brokerageCash],positions:[],observedAt:now})
 const base={pendingFeesMinor:0n,pendingTaxReserveMinor:0n,ownerSweepHoldMinor:10000n,chainFeeReserveMinor:0n,otherRestrictedMinor:0n,evidenceIds:['withdrawal:hold:e'],authority:'LIQUIDITY_OBLIGATION_EVIDENCE' as const}
 const noPending=buildPurseLiquiditySnapshot({charter,portfolio,obligations:{...base,pendingWithdrawalsMinor:0n},observedAt:now})
 const pending=buildPurseLiquiditySnapshot({charter,portfolio,obligations:{...base,pendingWithdrawalsMinor:20000n},observedAt:now})
 assert.equal(pending.availableForWithdrawalMinor,noPending.availableForWithdrawalMinor-20000n)
 assert.equal(pending.availableToAllocateMinor,noPending.availableToAllocateMinor-20000n)
 assert.equal(pending.canExecute,false)
})

test('PURSE-AUTO.06 bank USD and Phantom owner funding remain proposals without any debit authority',()=>{
 const bank={destinationId:'bank:owner:1',ownerUserId:'u1',provider:'plaid',accountId:'bank:linked:1',currency:'USD',verified:true,kind:'BANK' as const,evidenceIds:['bank-ownership:1']}
 const coffer={destinationId:'coffer:coffer:1',ownerUserId:'u1',provider:'money-core',accountId:'coffer:1',currency:'USD',verified:true,kind:'BROKER_CASH' as const,evidenceIds:['coffer:owned:1']}
 const opts={userId:'u1',cofferId:'coffer:1',amountMinor:10000n,ownerBank:bank,cofferCash:coffer,requestedAt:now,requestId:'request:1'}
 const incoming=preparePurseUsdFunding({...opts,kind:'DEPOSIT'})
 const outgoing=preparePurseUsdFunding({...opts,kind:'WITHDRAWAL'})
 assert.equal(incoming.proposal.authority,'PROPOSAL_ONLY')
 assert.equal(incoming.proposal.canMoveMoney,false)
 assert.equal(incoming.proposal.sourceId,'bank:owner:1')
 assert.equal(outgoing.proposal.destinationId,'bank:owner:1')
 assert.equal(incoming.canExecute,false)
 assert.equal(preparePurseUsdFunding({...opts,kind:'DEPOSIT'}).proposal.movementId,incoming.proposal.movementId)
 assert.throws(()=>preparePurseUsdFunding({...opts,ownerBank:{...bank,ownerUserId:'someone-else'},kind:'DEPOSIT'}),/OWNER_UNVERIFIED/)
 const wallet={
  endpointId:'phantom:owner:1',userId:'u1',provider:'phantom',accountRef:'So1OwnerWallet',
  scope:'OWNER_EXTERNAL' as const,kind:'CRYPTO_WALLET' as const,supportedAssets:['SOL','USDC'],
  verified:true,evidenceIds:['wallet-ownership-proof:1'],authority:'TREASURY_ENDPOINT_EVIDENCE' as const,containsRawCredential:false as const,
 }
 const isolated={...wallet,endpointId:'coffer:isolated-wallet',provider:'coffer-signer',scope:'COFFER' as const,evidenceIds:['coffer:signer:1']}
 const cw={userId:'u1',cofferId:'coffer:1',kind:'DEPOSIT' as const,assetId:'USDC' as const,amountAtomic:1000000n,
  ownerPhantom:wallet,cofferWallet:isolated,requestedAt:now,requestId:'phantom-movement:1',ownershipReceiptId:'wallet-ownership-proof:1'}
 const crypto=preparePursePhantomFunding(cw)
 assert.equal(crypto.proposal.authority,'TREASURY_MOVEMENT_PROPOSAL_ONLY')
 assert.equal(crypto.canExecute,false)
 assert.equal(crypto.proposal.canExecute,false)
 assert.throws(()=>preparePursePhantomFunding({...cw,ownershipReceiptId:'unverified:fake'}),/OWNERSHIP_RECEIPT_REQUIRED/)
 assert.throws(()=>preparePursePhantomFunding({...cw,cofferWallet:{...isolated,userId:'other-user'}}),/ENDPOINT_INVALID/)
 const readiness=assessPurseFundingReadiness({linkedBankVisible:true,ownerBankPaymentVerified:false,fundingRailLiveCertified:false,
  phantomConnected:true,phantomSignatureVerified:false,cofferCryptoWalletReady:true,cryptoTransferProviderCommissioned:false})
 assert.equal(readiness.bankVisible,true)
 assert.equal(readiness.usdBankMovementReady,false)
 assert.equal(readiness.cryptoMovementReady,false)
 assert.ok(readiness.blockers.includes('PHANTOM_OWNERSHIP_SIGNATURE_REQUIRED'))
})

test('PURSE-AUTO.08 only compiles paper decisions behind a valid fenced lease and consistent money snapshot',async()=>{
 const paperCharter={...charter,autonomyMode:'PAPER_AUTONOMOUS' as const}
 const portfolio=buildPursePortfolioSnapshot({userId:'u1',cofferId:'coffer:1',reportingCurrency:'USD',accounts:[cashAccount,brokerageCash],positions:[stockPosition],observedAt:now})
 const liquidity=buildPurseLiquiditySnapshot({charter:paperCharter,portfolio,obligations:{
  pendingWithdrawalsMinor:0n,pendingFeesMinor:0n,pendingTaxReserveMinor:0n,ownerSweepHoldMinor:0n,chainFeeReserveMinor:0n,otherRestrictedMinor:0n,
  evidenceIds:['paper:obligations'],authority:'LIQUIDITY_OBLIGATION_EVIDENCE'},observedAt:now})
 const op=ingestPurseOpportunity({charter:paperCharter,opportunity:opportunity(),ingestedAt:now})
 const lease={workerId:'paper-worker:1',fencingToken:3,acquiredAt:now,expiresAt:'2026-10-01T06:00:00.000Z',
  evidenceIds:['durable-lease:3'],authority:'PAPER_LEASE_EVIDENCE_ONLY' as const}
 const shadowReview=reviewPurseShadowEvidence({userId:'u1',strategyId:'stock-core',cutoff:now,grades:[]})
 const input={charter:paperCharter,treasury,capital:{...capital,availableLiquidityMinor:30000n},portfolio,liquidity,
  opportunities:[op],exposures:[stockExposure],riskDirectives:[],learningProfiles:[],shadowReview,lease,
  informationCutoff:now,createdAt:'2026-10-01T05:05:00.000Z',expiresAt:later}
 const cycle=buildAutonomousPursePaperCycle(input)
 assert.equal(cycle.authority,'PAPER_CYCLE_ONLY')
 assert.ok(cycle.paperIntents.every(x=>x.canExecute===false&&x.canMoveMoney===false))
 assert.equal(cycle.canExecute,false)
 assert.equal(cycle.canSign,false)
 assert.equal(cycle.canBroadcast,false)
 assert.equal(buildAutonomousPursePaperCycle(input).cycleId,cycle.cycleId)
 assert.throws(()=>buildAutonomousPursePaperCycle({...input,charter}),/PAPER_MODE_ONLY/)
 assert.throws(()=>buildAutonomousPursePaperCycle({...input,lease:{...lease,fencingToken:0}}),/LEASE_INVALID/)
 assert.throws(()=>buildAutonomousPursePaperCycle({...input,capital}),/CAPITAL_EXCEEDS_AVAILABLE/)
 const stored=new Set<string>()
 const store={appendOnce:async (v:typeof cycle):Promise<'INSERTED'|'REPLAY'>=>{
  if(stored.has(v.cycleId))return 'REPLAY'
  stored.add(v.cycleId);return 'INSERTED'
 }}
 assert.equal(await recordAutonomousPursePaperCycle({cycle,store}),'INSERTED')
 assert.equal(await recordAutonomousPursePaperCycle({cycle,store}),'REPLAY')
})

test('PURSE-AUTO.07 admission keeps decision-based shadow learning behind provenance and PIT checks',()=>{
 // A minimal closed, already-observed decision grade can inform paper research only.
 const lesson={
  lessonId:'shadow-lesson:1',decisionId:'shadow-decision:1',userId:'u1',strategyId:'stock-core',instrumentId:'AAPL',
  horizon:'15M' as const,action:'PAPER_TRADE' as const,marketRegime:'RANGE',sourceGroups:['market'],
  confidenceBps:7000,underlyingReturnBps:150,decisionReturnBps:100,decisionQualityBps:100,avoidedLossBps:0,missedGainBps:0,
  executionCostBps:50,regretBps:0,confidenceErrorBps:500,timingDiagnosis:'GOOD_ENTRY' as const,thesisHeld:true,lessonTags:['DECISION_POSITIVE'],
  evaluatedAt:'2026-10-01T05:00:00.000Z',evidenceIds:['market:sample:1'],authority:'LEARNING_ONLY' as const,financialAuthority:'NONE' as const,
  canExecute:false as const,canAuthorizeLive:false as const,
 }
 const verified={lesson,decidedAt:'2026-10-01T04:30:00.000Z',availableAt:'2026-10-01T05:01:00.000Z',providerVerification:'VERIFIED' as const,verificationIds:['market:provider-readback:1']}
 const later={...verified,lesson:{...lesson,lessonId:'shadow-lesson:7d',horizon:'7D' as const,evaluatedAt:'2026-10-08T05:00:00.000Z'},availableAt:'2026-10-08T05:01:00.000Z'}
 const rejected={...verified,lesson:{...lesson,lessonId:'shadow-lesson:future',decisionId:'shadow-decision:2'},
   availableAt:'2026-10-10T04:46:00.000Z'}
 const result=reviewPurseShadowEvidence({userId:'u1',strategyId:'stock-core',cutoff:'2026-10-09T05:00:00.000Z',grades:[verified,later,rejected]})
 assert.equal(result.uniqueDecisions,1)
 assert.equal(result.eligible[0]?.lessonId,'shadow-lesson:7d')
 assert.equal(result.quarantined.length,1)
 assert.equal(result.canAuthorizeLive,false)
 const contradiction=reviewPurseShadowEvidence({userId:'u1',strategyId:'stock-core',cutoff:'2026-10-09T05:00:00.000Z',grades:[
  verified,{...verified,lesson:{...lesson,lessonId:'conflicting-15m'}}]})
 assert.equal(contradiction.uniqueDecisions,0)
 assert.equal(contradiction.quarantined[0]?.reason,'CONFLICTING_HORIZON_GRADE')
})

test('PURSE-AUTO.09 durable SQL store enforces fencing, exact economic replay and independent hash readback',async()=>{
 const cycle:PursePaperCycle={
  cycleId:'purse-paper-cycle:test',charterId:'purse-charter:1',portfolioSnapshotId:'portfolio:1',
  allocationPlanId:'alloc:1',decisionSetId:'dec:1',rebalancePlanId:'rebalance:1',
  workerId:'worker:1',leaseFencingToken:1,informationCutoff:now,createdAt:now,expiresAt:'2026-10-01T05:10:00.000Z',
  paperIntents:[],rejectedOpportunityIds:[],learningProfileIds:[],evidenceIds:['exchange:pit:1'],
  status:'PAPER_PLANNED',authority:'PAPER_CYCLE_ONLY',canExecute:false,canSign:false,canBroadcast:false,canMoveMoney:false,
 }
 let row:Record<string,unknown>|null=null
 let fence=1
 const sql:SqlClient={
  async query<T=Record<string,unknown>>(statement:string,params:readonly unknown[]=[]){
   let rows:unknown[]=[]
   if(statement.includes('INSERT INTO public.money_purse_paper_leases')){
    rows=[{charter_id:params[0],user_id:params[1],worker_id:params[2],fencing_token:fence,
      acquired_at:params[3],expires_at:params[4],evidence_ids:params[5]}]
   }else if(statement.includes('SELECT fencing_token FROM public.money_purse_paper_leases')){
    if(Number(params[3])===fence)rows=[{fencing_token:fence}]
   }else if(statement.includes('INSERT INTO public.money_purse_paper_cycles')){
    if(Number(params[4])===fence&&!row){
     row={cycle_id:params[0],user_id:params[2],worker_id:params[3],fencing_token:params[4],
      economic_sha256:params[5],payload_json:JSON.parse(params[6] as string),recorded_at:now,
      authority:'PAPER_CYCLE_ONLY',can_execute:false,can_sign:false,can_broadcast:false,can_move_money:false}
     rows=[{cycle_id:params[0]}]
    }
   }else if(statement.includes('FROM public.money_purse_paper_cycles WHERE cycle_id=')){
    if(row&&row.cycle_id===params[0]&&row.user_id===params[1])rows=[row]
   }else throw new Error('Unexpected SQL in Purse test: '+statement)
   return {rows:rows as T[],rowCount:rows.length}
  },
 }
 const store=new PostgresPursePaperStore(sql,'u1')
 const lease=await store.acquireLease({charterId:cycle.charterId,workerId:cycle.workerId,acquiredAt:now,
  expiresAt:'2026-10-01T05:20:00.000Z',evidenceIds:['trusted-worker:1']})
 assert.equal(lease.fencingToken,1)
 assert.equal(await store.appendOnce(cycle),'INSERTED')
 assert.equal(await store.appendOnce(cycle),'REPLAY')
 const readback=await store.readBack(cycle)
 assert.equal(readback.matching,true)
 assert.equal(readback.economicSha256,fingerprintPursePaperCycle(cycle))
 assert.throws(()=>new PostgresPursePaperStore(sql,'').appendOnce(cycle),/OWNER_REQUIRED/)
 await assert.rejects(store.appendOnce({...cycle,paperIntents:[{intentId:'unapproved:intent',lane:'STOCK',instrumentId:'SPY',
  simulatedNotionalMinor:1n,intent:'SIMULATE_INCREASE',authority:'PAPER_SIMULATION_INPUT_ONLY',canExecute:false,canMoveMoney:false}]}),/ECONOMIC_REPLAY_CONFLICT/)
 fence=2
 await assert.rejects(store.appendOnce(cycle),/FENCING_OR_LEASE_EXPIRED/)
 fence=1
 const persistedRow=row as Record<string,unknown>|null
 if(persistedRow)persistedRow['economic_sha256']='bad-hash'
 await assert.rejects(store.readBack(cycle),/READBACK_INTEGRITY_FAILED/)
})

test('PURSE-AUTO.10 bounded historical learning can alter only a subsequent held-out paper decision',()=>{
 const trainingCutoff='2026-10-01T04:40:00.000Z'
 const paperCharter={...charter,autonomyMode:'PAPER_AUTONOMOUS' as const}
 const lesson={
  lessonId:'holdout:lesson:1',decisionId:'holdout:decision:1',userId:'u1',strategyId:'stock-core',instrumentId:'MSFT',
  horizon:'15M' as const,action:'PAPER_TRADE' as const,marketRegime:'RANGE',sourceGroups:['stock-market'],
  confidenceBps:7000,underlyingReturnBps:-1600,decisionReturnBps:-1600,decisionQualityBps:-1600,avoidedLossBps:0,missedGainBps:0,
  executionCostBps:100,regretBps:1600,confidenceErrorBps:4000,timingDiagnosis:'LATE' as const,thesisHeld:false,lessonTags:['NEGATIVE'],
  evaluatedAt:'2026-10-01T04:30:00.000Z',evidenceIds:['verified:market:earlier'],
  authority:'LEARNING_ONLY' as const,financialAuthority:'NONE' as const,canExecute:false as const,canAuthorizeLive:false as const,
 }
 const review=reviewPurseShadowEvidence({userId:'u1',strategyId:'stock-core',cutoff:trainingCutoff,
  grades:[{lesson,decidedAt:'2026-10-01T04:00:00.000Z',availableAt:'2026-10-01T04:31:00.000Z',
   providerVerification:'VERIFIED',verificationIds:['exchange:earlier:readback']}]})
 assert.equal(review.uniqueDecisions,1)
 const profile=buildPurseStrategyLearningProfile({lane:'STOCK',strategyId:'stock-core',evaluatedAt:trainingCutoff,memories:[{
  memoryId:'purse-shadow-learning:'+lesson.lessonId,source:'PURSE_OUTCOME',lane:'STOCK',strategyId:'stock-core',sampleWeight:1,
  returnBps:-1600,downsideRateBps:10000,executionQualityBps:5000,confidenceAdjustmentBps:-1200,
  sizeMultiplierBps:0,status:'REJECTED',observedAt:lesson.evaluatedAt,evidenceIds:lesson.evidenceIds,
  authority:'LEARNING_ONLY',canAuthorizeLive:false,
 }]})
 const op=ingestPurseOpportunity({charter:paperCharter,opportunity:opportunity(),ingestedAt:now})
 const inputs={charter:paperCharter,treasury,capital,opportunities:[op],currentExposures:[stockExposure],
  profiles:[profile],shadowReview:review,trainingCutoff,holdoutCutoff:now,expiresAt:later}
 const effect=comparePursePaperLearning(inputs)
 assert.equal(effect.decisionChanged,true)
 assert.equal(effect.doesNotProveProfitability,true)
 assert.equal(effect.canExecute,false)
 assert.ok(effect.allocationDeltaMinor<0n)
 assert.throws(()=>comparePursePaperLearning({...inputs,trainingCutoff:now}),/ADMISSION_INVALID|HOLDOUT_TIME_INVALID/)
 assert.throws(()=>comparePursePaperLearning({...inputs,profiles:[{...profile,sourceMemoryIds:['unverified:lesson']}]}),/PROFILE_LEAKAGE/)
})

test('PURSE-AUTO.11 reconciles hypothetical payday cash on both sides without real settlement authority',()=>{
 const waterfall:PurseProfitWaterfall={
  waterfallId:'wf:paper',charterId:charter.charterId,cofferId:charter.cofferId,userId:charter.userId,
  reportingCurrency:'USD',policyId:'coffer:policy',ownerDestinationId:charter.verifiedOwnerPayoutDestinationId,
  accountingObservedAt:now,evaluatedAt:now,netRealizedProfitMinor:20000n,proposedByCofferMinor:8000n,
  protectedOwnerSweepHoldMinor:5000n,availableForWithdrawalMinor:6000n,proposedOwnerPaydayMinor:5000n,
  status:'PAPER_READY',reasonCodes:[],evidenceIds:['paper:accountant'],
  authority:'PROFIT_WATERFALL_EVIDENCE_ONLY',canExecute:false,
 }
 const proposal=buildOwnerPaydayProposal({charter,waterfall,sourceAccount:'coffer:cash',
  destinationAccount:charter.verifiedOwnerPayoutDestinationId})
 const base={waterfall,proposal,sourceBeforeMinor:20000n,sourceAfterMinor:14750n,
  destinationBeforeMinor:1000n,destinationAfterMinor:6000n,hypotheticalFeeMinor:250n,testEvidenceIds:['paper:source','paper:destination']}
 const good=reconcilePursePaperPayday(base)
 assert.equal(good.status,'PAPER_TIED_OUT')
 assert.equal(good.provesRealSettlement,false)
 assert.equal(good.canMoveMoney,false)
 assert.equal(good.amountMinor,5000n)
 assert.equal(reconcilePursePaperPayday({...base,destinationAfterMinor:5999n}).status,'PAPER_RECONCILIATION_FAILED')
 assert.throws(()=>reconcilePursePaperPayday({...base,proposal:{...proposal,ownerDestinationId:'attacker'}}),/BINDING_MISMATCH/)
})

test('PURSE-AUTO.13 certification cannot promote unit fixtures into operational acceptance',()=>{
 const blocked=reviewPursePaperCertification({
  cycles:[],horizons:[],durableDbIndependentReadback:false,encryptedDriveBackupRestored:false,originalLedgerRestored:false,
  workerGoogleOAuthVerified:false,providerRightsConfirmed:false,reviewedAt:now,
 })
 assert.equal(blocked.status,'BLOCKED')
 assert.equal(blocked.paperCertificationIssued,false)
 assert.equal(blocked.canExecute,false)
 assert.ok(blocked.blockers.includes('ORIGINAL_LEDGER_NOT_RECOVERED'))
 assert.ok(blocked.blockers.includes('SIX_MATURED_HORIZONS_MISSING'))
 assert.ok(blocked.blockers.includes('DURABLE_DATABASE_NOT_INDEPENDENTLY_VERIFIED'))
})
