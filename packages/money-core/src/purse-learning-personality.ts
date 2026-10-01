import { createHash } from 'node:crypto'
import type { PersonalityState } from '@jhadina/core-spine'
import type { StrategyCalibration } from './autonomous-strategy-learning.js'
import type { MoneyStrategyLane } from './money-commissioning-contracts.js'

export type PurseLearningSource='PAPER_STRATEGY'|'SHARK_CLOSED_TRADE'|'PURSE_OUTCOME'
export type PurseLearningStatus='INSUFFICIENT'|'SUPPORTED'|'MIXED'|'REJECTED'

export type PurseLearningMemory=Readonly<{
 memoryId:string
 source:PurseLearningSource
 lane:MoneyStrategyLane
 strategyId:string
 instrumentId?:string
 sampleWeight:number
 returnBps:number
 downsideRateBps:number
 executionQualityBps:number
 confidenceAdjustmentBps:number
 sizeMultiplierBps:number
 status:PurseLearningStatus
 observedAt:string
 evidenceIds:readonly string[]
 authority:'LEARNING_ONLY'
 canAuthorizeLive:false
}>

export type PurseStrategyLearningProfile=Readonly<{
 profileId:string
 lane:MoneyStrategyLane
 strategyId:string
 sampleWeight:number
 meanReturnBps:number
 meanDownsideRateBps:number
 meanExecutionQualityBps:number
 confidenceAdjustmentBps:number
 sizeMultiplierBps:number
 status:PurseLearningStatus
 sourceMemoryIds:readonly string[]
 evidenceIds:readonly string[]
 evaluatedAt:string
 authority:'LEARNING_ONLY'
 canAuthorizeLive:false
}>

export type PurseDecisionStyle=Readonly<{
 styleId:string
 personalityVersion:number
 patienceBiasBps:number
 cashOptionalityBiasBps:number
 concentrationDisciplineBps:number
 contradictionSensitivityBps:number
 evidenceIds:readonly string[]
 authority:'PERSONALITY_INFLUENCE_ONLY'
 canRelaxCharter:false
 canAuthorizeLive:false
}>

export type SharkClosedTradeLearningLike=Readonly<{
 learningRecordId:string
 strategyId:string
 instrumentId:string
 realized:Readonly<{netReturnBps:number}>
 execution:Readonly<{diagnosis:'BETTER_THAN_MODELED'|'AS_MODELED'|'WORSE_THAN_MODELED'}>
 sizing:Readonly<{diagnosis:'UNDER_SIZED'|'APPROPRIATE'|'OVER_SIZED'}>
 narrative:Readonly<{held:boolean}>
 lessonTags:readonly string[]
 evidenceIds:readonly string[]
 createdAt:string
 authority:'LEARNING_ONLY'
 financialAuthority:'NONE'
 canExecute:false
}>

export type PurseOutcomeLearningRecord=Readonly<{
 learningId:string
 decisionId:string
 lane:MoneyStrategyLane
 strategyId:string
 instrumentId:string
 allocatedMinor:bigint
 realizedReturnBps:number
 maxAdverseExcursionBps:number
 thesisHeld:boolean
 decisionQualityScoreBps:number
 lessonTags:readonly string[]
 evidenceIds:readonly string[]
 evaluatedAt:string
 authority:'LEARNING_ONLY'
 canAuthorizeLive:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())
const iso=(v:string,c:string)=>{if(Number.isNaN(Date.parse(v)))throw new Error(c)}

function laneFromLearningDomain(domain:string):MoneyStrategyLane{
 if(domain==='SPORTS_BETTING')return 'SPORTS'
 if(domain==='PREDICTION_MARKET')return 'PREDICTION'
 if(domain==='STOCK'||domain==='FOREX'||domain==='MEME'||domain==='CRYPTO')return domain
 throw new Error('PURSE_LEARNING_DOMAIN_UNSUPPORTED')
}

