import { createHash } from 'node:crypto'
import type { CofferTreasurySnapshot } from './coffer-treasury-contracts.js'
import type { MoneyStrategyLane } from './money-commissioning-contracts.js'
import { assertJhadinaPurseCharter, type JhadinaPurseCharter } from './jhadina-purse-charter.js'
import { assertPurseOpportunity, type PurseOpportunityEnvelope } from './purse-opportunity-bus.js'
import type { PurseDecisionStyle, PurseStrategyLearningProfile } from './purse-learning-personality.js'

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
 scoreBps:number
 effectiveConfidenceBps:number
 sizeMultiplierBps:number
 learningProfileId?:string
 decisionStyleId?:string
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
 learningProfileIds:readonly string[]
 decisionStyleId?:string
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
const clamp=(n:number,minValue:number,maxValue:number)=>Math.max(minValue,Math.min(maxValue,n))
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

function assertLearningProfile(p:PurseStrategyLearningProfile,now:string):void{
 if(p.authority!=='LEARNING_ONLY'||p.canAuthorizeLive!==false||!p.profileId.trim()||!p.strategyId.trim())throw new Error('PURSE_LEARNING_PROFILE_INVALID')
 if(!validIso(p.evaluatedAt)||p.evaluatedAt>now)throw new Error('PURSE_LEARNING_PROFILE_FUTURE')
 if(!Number.isInteger(p.confidenceAdjustmentBps)||p.confidenceAdjustmentBps<-2500||p.confidenceAdjustmentBps>750)throw new Error('PURSE_LEARNING_CONFIDENCE_ADJUSTMENT_INVALID')
 if(!Number.isInteger(p.sizeMultiplierBps)||p.sizeMultiplierBps<0||p.sizeMultiplierBps>10000)throw new Error('PURSE_LEARNING_SIZE_MULTIPLIER_INVALID')
}

