import { createHash } from 'node:crypto'
import type { CofferTreasurySnapshot } from './coffer-treasury-contracts.js'
import type { MoneyStrategyLane } from './money-commissioning-contracts.js'
import { assertJhadinaPurseCharter, type JhadinaPurseCharter } from './jhadina-purse-charter.js'
import { assertPurseOpportunity, type PurseOpportunityEnvelope } from './purse-opportunity-bus.js'
import { learningAdjustmentForOpportunity, type PurseLearningContext } from './purse-learning-memory.js'

export type PurseExposureEvidence=Readonly<{
 exposureId:string
 lane:MoneyStrategyLane
 strategyId:string
 instrumentId:string
 reportingValueMinor:bigint
 correlationGroupIds:readonly string[]
 observedAt:string
 evidenceIds:readonly string[]
 authority:'EXPOSURE_EVIDENCE'
}>

export type PurseAllocatorCapitalEvidence=Readonly<{
 capitalSnapshotId:string
 cofferId:string
 userId:string
 reportingCurrency:string
 availableLiquidityMinor:bigint
 observedAt:string
 evidenceIds:readonly string[]
 authority:'CAPITAL_EVIDENCE'
}>

export type PurseTargetAllocation=Readonly<{
 allocationId:string
 opportunityId:string
 lane:MoneyStrategyLane
 strategyId:string
 instrumentId:string
 targetIncrementMinor:bigint
 resultingLaneExposureMinor:bigint
 baseScoreBps:number
 scoreBps:number
 adjustedConfidenceBps:number
 learningProfileId?:string
 learningConfidenceDeltaBps:number
 learningSizingMultiplierBps:number
 why:string
 reasonCodes:readonly string[]
 correlationGroupIds:readonly string[]
 evidenceIds:readonly string[]
 authority:'ALLOCATION_TARGET_ONLY'
 canExecute:false
}>

export type PurseAllocationPlan=Readonly<{
 planId:string
 charterId:string
 treasuryObservedAt:string
 capitalSnapshotId:string
 reportingCurrency:string
 totalPortfolioValueMinor:bigint
 protectedReserveMinor:bigint
 maximumDeployableMinor:bigint
 currentExposureMinor:bigint
 incrementalCapacityMinor:bigint
 allocatedIncrementMinor:bigint
 unallocatedLiquidityMinor:bigint
 targets:readonly PurseTargetAllocation[]
 rejectedOpportunityIds:readonly string[]
 informationCutoff:string
 expiresAt:string
 evidenceIds:readonly string[]
 authority:'PURSE_ALLOCATION_ONLY'
 canExecute:false
 requiresDownstreamRiskAndAuthority:true
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const min=(...xs:bigint[])=>xs.reduce((a,b)=>a<b?a:b)
const max=(a:bigint,b:bigint)=>a>b?a:b
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())
const bpsValue=(value:bigint,bps:number)=>value*BigInt(bps)/10000n
const validIso=(v:string)=>!Number.isNaN(Date.parse(v))

function assertExposure(x:PurseExposureEvidence,now:string):void{
 if(!x.exposureId||!x.strategyId||!x.instrumentId||x.reportingValueMinor<0n||!x.evidenceIds.length||x.authority!=='EXPOSURE_EVIDENCE')throw new Error('PURSE_EXPOSURE_INVALID')
 if(!validIso(x.observedAt)||x.observedAt>now)throw new Error('PURSE_EXPOSURE_TIME_INVALID')
}

function assertCapitalEvidence(x:PurseAllocatorCapitalEvidence,charter:JhadinaPurseCharter,treasury:CofferTreasurySnapshot,now:string):void{
 if(x.authority!=='CAPITAL_EVIDENCE'||!x.capitalSnapshotId||!x.evidenceIds.length)throw new Error('PURSE_CAPITAL_EVIDENCE_INVALID')
 if(x.cofferId!==charter.cofferId||x.userId!==charter.userId||x.reportingCurrency!==charter.reportingCurrency)throw new Error('PURSE_CAPITAL_BINDING_MISMATCH')
 if(x.reportingCurrency!==treasury.reportingCurrency||x.availableLiquidityMinor<0n||x.availableLiquidityMinor>treasury.totalReportingValueMinor)throw new Error('PURSE_CAPITAL_LIQUIDITY_INVALID')
 if(!validIso(x.observedAt)||x.observedAt>now)throw new Error('PURSE_CAPITAL_TIME_INVALID')
}

export function scorePurseOpportunity(o:{expectedNetEdgeBps:number;expectedDownsideBps:number;confidenceBps:number;evidenceQualityBps:number;liquidityBps:number}):number{
 const reward=Math.max(0,o.expectedNetEdgeBps)/10000
 const downside=Math.max(0,o.expectedDownsideBps)/10000
 const confidence=o.confidenceBps/10000
 const evidence=o.evidenceQualityBps/10000
 const liquidity=o.liquidityBps/10000
 const score=reward*confidence*evidence*liquidity/(1+downside)
 return Math.max(0,Math.min(1,score))
}