export function adaptPaperCalibrationToPurseMemory(c:StrategyCalibration):PurseLearningMemory{
 if(c.authority!=='LEARNING_ONLY'||c.canAuthorizeLive!==false)throw new Error('PURSE_PAPER_CALIBRATION_AUTHORITY_INVALID')
 iso(c.calibratedAt,'PURSE_PAPER_CALIBRATION_TIME_INVALID')
 const lane=laneFromLearningDomain(c.domain)
 const status:PurseLearningStatus=c.status==='SIMULATION_SUPPORTED'?'SUPPORTED':c.status==='SIMULATION_MIXED'?'MIXED':c.status==='SIMULATION_REJECTED'?'REJECTED':'INSUFFICIENT'
 const confidenceAdjustmentBps=status==='SUPPORTED'
  ?clamp(Math.round(((c.recommendedConfidenceBps??5000)-5000)/4),0,750)
  :status==='MIXED'?-250
  :status==='REJECTED'?-2500
  :0
 const sizeMultiplierBps=status==='SUPPORTED'?10000:status==='MIXED'?7000:status==='REJECTED'?0:8000
 return Object.freeze({
  memoryId:'purse-paper-learning:'+hash({calibrationId:c.calibrationId,status}),
  source:'PAPER_STRATEGY',lane,strategyId:c.strategyId,sampleWeight:Math.max(1,c.sampleSize),returnBps:c.meanReturnBps,
  downsideRateBps:c.downsideRateBps,executionQualityBps:clamp(Math.round(c.meanFillRateBps*(1-Math.min(10000,c.meanAbsSlippageBps)/10000)),0,10000),
  confidenceAdjustmentBps,sizeMultiplierBps,status,observedAt:c.calibratedAt,evidenceIds:unique(c.learningRecordIds),
  authority:'LEARNING_ONLY',canAuthorizeLive:false,
 })
}

export function adaptSharkClosedTradeToPurseMemory(x:SharkClosedTradeLearningLike):PurseLearningMemory{
 if(x.authority!=='LEARNING_ONLY'||x.financialAuthority!=='NONE'||x.canExecute!==false)throw new Error('PURSE_SHARK_LEARNING_AUTHORITY_INVALID')
 if(!x.learningRecordId.trim()||!x.strategyId.trim()||!x.instrumentId.trim()||!x.evidenceIds.length)throw new Error('PURSE_SHARK_LEARNING_PROVENANCE_REQUIRED')
 iso(x.createdAt,'PURSE_SHARK_LEARNING_TIME_INVALID')
 const executionQualityBps=x.execution.diagnosis==='BETTER_THAN_MODELED'?9500:x.execution.diagnosis==='AS_MODELED'?8500:5500
 const narrativePenalty=x.narrative.held?0:300
 const lossPenalty=x.realized.netReturnBps<0?Math.min(700,Math.abs(x.realized.netReturnBps)/4):0
 const confidenceAdjustmentBps=clamp(Math.round((x.realized.netReturnBps>0?250:-250)-narrativePenalty-lossPenalty),-1000,400)
 const sizeMultiplierBps=x.realized.netReturnBps<0&&!x.narrative.held?6500:x.execution.diagnosis==='WORSE_THAN_MODELED'?7500:10000
 const status:PurseLearningStatus=x.realized.netReturnBps>0&&x.narrative.held?'SUPPORTED':x.realized.netReturnBps<0&&!x.narrative.held?'MIXED':'MIXED'
 return Object.freeze({
  memoryId:'purse-shark-learning:'+hash({learningRecordId:x.learningRecordId}),
  source:'SHARK_CLOSED_TRADE',lane:'MEME',strategyId:x.strategyId,instrumentId:x.instrumentId,sampleWeight:1,returnBps:x.realized.netReturnBps,
  downsideRateBps:x.realized.netReturnBps<0?10000:0,executionQualityBps,confidenceAdjustmentBps,sizeMultiplierBps,status,observedAt:x.createdAt,
  evidenceIds:unique(x.evidenceIds),authority:'LEARNING_ONLY',canAuthorizeLive:false,
 })
}

export function createPurseOutcomeLearningRecord(input:{
 decisionId:string
 lane:MoneyStrategyLane
 strategyId:string
 instrumentId:string
 allocatedMinor:bigint
 realizedReturnBps:number
 maxAdverseExcursionBps:number
 thesisHeld:boolean
 evidenceIds:readonly string[]
 evaluatedAt:string
}):PurseOutcomeLearningRecord{
 if(!input.decisionId.trim()||!input.strategyId.trim()||!input.instrumentId.trim()||input.allocatedMinor<=0n||!input.evidenceIds.length)throw new Error('PURSE_OUTCOME_LEARNING_INPUT_INVALID')
 if(!Number.isInteger(input.realizedReturnBps)||!Number.isInteger(input.maxAdverseExcursionBps))throw new Error('PURSE_OUTCOME_LEARNING_BPS_INVALID')
 iso(input.evaluatedAt,'PURSE_OUTCOME_LEARNING_TIME_INVALID')
 const quality=clamp(input.realizedReturnBps-Math.max(0,-input.maxAdverseExcursionBps)/4-(input.thesisHeld?0:500),-10000,10000)
 const tags:string[]=[]
 if(input.realizedReturnBps>0)tags.push('NET_PROFITABLE')
 else if(input.realizedReturnBps<0)tags.push('NET_LOSS')
 else tags.push('NET_FLAT')
 if(!input.thesisHeld)tags.push('THESIS_FAILED_OR_DEGRADED')
 if(input.maxAdverseExcursionBps<=-1000)tags.push('HIGH_ADVERSE_EXCURSION')
 return Object.freeze({
  learningId:'purse-outcome-learning:'+hash({decisionId:input.decisionId,evaluatedAt:input.evaluatedAt,evidenceIds:[...input.evidenceIds].sort()}),
  decisionId:input.decisionId,lane:input.lane,strategyId:input.strategyId,instrumentId:input.instrumentId,allocatedMinor:input.allocatedMinor,
  realizedReturnBps:input.realizedReturnBps,maxAdverseExcursionBps:input.maxAdverseExcursionBps,thesisHeld:input.thesisHeld,decisionQualityScoreBps:Math.round(quality),
  lessonTags:unique(tags),evidenceIds:unique(input.evidenceIds),evaluatedAt:input.evaluatedAt,authority:'LEARNING_ONLY',canAuthorizeLive:false,
 })
}