function assertDecisionStyle(s:PurseDecisionStyle):void{
 if(s.authority!=='PERSONALITY_INFLUENCE_ONLY'||s.canRelaxCharter!==false||s.canAuthorizeLive!==false||!s.styleId.trim())throw new Error('PURSE_DECISION_STYLE_AUTHORITY_INVALID')
 for(const v of [s.patienceBiasBps,s.cashOptionalityBiasBps,s.concentrationDisciplineBps,s.contradictionSensitivityBps]){
  if(!Number.isInteger(v)||v<0||v>10000)throw new Error('PURSE_DECISION_STYLE_BPS_INVALID')
 }
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
 learningProfiles?:readonly PurseStrategyLearningProfile[]
 decisionStyle?:PurseDecisionStyle
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
 for(const p of input.learningProfiles??[])assertLearningProfile(p,input.informationCutoff)
 if(input.decisionStyle)assertDecisionStyle(input.decisionStyle)

 const total=treasury.totalReportingValueMinor
 const protectedReserve=charter.minLiquidReserveMinor+charter.minEmergencyReserveMinor
 const reserveAdjusted=max(0n,total-protectedReserve)
 const deployableByCharter=bpsValue(total,charter.maxTotalDeployableBps)
 const maximumDeployable=min(reserveAdjusted,deployableByCharter,treasury.deployableReportingValueMinor)
 const currentExposure=input.currentExposures.reduce((n,x)=>n+x.reportingValueMinor,0n)
 const incrementalCapacity=max(0n,maximumDeployable-currentExposure)
 let remaining=min(incrementalCapacity,capital.availableLiquidityMinor)

 const laneUsed=new Map<MoneyStrategyLane,bigint>()
 // Cap aggregate exposure to an instrument across accounts, lots and strategies.
 const instrumentUsed=new Map<string,bigint>()
 const correlationUsed=new Map<string,bigint>()
 const seenExposureIds=new Set<string>()

 for(const e of input.currentExposures){
  if(seenExposureIds.has(e.exposureId))throw new Error('PURSE_DUPLICATE_EXPOSURE_ID')
  seenExposureIds.add(e.exposureId)
  laneUsed.set(e.lane,(laneUsed.get(e.lane)??0n)+e.reportingValueMinor)
  const instrumentKey=e.lane+':'+e.instrumentId
  instrumentUsed.set(instrumentKey,(instrumentUsed.get(instrumentKey)??0n)+e.reportingValueMinor)
  for(const group of e.correlationGroupIds)correlationUsed.set(group,(correlationUsed.get(group)??0n)+e.reportingValueMinor)
 }

 const profileByStrategy=new Map<string,PurseStrategyLearningProfile>()
 for(const p of input.learningProfiles??[]){
  const key=p.lane+':'+p.strategyId
  const prior=profileByStrategy.get(key)
  if(!prior||prior.evaluatedAt<p.evaluatedAt)profileByStrategy.set(key,p)
 }
 const style=input.decisionStyle
 const styleScoreFloorBps=style?clamp(Math.round((style.patienceBiasBps+style.cashOptionalityBiasBps+style.contradictionSensitivityBps)/30),0,1000):0
 const styleSizeMultiplierBps=style?clamp(10000-Math.round((style.cashOptionalityBiasBps+style.concentrationDisciplineBps)/10),8000,10000):10000

 const rejected=new Set<string>()
 type Scored=Readonly<{
  env:PurseOpportunityEnvelope
  score:number
  effectiveConfidenceBps:number
  sizeMultiplierBps:number
  learning?:PurseStrategyLearningProfile
 }>
 const seenOpportunityIds=new Set<string>()
 const scored:Scored[]=input.opportunities.flatMap(env=>{
  if(seenOpportunityIds.has(env.opportunity.opportunityId))throw new Error('PURSE_DUPLICATE_OPPORTUNITY_ID')
  seenOpportunityIds.add(env.opportunity.opportunityId)
  if(env.authority!=='OPPORTUNITY_BUS_ONLY'||env.canExecute!==false)throw new Error('PURSE_OPPORTUNITY_ENVELOPE_AUTHORITY_INVALID')
  assertPurseOpportunity(env.opportunity,input.informationCutoff)
  if(env.charterId!==charter.charterId)throw new Error('PURSE_OPPORTUNITY_CHARTER_MISMATCH')
  if(!env.admitted){rejected.add(env.opportunity.opportunityId);return []}
  const o=env.opportunity
  const lanePolicy=charter.lanePolicies.find(x=>x.lane===o.lane)
  const learning=profileByStrategy.get(o.lane+':'+o.strategyId)
  if(learning?.status==='REJECTED'){rejected.add(o.opportunityId);return []}
  const effectiveConfidenceBps=clamp(o.confidenceBps+(learning?.confidenceAdjustmentBps??0),0,10000)
  if(effectiveConfidenceBps<(lanePolicy?.minConfidenceBps??10000)){rejected.add(o.opportunityId);return []}
  const learningSizeMultiplierBps=learning?.sizeMultiplierBps??10000
  const sizeMultiplierBps=Math.floor(learningSizeMultiplierBps*styleSizeMultiplierBps/10000)
  if(sizeMultiplierBps<=0){rejected.add(o.opportunityId);return []}
  const score=scorePurseOpportunity({...o,confidenceBps:effectiveConfidenceBps})
  const scoreBps=Math.round(score*10000)
  if(score<=0||scoreBps<styleScoreFloorBps){rejected.add(o.opportunityId);return []}
  return [{env,score,effectiveConfidenceBps,sizeMultiplierBps,learning}]
 }).sort((a,b)=>b.score-a.score||a.env.opportunity.opportunityId.localeCompare(b.env.opportunity.opportunityId))

 const targets:PurseTargetAllocation[]=[]
 const evidenceIds=[...treasury.evidenceIds,...capital.evidenceIds,...charter.evidenceIds,...(style?.evidenceIds??[])]
 for(const {env,score,effectiveConfidenceBps,sizeMultiplierBps,learning} of scored){
  if(remaining<=0n){rejected.add(env.opportunity.opportunityId);continue}
  const o=env.opportunity
  const lanePolicy=charter.lanePolicies.find(x=>x.lane===o.lane)
  if(!lanePolicy||!lanePolicy.enabled){rejected.add(o.opportunityId);continue}
  const laneCap=bpsValue(total,lanePolicy.maxAllocationBps)
  const laneRoom=max(0n,laneCap-(laneUsed.get(o.lane)??0n))
  const learnedOpportunityCap=bpsValue(o.maximumCapitalMinor,sizeMultiplierBps)
  const instrumentKey=o.lane+':'+o.instrumentId
  const positionCap=bpsValue(total,lanePolicy.maxSinglePositionBps)
  const positionRoom=max(0n,positionCap-(instrumentUsed.get(instrumentKey)??0n))
  const opportunityCap=min(bpsValue(total,charter.maxSingleOpportunityBps),learnedOpportunityCap)
  let correlationRoom=remaining
  for(const group of o.correlationGroupIds){
   const groupCap=bpsValue(total,charter.maxCorrelatedExposureBps)
   correlationRoom=min(correlationRoom,max(0n,groupCap-(correlationUsed.get(group)??0n)))
  }
  const desired=min(remaining,laneRoom,positionRoom,opportunityCap,correlationRoom)
  if(desired<o.minimumCapitalMinor||desired<=0n){rejected.add(o.opportunityId);continue}
  const scoreBps=Math.round(score*10000)
  const learningText=learning?` Learning profile ${learning.status.toLowerCase()} (${learning.sampleWeight} weighted samples) adjusted confidence to ${effectiveConfidenceBps} bps and capped sizing at ${sizeMultiplierBps} bps of the base opportunity limit.`:''
  const styleText=style&&style.evidenceIds.length?` Personality decision-style evidence may tighten patience/optionality/concentration posture but cannot relax the charter.`:''
  const why=`${o.lane} opportunity ${o.instrumentId} clears charter confidence/evidence/liquidity gates with ${o.expectedNetEdgeBps} bps expected net edge and ${scoreBps} bps composite score.${learningText}${styleText}`
  const resultingLaneExposure=(laneUsed.get(o.lane)??0n)+desired
  const reasonCodes=['POSITIVE_AFTER_COST_EDGE','WITHIN_CHARTER_LIMITS','LIQUIDITY_AND_EVIDENCE_ACCEPTABLE']
  if(learning)reasonCodes.push('LEARNING_PROFILE_APPLIED')
  if(style&&style.evidenceIds.length)reasonCodes.push('PERSONALITY_STYLE_TIGHTENING_APPLIED')
  const target=Object.freeze({
   allocationId:'purse-allocation:'+hash({plan:charter.charterId,opportunityId:o.opportunityId,desired,learningProfileId:learning?.profileId,decisionStyleId:style?.styleId,cutoff:input.informationCutoff}),
   opportunityId:o.opportunityId,lane:o.lane,strategyId:o.strategyId,instrumentId:o.instrumentId,targetIncrementMinor:desired,resultingLaneExposureMinor:resultingLaneExposure,
   scoreBps,effectiveConfidenceBps,sizeMultiplierBps,learningProfileId:learning?.profileId,decisionStyleId:style?.styleId,why,reasonCodes:Object.freeze(reasonCodes),
   correlationGroupIds:o.correlationGroupIds,evidenceIds:unique([...o.evidenceIds,...env.reasonCodes,...(learning?.evidenceIds??[]),...(style?.evidenceIds??[])]),
   authority:'ALLOCATION_TARGET_ONLY' as const,canExecute:false as const,
  })
  targets.push(target)
  laneUsed.set(o.lane,resultingLaneExposure)
  instrumentUsed.set(instrumentKey,(instrumentUsed.get(instrumentKey)??0n)+desired)
  for(const group of o.correlationGroupIds)correlationUsed.set(group,(correlationUsed.get(group)??0n)+desired)
  remaining-=desired
  evidenceIds.push(...o.evidenceIds,...(learning?.evidenceIds??[]))
 }
 const allocated=targets.reduce((n,x)=>n+x.targetIncrementMinor,0n)
 const learningProfileIds=unique(targets.flatMap(x=>x.learningProfileId?[x.learningProfileId]:[]))
 const provenanceHash=hash({charterId:charter.charterId,capital:capital.capitalSnapshotId,targets:targets.map(x=>({id:x.allocationId,amount:x.targetIncrementMinor})),learningProfileIds,decisionStyleId:style?.styleId,cutoff:input.informationCutoff})
 return Object.freeze({
  planId:'purse-plan:'+provenanceHash,charterId:charter.charterId,treasuryObservedAt:treasury.observedAt,capitalSnapshotId:capital.capitalSnapshotId,
  reportingCurrency:charter.reportingCurrency,totalPortfolioValueMinor:total,protectedReserveMinor:protectedReserve,maximumDeployableMinor:maximumDeployable,
  currentExposureMinor:currentExposure,incrementalCapacityMinor:incrementalCapacity,allocatedIncrementMinor:allocated,unallocatedLiquidityMinor:capital.availableLiquidityMinor-allocated,
  learningProfileIds,decisionStyleId:style?.styleId,targets:Object.freeze(targets),rejectedOpportunityIds:Object.freeze([...rejected].sort()),informationCutoff:input.informationCutoff,expiresAt:input.expiresAt,
  evidenceIds:unique(evidenceIds),authority:'PURSE_ALLOCATION_ONLY',canExecute:false,requiresDownstreamRiskAndAuthority:true,
 })
}