export function allocatePurseCapital(input:{
 charter:JhadinaPurseCharter
 treasury:CofferTreasurySnapshot
 capital:PurseAllocatorCapitalEvidence
 opportunities:readonly PurseOpportunityEnvelope[]
 currentExposures:readonly PurseExposureEvidence[]
 learning?:PurseLearningContext
 informationCutoff:string
 expiresAt:string
}):PurseAllocationPlan{
 const {charter,treasury,capital}=input
 assertJhadinaPurseCharter(charter,input.informationCutoff)
 if(treasury.authority!=='TREASURY_ACCOUNTING_EVIDENCE'||treasury.canMoveMoney!==false)throw new Error('PURSE_TREASURY_AUTHORITY_INVALID')
 if(treasury.cofferId!==charter.cofferId||treasury.userId!==charter.userId||treasury.reportingCurrency!==charter.reportingCurrency)throw new Error('PURSE_TREASURY_BINDING_MISMATCH')
 if(!validIso(input.informationCutoff)||!validIso(input.expiresAt)||input.expiresAt<=input.informationCutoff)throw new Error('PURSE_ALLOCATION_WINDOW_INVALID')
 if(treasury.observedAt>input.informationCutoff)throw new Error('PURSE_TREASURY_FUTURE_EVIDENCE')
 assertCapitalEvidence(capital,charter,treasury,input.informationCutoff)
 for(const e of input.currentExposures)assertExposure(e,input.informationCutoff)
 if(input.learning){
  if(input.learning.authority!=='PURSE_LEARNING_CONTEXT_ONLY'||input.learning.financialAuthority!=='NONE'||input.learning.canAuthorizeLive!==false||input.learning.canExecute!==false)throw new Error('PURSE_LEARNING_CONTEXT_AUTHORITY_INVALID')
  if(input.learning.observedAt>input.informationCutoff)throw new Error('PURSE_LEARNING_CONTEXT_FUTURE_EVIDENCE')
 }

 const total=treasury.totalReportingValueMinor
 const protectedReserve=charter.minLiquidReserveMinor+charter.minEmergencyReserveMinor
 const reserveAdjusted=max(0n,total-protectedReserve)
 const deployableByCharter=bpsValue(total,charter.maxTotalDeployableBps)
 const maximumDeployable=min(reserveAdjusted,deployableByCharter,treasury.deployableReportingValueMinor)
 const currentExposure=input.currentExposures.reduce((n,x)=>n+x.reportingValueMinor,0n)
 const incrementalCapacity=max(0n,maximumDeployable-currentExposure)
 let remaining=min(incrementalCapacity,capital.availableLiquidityMinor)

 const laneUsed=new Map<MoneyStrategyLane,bigint>()
 const correlationUsed=new Map<string,bigint>()
 for(const e of input.currentExposures){
  laneUsed.set(e.lane,(laneUsed.get(e.lane)??0n)+e.reportingValueMinor)
  for(const group of e.correlationGroupIds)correlationUsed.set(group,(correlationUsed.get(group)??0n)+e.reportingValueMinor)
 }

 const rejected=new Set<string>()
 const scored=input.opportunities
  .map(env=>{
   if(env.authority!=='OPPORTUNITY_BUS_ONLY'||env.canExecute!==false)throw new Error('PURSE_OPPORTUNITY_ENVELOPE_AUTHORITY_INVALID')
   assertPurseOpportunity(env.opportunity,input.informationCutoff)
   if(env.charterId!==charter.charterId)throw new Error('PURSE_OPPORTUNITY_CHARTER_MISMATCH')
   if(!env.admitted){rejected.add(env.opportunity.opportunityId);return null}
   const adjustment=learningAdjustmentForOpportunity({
    context:input.learning,lane:env.opportunity.lane,strategyId:env.opportunity.strategyId,autonomyMode:charter.autonomyMode,
   })
   const adjustedConfidenceBps=Math.max(0,Math.min(10000,env.opportunity.confidenceBps+adjustment.confidenceDeltaBps))
   const baseScore=scorePurseOpportunity({...env.opportunity,confidenceBps:adjustedConfidenceBps})
   const score=baseScore*adjustment.scoreMultiplierBps/10000
   const scoreBps=Math.round(score*10000)
   if(scoreBps<adjustment.minimumScoreBps){rejected.add(env.opportunity.opportunityId);return null}
   return {env,score,baseScore,adjustedConfidenceBps,adjustment}
  })
  .filter((x):x is NonNullable<typeof x>=>Boolean(x)&&x!.score>0)
  .sort((a,b)=>b.score-a.score||a.env.opportunity.opportunityId.localeCompare(b.env.opportunity.opportunityId))

 const targets:PurseTargetAllocation[]=[]
 const evidenceIds=[...treasury.evidenceIds,...capital.evidenceIds,...charter.evidenceIds]
 for(const {env,score,baseScore,adjustedConfidenceBps,adjustment} of scored){
  if(remaining<=0n){rejected.add(env.opportunity.opportunityId);continue}
  const o=env.opportunity
  const lanePolicy=charter.lanePolicies.find(x=>x.lane===o.lane)
  if(!lanePolicy||!lanePolicy.enabled){rejected.add(o.opportunityId);continue}
  const laneCap=bpsValue(total,lanePolicy.maxAllocationBps)
  const laneRoom=max(0n,laneCap-(laneUsed.get(o.lane)??0n))
  const opportunityCap=min(
   bpsValue(total,charter.maxSingleOpportunityBps),
   bpsValue(total,lanePolicy.maxSinglePositionBps),
   o.maximumCapitalMinor,
  )
  let correlationRoom=remaining
  for(const group of o.correlationGroupIds){
   const groupCap=bpsValue(total,charter.maxCorrelatedExposureBps)
   correlationRoom=min(correlationRoom,max(0n,groupCap-(correlationUsed.get(group)??0n)))
  }
  const preLearningDesired=min(remaining,laneRoom,opportunityCap,correlationRoom)
  const desired=preLearningDesired*BigInt(adjustment.sizingMultiplierBps)/10000n
  if(desired<o.minimumCapitalMinor||desired<=0n){rejected.add(o.opportunityId);continue}
  const baseScoreBps=Math.round(baseScore*10000)
  const scoreBps=Math.round(score*10000)
  const learningWhy=adjustment.profileId?` Learning profile ${adjustment.profileId} adjusted confidence by ${adjustment.confidenceDeltaBps} bps and size to ${adjustment.sizingMultiplierBps} bps of the charter-bounded candidate.`:' No strategy learning profile was available, so no live risk boost was applied.'
  const why=`${o.lane} opportunity ${o.instrumentId} clears charter confidence/evidence/liquidity gates with ${o.expectedNetEdgeBps} bps expected net edge, ${adjustedConfidenceBps} bps adjusted confidence, and ${scoreBps} bps learned composite score.${learningWhy}`
  const resultingLaneExposure=(laneUsed.get(o.lane)??0n)+desired
  const target=Object.freeze({
   allocationId:'purse-allocation:'+hash({plan:charter.charterId,opportunityId:o.opportunityId,desired,cutoff:input.informationCutoff}),
   opportunityId:o.opportunityId,lane:o.lane,strategyId:o.strategyId,instrumentId:o.instrumentId,targetIncrementMinor:desired,resultingLaneExposureMinor:resultingLaneExposure,
   baseScoreBps,scoreBps,adjustedConfidenceBps,learningProfileId:adjustment.profileId,learningConfidenceDeltaBps:adjustment.confidenceDeltaBps,
   learningSizingMultiplierBps:adjustment.sizingMultiplierBps,why,
   reasonCodes:Object.freeze(['POSITIVE_AFTER_COST_EDGE','WITHIN_CHARTER_LIMITS','LIQUIDITY_AND_EVIDENCE_ACCEPTABLE',...adjustment.reasonCodes]),
   correlationGroupIds:o.correlationGroupIds,evidenceIds:unique([...o.evidenceIds,...env.reasonCodes,...adjustment.evidenceIds]),authority:'ALLOCATION_TARGET_ONLY' as const,canExecute:false as const,
  })
  targets.push(target)
  laneUsed.set(o.lane,resultingLaneExposure)
  for(const group of o.correlationGroupIds)correlationUsed.set(group,(correlationUsed.get(group)??0n)+desired)
  remaining-=desired
  evidenceIds.push(...o.evidenceIds,...adjustment.evidenceIds)
 }
 const allocated=targets.reduce((n,x)=>n+x.targetIncrementMinor,0n)
 const provenanceHash=hash({charterId:charter.charterId,capital:capital.capitalSnapshotId,targets:targets.map(x=>({id:x.allocationId,amount:x.targetIncrementMinor})),cutoff:input.informationCutoff})
 return Object.freeze({
  planId:'purse-plan:'+provenanceHash,charterId:charter.charterId,treasuryObservedAt:treasury.observedAt,capitalSnapshotId:capital.capitalSnapshotId,
  reportingCurrency:charter.reportingCurrency,totalPortfolioValueMinor:total,protectedReserveMinor:protectedReserve,maximumDeployableMinor:maximumDeployable,
  currentExposureMinor:currentExposure,incrementalCapacityMinor:incrementalCapacity,allocatedIncrementMinor:allocated,unallocatedLiquidityMinor:capital.availableLiquidityMinor-allocated,
  targets:Object.freeze(targets),rejectedOpportunityIds:Object.freeze([...rejected].sort()),informationCutoff:input.informationCutoff,expiresAt:input.expiresAt,
  evidenceIds:unique(evidenceIds),authority:'PURSE_ALLOCATION_ONLY',canExecute:false,requiresDownstreamRiskAndAuthority:true,
 })
}