export function adaptPurseOutcomeToLearningMemory(x:PurseOutcomeLearningRecord):PurseLearningMemory{
 if(x.authority!=='LEARNING_ONLY'||x.canAuthorizeLive!==false)throw new Error('PURSE_OUTCOME_LEARNING_AUTHORITY_INVALID')
 return Object.freeze({
  memoryId:'purse-outcome-memory:'+hash({learningId:x.learningId}),source:'PURSE_OUTCOME',lane:x.lane,strategyId:x.strategyId,instrumentId:x.instrumentId,
  sampleWeight:1,returnBps:x.realizedReturnBps,downsideRateBps:x.realizedReturnBps<0?10000:0,executionQualityBps:7500,
  confidenceAdjustmentBps:clamp(Math.round(x.decisionQualityScoreBps/10),-750,500),
  sizeMultiplierBps:x.decisionQualityScoreBps<0?7500:10000,status:x.decisionQualityScoreBps>0?'SUPPORTED':x.decisionQualityScoreBps<0?'MIXED':'INSUFFICIENT',
  observedAt:x.evaluatedAt,evidenceIds:x.evidenceIds,authority:'LEARNING_ONLY',canAuthorizeLive:false,
 })
}

export function buildPurseStrategyLearningProfile(input:{
 lane:MoneyStrategyLane
 strategyId:string
 memories:readonly PurseLearningMemory[]
 evaluatedAt:string
}):PurseStrategyLearningProfile{
 iso(input.evaluatedAt,'PURSE_LEARNING_PROFILE_TIME_INVALID')
 const xs=input.memories.filter(x=>x.lane===input.lane&&x.strategyId===input.strategyId&&x.observedAt<=input.evaluatedAt)
 if(xs.some(x=>x.authority!=='LEARNING_ONLY'||x.canAuthorizeLive!==false||x.sampleWeight<=0||!x.evidenceIds.length))throw new Error('PURSE_LEARNING_MEMORY_INVALID')
 const weight=xs.reduce((n,x)=>n+x.sampleWeight,0)
 const mean=(f:(x:PurseLearningMemory)=>number)=>weight?xs.reduce((n,x)=>n+f(x)*x.sampleWeight,0)/weight:0
 const hardRejected=xs.some(x=>x.source==='PAPER_STRATEGY'&&x.status==='REJECTED')
 const supportedWeight=xs.filter(x=>x.status==='SUPPORTED').reduce((n,x)=>n+x.sampleWeight,0)
 const rejectedWeight=xs.filter(x=>x.status==='REJECTED').reduce((n,x)=>n+x.sampleWeight,0)
 const status:PurseLearningStatus=hardRejected?'REJECTED':weight===0?'INSUFFICIENT':supportedWeight>=Math.max(2,rejectedWeight*2)?'SUPPORTED':rejectedWeight>supportedWeight?'REJECTED':'MIXED'
 const confidenceAdjustmentBps=hardRejected?-2500:clamp(Math.round(mean(x=>x.confidenceAdjustmentBps)),-2500,750)
 const sizeMultiplierBps=hardRejected?0:clamp(Math.round(mean(x=>x.sizeMultiplierBps))||8000,5000,10000)
 return Object.freeze({
  profileId:'purse-learning-profile:'+hash({lane:input.lane,strategyId:input.strategyId,ids:xs.map(x=>x.memoryId).sort(),evaluatedAt:input.evaluatedAt}),
  lane:input.lane,strategyId:input.strategyId,sampleWeight:weight,meanReturnBps:Math.round(mean(x=>x.returnBps)),meanDownsideRateBps:Math.round(mean(x=>x.downsideRateBps)),
  meanExecutionQualityBps:Math.round(mean(x=>x.executionQualityBps)),confidenceAdjustmentBps,sizeMultiplierBps,status,
  sourceMemoryIds:Object.freeze(xs.map(x=>x.memoryId).sort()),evidenceIds:unique(xs.flatMap(x=>x.evidenceIds)),evaluatedAt:input.evaluatedAt,authority:'LEARNING_ONLY',canAuthorizeLive:false,
 })
}

