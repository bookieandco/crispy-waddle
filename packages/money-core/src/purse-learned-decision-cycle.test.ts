import test from 'node:test'
import assert from 'node:assert/strict'
import { buildCofferTreasurySnapshot, type CofferAssetBalanceEvidence } from './coffer-treasury-contracts.js'
import { ingestPurseOpportunity, type PurseOpportunity } from './purse-opportunity-bus.js'
import { InMemoryPurseLearningStore } from './purse-learning-store.js'
import { PurseLearningRuntime } from './purse-learning-runtime.js'
import { runLearnedPurseDecisionCycle } from './purse-decision-runtime.js'
import type { StrategyLearningRecord } from './autonomous-strategy-learning.js'
import type { JhadinaPurseCharter } from './jhadina-purse-charter.js'
import type { PurseAllocatorCapitalEvidence } from './purse-capital-allocator.js'

const now='2026-10-01T06:00:00.000Z'
const charter:JhadinaPurseCharter=Object.freeze({
 charterId:'charter:learned',charterVersion:'v1',userId:'u1',cofferId:'c1',reportingCurrency:'USD',autonomyMode:'LIVE_GOVERNED_INTENTS',
 maxTotalDeployableBps:8000,minLiquidReserveMinor:10000n,minEmergencyReserveMinor:10000n,maxSingleOpportunityBps:4000,maxCorrelatedExposureBps:5000,maxRebalanceTurnoverBps:8000,
 lanePolicies:Object.freeze([
  {lane:'STOCK',enabled:true,maxAllocationBps:7000,maxSinglePositionBps:4000,minConfidenceBps:5000},
  {lane:'FOREX',enabled:false,maxAllocationBps:0,maxSinglePositionBps:0,minConfidenceBps:5000},
  {lane:'CRYPTO',enabled:false,maxAllocationBps:0,maxSinglePositionBps:0,minConfidenceBps:5000},
  {lane:'MEME',enabled:false,maxAllocationBps:0,maxSinglePositionBps:0,minConfidenceBps:5000},
  {lane:'PREDICTION',enabled:false,maxAllocationBps:0,maxSinglePositionBps:0,minConfidenceBps:5000},
  {lane:'SPORTS',enabled:false,maxAllocationBps:0,maxSinglePositionBps:0,minConfidenceBps:5000},
  {lane:'METALS',enabled:false,maxAllocationBps:0,maxSinglePositionBps:0,minConfidenceBps:5000},
 ] as const),
 verifiedOwnerPayoutDestinationId:'owner:bank',ownerProfitSweepProtected:true,charterMutationRequiresOwnerApproval:true,ownerDestinationMutationRequiresOwnerApproval:true,
 jhadinaMayAllocate:true,jhadinaMayRebalance:true,effectiveAt:'2026-10-01T00:00:00.000Z',evidenceIds:Object.freeze(['owner:charter']),
 authority:'OWNER_TREASURY_CHARTER',canExecute:false,
})
const balance:CofferAssetBalanceEvidence=Object.freeze({
 balanceId:'bal',cofferId:'c1',userId:'u1',custodyId:'cash',custodyKind:'COFFER_CASH',provider:'test',assetId:'USD',assetKind:'FIAT',amountAtomic:100000n,decimals:2,
 reportingCurrency:'USD',reportingValueMinor:100000n,reservedReportingValueMinor:0n,observedAt:now,evidenceIds:Object.freeze(['cash:e']),authority:'TREASURY_BALANCE_EVIDENCE',canMoveMoney:false,
})
const treasury=buildCofferTreasurySnapshot({cofferId:'c1',userId:'u1',reportingCurrency:'USD',balances:[balance],observedAt:now})
const capital:PurseAllocatorCapitalEvidence=Object.freeze({
 capitalSnapshotId:'capital',cofferId:'c1',userId:'u1',reportingCurrency:'USD',availableLiquidityMinor:80000n,observedAt:now,evidenceIds:Object.freeze(['capital:e']),authority:'CAPITAL_EVIDENCE',
})
const record=(strategyId:string,id:number,returnBps:number):StrategyLearningRecord=>Object.freeze({
 learningRecordId:strategyId+':'+id,domain:'STOCK',strategyId,scenarioId:'s'+id,paperRunId:'r'+id,strategyResultId:'result'+id,returnBps,
 fillRateBps:9500,slippageBps:20,feesPaidMinor:'10',outcomeScore:Math.max(-1,Math.min(1,returnBps/10000)),executionQuality:.95,
 evidenceIds:Object.freeze(['paper:'+strategyId+':'+id]),evaluatedAt:`2026-10-01T0${id}:00:00.000Z`,authority:'LEARNING_ONLY',canAuthorizeLive:false,
})
const opportunity=(strategyId:string,instrumentId:string):PurseOpportunity=>Object.freeze({
 opportunityId:'opp:'+strategyId,sourceId:'source:'+strategyId,sourceKind:'STOCK',lane:'STOCK',strategyId,instrumentId,action:'ENTER',thesis:'Evidence-backed stock setup.',
 horizon:'SHORT',expectedNetEdgeBps:1000,expectedDownsideBps:500,confidenceBps:8000,evidenceQualityBps:9000,liquidityBps:9500,minimumCapitalMinor:1000n,maximumCapitalMinor:30000n,
 correlationGroupIds:Object.freeze(['US_STOCKS']),observedAt:'2026-10-01T05:30:00.000Z',availableAt:'2026-10-01T05:31:00.000Z',expiresAt:'2026-10-01T07:00:00.000Z',
 evidenceIds:Object.freeze(['opp:'+strategyId+':e']),provenanceHash:'prov:'+strategyId,authority:'INTELLIGENCE_ONLY',canExecute:false,
})

test('learned Purse decision cycle uses durable paper memory and personality before allocation',async()=>{
 const store=new InMemoryPurseLearningStore()
 const runtime=new PurseLearningRuntime({userId:'u1',cofferId:'c1',store,minimumSamples:3})
 for(const [i,r] of [700,500,400].entries())await runtime.ingestPaper(record('good',i+1,r),`2026-10-01T0${i+3}:10:00.000Z`)
 for(const [i,r] of [-900,-700,-500].entries())await runtime.ingestPaper(record('bad',i+4,r),`2026-10-01T0${i+3}:20:00.000Z`)

 const good=ingestPurseOpportunity({charter,opportunity:opportunity('good','GOOD'),ingestedAt:now})
 const bad=ingestPurseOpportunity({charter,opportunity:opportunity('bad','BAD'),ingestedAt:now})
 const personality=Object.freeze({
  version:11,independentAssessmentRequired:true,taste:Object.freeze({novelty:.8,experimentation:.8,conventionTolerance:.2}),
  traits:Object.freeze([]),updatedAt:'2026-10-01T05:55:00.000Z',
 })
 const cycle=await runLearnedPurseDecisionCycle({
  charter,treasury,capital,opportunities:[good,bad],currentExposures:[],personality,personalityEvidenceIds:['personality:11'],
  learningRuntime:runtime,informationCutoff:now,expiresAt:'2026-10-01T06:30:00.000Z',decidedAt:'2026-10-01T06:05:00.000Z',
 })
 const goodTarget=cycle.allocation.targets.find(x=>x.strategyId==='good')
 const badTarget=cycle.allocation.targets.find(x=>x.strategyId==='bad')
 assert.ok(goodTarget)
 assert.ok(badTarget)
 assert.equal(goodTarget.learningSizingMultiplierBps,10000)
 assert.equal(badTarget.learningSizingMultiplierBps,2500)
 assert.ok(goodTarget.scoreBps>badTarget.scoreBps)
 assert.ok(goodTarget.targetIncrementMinor>badTarget.targetIncrementMinor)
 assert.equal(cycle.learning.temperament.explorationBps,0)
 assert.equal(cycle.learning.temperament.livePersonalityRiskBoostAllowed,false)
 assert.ok(cycle.decisions.allocations.every(x=>x.financialAuthority==='NONE'&&x.canExecute===false))
 assert.ok(cycle.decisions.allocations.some(x=>x.learningProfileId))
})