const FINANCE_PERSONALITY_SIGNALS=Object.freeze({
 patience:'personality-signal:money:patience',
 optionality:'personality-signal:money:cash-optionality',
 concentration:'personality-signal:money:concentration-discipline',
 contradiction:'personality-signal:money:contradiction-sensitivity',
})

export function derivePurseDecisionStyle(personality:PersonalityState):PurseDecisionStyle{
 if(!Number.isInteger(personality.version)||personality.version<0)throw new Error('PURSE_PERSONALITY_VERSION_INVALID')
 const accepted=personality.traits.filter(t=>t.status==='accepted')
 const strength=(id:string)=>{
  const t=accepted.find(x=>x.sourcePatternId===id)
  return t?clamp(Math.round(t.confidence*t.stability*10000),0,10000):0
 }
 const financeSignalIds:ReadonlySet<string>=new Set(Object.values(FINANCE_PERSONALITY_SIGNALS))
 const matched=accepted.filter(t=>financeSignalIds.has(t.sourcePatternId??''))
 return Object.freeze({
  styleId:'purse-decision-style:'+hash({personalityVersion:personality.version,traits:matched.map(t=>[t.sourcePatternId,t.confidence,t.stability,t.revision]).sort()}),
  personalityVersion:personality.version,patienceBiasBps:strength(FINANCE_PERSONALITY_SIGNALS.patience),
  cashOptionalityBiasBps:strength(FINANCE_PERSONALITY_SIGNALS.optionality),concentrationDisciplineBps:strength(FINANCE_PERSONALITY_SIGNALS.concentration),
  contradictionSensitivityBps:strength(FINANCE_PERSONALITY_SIGNALS.contradiction),evidenceIds:unique(matched.flatMap(t=>t.evidence.map(e=>e.id))),
  authority:'PERSONALITY_INFLUENCE_ONLY',canRelaxCharter:false,canAuthorizeLive:false,
 })
}

export type PurseLearningContext=Readonly<{
 contextId:string
 profiles:readonly PurseStrategyLearningProfile[]
 decisionStyle:PurseDecisionStyle
 sourceMemoryIds:readonly string[]
 evidenceIds:readonly string[]
 evaluatedAt:string
 authority:'LEARNING_CONTEXT_ONLY'
 canAuthorizeLive:false
}>

export function assemblePurseLearningContext(input:{
 paperCalibrations:readonly StrategyCalibration[]
 sharkClosedTrades:readonly SharkClosedTradeLearningLike[]
 personality:PersonalityState
 evaluatedAt:string
}):PurseLearningContext{
 iso(input.evaluatedAt,'PURSE_LEARNING_CONTEXT_TIME_INVALID')
 const memories:PurseLearningMemory[]=[
  ...input.paperCalibrations.filter(x=>x.calibratedAt<=input.evaluatedAt).map(adaptPaperCalibrationToPurseMemory),
  ...input.sharkClosedTrades.filter(x=>x.createdAt<=input.evaluatedAt).map(adaptSharkClosedTradeToPurseMemory),
 ]
 const keys=unique(memories.map(x=>x.lane+':'+x.strategyId))
 const profiles=keys.map(key=>{
  const separator=key.indexOf(':')
  const lane=key.slice(0,separator) as MoneyStrategyLane
  const strategyId=key.slice(separator+1)
  return buildPurseStrategyLearningProfile({lane,strategyId,memories,evaluatedAt:input.evaluatedAt})
 })
 const decisionStyle=derivePurseDecisionStyle(input.personality)
 return Object.freeze({
  contextId:'purse-learning-context:'+hash({profiles:profiles.map(x=>x.profileId).sort(),decisionStyleId:decisionStyle.styleId,evaluatedAt:input.evaluatedAt}),
  profiles:Object.freeze(profiles),decisionStyle,sourceMemoryIds:unique(memories.map(x=>x.memoryId)),
  evidenceIds:unique([...memories.flatMap(x=>x.evidenceIds),...decisionStyle.evidenceIds]),evaluatedAt:input.evaluatedAt,
  authority:'LEARNING_CONTEXT_ONLY',canAuthorizeLive:false,
 })
}
