import { createHash } from 'node:crypto'
import type { MoneyStrategyLane } from './money-commissioning-contracts.js'
import type { StrategyLearningRecord } from './autonomous-strategy-learning.js'
import type { SportsLearningEpisode } from './sports-learning-memory.js'
import type { PurseAutonomyMode } from './jhadina-purse-charter.js'

export type PurseLearningSource='MONEY_PAPER'|'SHARK'|'SPORTS'|'SHADOW'|'SIMULATION'

export type PurseLearningEpisode=Readonly<{
 episodeId:string
 source:PurseLearningSource
 sourceRecordId:string
 lane:MoneyStrategyLane
 strategyId:string
 instrumentId?:string
 scenarioId?:string
 returnBps:number
 decisionQualityBps:number
 executionQualityBps:number
 downsideOccurred:boolean
 thesisDisposition:'SUPPORTED'|'MIXED'|'INVALIDATED'|'UNKNOWN'
 sizingDiagnosis:'UNDER_SIZED'|'APPROPRIATE'|'OVER_SIZED'|'UNKNOWN'
 lessonTags:readonly string[]
 observedAt:string
 evidenceIds:readonly string[]
 authority:'PURSE_LEARNING_ONLY'
 financialAuthority:'NONE'
 canAuthorizeLive:false
 canExecute:false
}>

export type PurseStrategyLearningProfile=Readonly<{
 profileId:string
 lane:MoneyStrategyLane
 strategyId:string
 sampleSize:number
 meanReturnBps:number
 winRateBps:number
 downsideRateBps:number
 meanDecisionQualityBps:number
 meanExecutionQualityBps:number
 supportedThesisRateBps:number
 invalidatedThesisRateBps:number
 evidenceStrengthBps:number
 confidenceAdjustmentBps:number
 sizingMultiplierBps:number
 disposition:'INSUFFICIENT_EVIDENCE'|'SUPPORTED'|'MIXED'|'REJECTED'
 lessonTags:readonly string[]
 episodeIds:readonly string[]
 evidenceIds:readonly string[]
 calibratedAt:string
 authority:'PURSE_LEARNING_PROFILE_ONLY'
 financialAuthority:'NONE'
 canAuthorizeLive:false
 canExecute:false
}>

export type PursePersonalitySnapshot=Readonly<{
 version:number
 independentAssessmentRequired:boolean
 taste?:Readonly<{
  novelty:number
  experimentation:number
  conventionTolerance:number
 }>
 traits?:readonly Readonly<{
  id:string
  dimension?:string
  category?:string
  statement:string
  confidence:number
  stability:number
  status:string
 }>[]
 updatedAt:string
}>

export type PurseFinancialTemperament=Readonly<{
 temperamentId:string
 personalityVersion:number
 cashPatienceBps:number
 evidenceDisciplineBps:number
 explorationBps:number
 lossSensitivityBps:number
 independentAssessmentRequired:boolean
 livePersonalityRiskBoostAllowed:false
 paperExplorationOnly:boolean
 explanationStyle:'EVIDENCE_FIRST'|'BALANCED'|'EXPLORATORY'
 derivedAt:string
 evidenceIds:readonly string[]
 authority:'PURSE_TEMPERAMENT_ONLY'
 financialAuthority:'NONE'
 canAuthorizeLive:false
 canExecute:false
}>

export type PurseLearningContext=Readonly<{
 learningContextId:string
 profiles:readonly PurseStrategyLearningProfile[]
 temperament:PurseFinancialTemperament
 observedAt:string
 evidenceIds:readonly string[]
 authority:'PURSE_LEARNING_CONTEXT_ONLY'
 financialAuthority:'NONE'
 canAuthorizeLive:false
 canExecute:false
}>

export type PurseLearningAdjustment=Readonly<{
 profileId?:string
 confidenceDeltaBps:number
 sizingMultiplierBps:number
 scoreMultiplierBps:number
 minimumScoreBps:number
 reasonCodes:readonly string[]
 evidenceIds:readonly string[]
 authority:'PURSE_LEARNING_ADJUSTMENT_ONLY'
 canExecute:false
}>

export type PurseSharkLearningInput=Readonly<{
 learningRecordId:string
 strategyId:string
 instrumentId:string
 realized:Readonly<{netReturnBps:number}>
 sizing:Readonly<{diagnosis:'UNDER_SIZED'|'APPROPRIATE'|'OVER_SIZED'}>
 execution:Readonly<{diagnosis:'BETTER_THAN_MODELED'|'AS_MODELED'|'WORSE_THAN_MODELED';excessSlippageBps:number}>
 narrative:Readonly<{held:boolean;diagnosis:'CONFIRMED'|'DEGRADED_OR_FAILED'}>
 signalsWorked:readonly string[]
 signalsFailed:readonly string[]
 lessonTags:readonly string[]
 evidenceIds:readonly string[]
 createdAt:string
 authority:'LEARNING_ONLY'
 financialAuthority:'NONE'
 canExecute:false
}>

const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs.map(x=>x.trim()).filter(Boolean))].sort())
const bps=(n:number)=>clamp(Math.round(n),0,10000)
const iso=(v:string,code:string)=>{if(Number.isNaN(Date.parse(v)))throw new Error(code)}
const ratioBps=(count:number,total:number)=>total?Math.round(count*10000/total):0

function laneFromDomain(domain:StrategyLearningRecord['domain']):MoneyStrategyLane{
 if(domain==='SPORTS_BETTING')return 'SPORTS'
 if(domain==='PREDICTION_MARKET')return 'PREDICTION'
 return domain
}

export function purseLearningFromStrategyRecord(record:StrategyLearningRecord):PurseLearningEpisode{
 if(record.authority!=='LEARNING_ONLY'||record.canAuthorizeLive!==false)throw new Error('PURSE_PAPER_LEARNING_AUTHORITY_INVALID')
 if(!record.evidenceIds.length)throw new Error('PURSE_PAPER_LEARNING_EVIDENCE_REQUIRED')
 iso(record.evaluatedAt,'PURSE_PAPER_LEARNING_TIME_INVALID')
 const executionQualityBps=bps(record.executionQuality*10000)
 const decisionQualityBps=bps((record.outcomeScore+1)*5000)
 const tags:string[]=[]
 if(record.returnBps>0)tags.push('PAPER_NET_POSITIVE')
 if(record.returnBps<0)tags.push('PAPER_NET_NEGATIVE')
 if(record.fillRateBps<7000)tags.push('PAPER_EXECUTION_WEAK')
 if(Math.abs(record.slippageBps)>100)tags.push('PAPER_SLIPPAGE_HIGH')
 return Object.freeze({
  episodeId:'purse-learning:'+hash({source:'MONEY_PAPER',id:record.learningRecordId}),
  source:'MONEY_PAPER',sourceRecordId:record.learningRecordId,lane:laneFromDomain(record.domain),strategyId:record.strategyId,scenarioId:record.scenarioId,
  returnBps:record.returnBps,decisionQualityBps,executionQualityBps,downsideOccurred:record.returnBps<0,
  thesisDisposition:record.returnBps>0?'SUPPORTED':record.returnBps<0?'INVALIDATED':'MIXED',sizingDiagnosis:'UNKNOWN',
  lessonTags:unique(tags),observedAt:record.evaluatedAt,evidenceIds:unique(record.evidenceIds),
  authority:'PURSE_LEARNING_ONLY',financialAuthority:'NONE',canAuthorizeLive:false,canExecute:false,
 })
}

export function purseLearningFromSportsEpisode(episode:SportsLearningEpisode):PurseLearningEpisode{
 if(episode.authority!=='SPORTS_LEARNING_MEMORY'||episode.canAuthorizeLive!==false||episode.canExecute!==false)throw new Error('PURSE_SPORTS_LEARNING_AUTHORITY_INVALID')
 if(!episode.evidenceIds.length)throw new Error('PURSE_SPORTS_LEARNING_EVIDENCE_REQUIRED')
 iso(episode.resolvedAt,'PURSE_SPORTS_LEARNING_TIME_INVALID')
 const good=episode.processClass.startsWith('GOOD_PROCESS')
 const nonDecision=episode.processClass==='NON_DECISION_RESULT'
 const quality=nonDecision?5000:good?9000:2500
 const disposition=nonDecision?'UNKNOWN':good?(episode.returnBps>=0?'SUPPORTED':'MIXED'):'INVALIDATED'
 return Object.freeze({
  episodeId:'purse-learning:'+hash({source:'SPORTS',id:episode.episodeId}),
  source:'SPORTS',sourceRecordId:episode.episodeId,lane:'SPORTS',strategyId:episode.strategyId,instrumentId:'sports:'+episode.eventId,scenarioId:episode.learningRecord.scenarioId,
  returnBps:episode.returnBps,decisionQualityBps:quality,executionQualityBps:bps(episode.learningRecord.executionQuality*10000),downsideOccurred:episode.returnBps<0,
  thesisDisposition:disposition,sizingDiagnosis:'UNKNOWN',lessonTags:unique(['PROCESS:'+episode.processClass]),
  observedAt:episode.resolvedAt,evidenceIds:unique(episode.evidenceIds),authority:'PURSE_LEARNING_ONLY',financialAuthority:'NONE',canAuthorizeLive:false,canExecute:false,
 })
}

export function purseLearningFromShark(record:PurseSharkLearningInput):PurseLearningEpisode{
 if(record.authority!=='LEARNING_ONLY'||record.financialAuthority!=='NONE'||record.canExecute!==false)throw new Error('PURSE_SHARK_LEARNING_AUTHORITY_INVALID')
 if(!record.evidenceIds.length)throw new Error('PURSE_SHARK_LEARNING_EVIDENCE_REQUIRED')
 iso(record.createdAt,'PURSE_SHARK_LEARNING_TIME_INVALID')
 const signalTotal=record.signalsWorked.length+record.signalsFailed.length
 const signalQuality=signalTotal?ratioBps(record.signalsWorked.length,signalTotal):5000
 const executionQuality=record.execution.diagnosis==='BETTER_THAN_MODELED'?9500:record.execution.diagnosis==='AS_MODELED'?8000:4000
 const narrativeQuality=record.narrative.held?9000:3000
 const decisionQualityBps=Math.round((signalQuality+narrativeQuality+bps(5000+record.realized.netReturnBps))/3)
 return Object.freeze({
  episodeId:'purse-learning:'+hash({source:'SHARK',id:record.learningRecordId}),
  source:'SHARK',sourceRecordId:record.learningRecordId,lane:'MEME',strategyId:record.strategyId,instrumentId:record.instrumentId,
  returnBps:record.realized.netReturnBps,decisionQualityBps:bps(decisionQualityBps),executionQualityBps:executionQuality,downsideOccurred:record.realized.netReturnBps<0,
  thesisDisposition:record.narrative.held?(record.realized.netReturnBps>=0?'SUPPORTED':'MIXED'):'INVALIDATED',sizingDiagnosis:record.sizing.diagnosis,
  lessonTags:unique([...record.lessonTags,...record.signalsFailed.map(x=>'SIGNAL_FAILED:'+x),...record.signalsWorked.map(x=>'SIGNAL_WORKED:'+x)]),
  observedAt:record.createdAt,evidenceIds:unique(record.evidenceIds),authority:'PURSE_LEARNING_ONLY',financialAuthority:'NONE',canAuthorizeLive:false,canExecute:false,
 })
}

export function buildPurseStrategyLearningProfile(input:{
 lane:MoneyStrategyLane
 strategyId:string
 episodes:readonly PurseLearningEpisode[]
 calibratedAt:string
 minimumSamples?:number
}):PurseStrategyLearningProfile{
 iso(input.calibratedAt,'PURSE_LEARNING_PROFILE_TIME_INVALID')
 const min=Math.max(3,input.minimumSamples??12)
 const xs=input.episodes.filter(x=>x.lane===input.lane&&x.strategyId===input.strategyId)
 if(xs.some(x=>x.authority!=='PURSE_LEARNING_ONLY'||x.financialAuthority!=='NONE'||x.canAuthorizeLive!==false||x.canExecute!==false))throw new Error('PURSE_LEARNING_EPISODE_AUTHORITY_INVALID')
 const n=xs.length
 const mean=(f:(x:PurseLearningEpisode)=>number)=>n?xs.reduce((s,x)=>s+f(x),0)/n:0
 const meanReturnBps=Math.round(mean(x=>x.returnBps))
 const winRateBps=ratioBps(xs.filter(x=>x.returnBps>0).length,n)
 const downsideRateBps=ratioBps(xs.filter(x=>x.downsideOccurred).length,n)
 const meanDecisionQualityBps=Math.round(mean(x=>x.decisionQualityBps))
 const meanExecutionQualityBps=Math.round(mean(x=>x.executionQualityBps))
 const supportedThesisRateBps=ratioBps(xs.filter(x=>x.thesisDisposition==='SUPPORTED').length,n)
 const invalidatedThesisRateBps=ratioBps(xs.filter(x=>x.thesisDisposition==='INVALIDATED').length,n)
 const evidenceStrengthBps=bps((Math.min(1,n/min)*0.6+(meanExecutionQualityBps/10000)*0.4)*10000)
 let disposition:PurseStrategyLearningProfile['disposition']='INSUFFICIENT_EVIDENCE'
 if(n>=min){
  if(meanReturnBps>0&&downsideRateBps<=5500&&meanDecisionQualityBps>=6000&&meanExecutionQualityBps>=6500)disposition='SUPPORTED'
  else if(meanReturnBps>-300&&downsideRateBps<=7000&&meanDecisionQualityBps>=4500)disposition='MIXED'
  else disposition='REJECTED'
 }
 const rawConfidence=Math.round((meanReturnBps/8)+(winRateBps-5000)/8+(meanDecisionQualityBps-5000)/10+(meanExecutionQualityBps-5000)/12)
 const confidenceAdjustmentBps=disposition==='INSUFFICIENT_EVIDENCE'?Math.min(0,rawConfidence):clamp(rawConfidence,-2500,1000)
 const sizingMultiplierBps=
  disposition==='SUPPORTED'?clamp(7000+Math.round(evidenceStrengthBps*0.3),7000,10000):
  disposition==='MIXED'?clamp(4500+Math.round(evidenceStrengthBps*0.2),4500,7000):
  disposition==='REJECTED'?2500:
  5000
 const episodeIds=Object.freeze(xs.map(x=>x.episodeId).sort())
 return Object.freeze({
  profileId:'purse-learning-profile:'+hash({lane:input.lane,strategyId:input.strategyId,episodeIds,calibratedAt:input.calibratedAt}),
  lane:input.lane,strategyId:input.strategyId,sampleSize:n,meanReturnBps,winRateBps,downsideRateBps,meanDecisionQualityBps,meanExecutionQualityBps,
  supportedThesisRateBps,invalidatedThesisRateBps,evidenceStrengthBps,confidenceAdjustmentBps,sizingMultiplierBps,disposition,
  lessonTags:unique(xs.flatMap(x=>x.lessonTags)),episodeIds,evidenceIds:unique(xs.flatMap(x=>x.evidenceIds)),calibratedAt:input.calibratedAt,
  authority:'PURSE_LEARNING_PROFILE_ONLY',financialAuthority:'NONE',canAuthorizeLive:false,canExecute:false,
 })
}

export function derivePurseFinancialTemperament(input:{
 personality:PursePersonalitySnapshot
 profiles:readonly PurseStrategyLearningProfile[]
 autonomyMode:PurseAutonomyMode
 derivedAt:string
 evidenceIds:readonly string[]
}):PurseFinancialTemperament{
 iso(input.derivedAt,'PURSE_TEMPERAMENT_TIME_INVALID')
 const p=input.personality
 if(!Number.isInteger(p.version)||p.version<0)throw new Error('PURSE_TEMPERAMENT_PERSONALITY_VERSION_INVALID')
 if(!input.evidenceIds.length)throw new Error('PURSE_TEMPERAMENT_EVIDENCE_REQUIRED')
 const novelty=clamp(p.taste?.novelty??0.5,0,1)
 const experimentation=clamp(p.taste?.experimentation??0.5,0,1)
 const convention=clamp(p.taste?.conventionTolerance??0.5,0,1)
 const rejectedRate=input.profiles.length?input.profiles.filter(x=>x.disposition==='REJECTED').length/input.profiles.length:0
 const supportedRate=input.profiles.length?input.profiles.filter(x=>x.disposition==='SUPPORTED').length/input.profiles.length:0
 const downsideAverage=input.profiles.length?input.profiles.reduce((n,x)=>n+x.downsideRateBps,0)/input.profiles.length:5000
 const cashPatienceBps=bps(5000+downsideAverage*0.3+rejectedRate*2000-supportedRate*1000)
 const evidenceDisciplineBps=bps(6000+(p.independentAssessmentRequired?1500:0)+rejectedRate*1500)
 const paperMode=input.autonomyMode==='PAPER_AUTONOMOUS'||input.autonomyMode==='SHADOW_AUTONOMOUS'
 const explorationBps=paperMode?bps((novelty*0.45+experimentation*0.45+(1-convention)*0.1)*5000):0
 const lossSensitivityBps=bps(5000+downsideAverage*0.4+rejectedRate*1500)
 const explanationStyle:PurseFinancialTemperament['explanationStyle']=evidenceDisciplineBps>=7500?'EVIDENCE_FIRST':explorationBps>=2500?'EXPLORATORY':'BALANCED'
 return Object.freeze({
  temperamentId:'purse-temperament:'+hash({personalityVersion:p.version,profileIds:input.profiles.map(x=>x.profileId).sort(),mode:input.autonomyMode,derivedAt:input.derivedAt}),
  personalityVersion:p.version,cashPatienceBps,evidenceDisciplineBps,explorationBps,lossSensitivityBps,independentAssessmentRequired:p.independentAssessmentRequired,
  livePersonalityRiskBoostAllowed:false,paperExplorationOnly:true,explanationStyle,derivedAt:input.derivedAt,evidenceIds:unique(input.evidenceIds),
  authority:'PURSE_TEMPERAMENT_ONLY',financialAuthority:'NONE',canAuthorizeLive:false,canExecute:false,
 })
}

export function buildPurseLearningContext(input:{
 profiles:readonly PurseStrategyLearningProfile[]
 temperament:PurseFinancialTemperament
 observedAt:string
}):PurseLearningContext{
 iso(input.observedAt,'PURSE_LEARNING_CONTEXT_TIME_INVALID')
 if(input.temperament.authority!=='PURSE_TEMPERAMENT_ONLY'||input.temperament.financialAuthority!=='NONE'||input.temperament.canExecute!==false)throw new Error('PURSE_TEMPERAMENT_AUTHORITY_INVALID')
 for(const profile of input.profiles){
  if(profile.authority!=='PURSE_LEARNING_PROFILE_ONLY'||profile.financialAuthority!=='NONE'||profile.canAuthorizeLive!==false||profile.canExecute!==false)throw new Error('PURSE_LEARNING_PROFILE_AUTHORITY_INVALID')
  if(profile.calibratedAt>input.observedAt)throw new Error('PURSE_LEARNING_PROFILE_FUTURE_EVIDENCE')
 }
 const evidenceIds=unique([...input.temperament.evidenceIds,...input.profiles.flatMap(x=>x.evidenceIds)])
 return Object.freeze({
  learningContextId:'purse-learning-context:'+hash({profiles:input.profiles.map(x=>x.profileId).sort(),temperament:input.temperament.temperamentId,observedAt:input.observedAt}),
  profiles:Object.freeze([...input.profiles]),temperament:input.temperament,observedAt:input.observedAt,evidenceIds,
  authority:'PURSE_LEARNING_CONTEXT_ONLY',financialAuthority:'NONE',canAuthorizeLive:false,canExecute:false,
 })
}

export function learningAdjustmentForOpportunity(input:{
 context?:PurseLearningContext
 lane:MoneyStrategyLane
 strategyId:string
 autonomyMode:PurseAutonomyMode
}):PurseLearningAdjustment{
 const profile=input.context?.profiles.find(x=>x.lane===input.lane&&x.strategyId===input.strategyId)
 const temperament=input.context?.temperament
 const reasons:string[]=[]
 let confidenceDeltaBps=0
 let sizingMultiplierBps=10000
 let scoreMultiplierBps=10000
 let minimumScoreBps=0
 const evidenceIds:string[]=[]

 if(profile){
  confidenceDeltaBps=profile.confidenceAdjustmentBps
  sizingMultiplierBps=profile.sizingMultiplierBps
  scoreMultiplierBps=profile.disposition==='SUPPORTED'?10000:profile.disposition==='MIXED'?8500:profile.disposition==='REJECTED'?4000:7000
  evidenceIds.push(...profile.evidenceIds)
  reasons.push('LEARNING_PROFILE:'+profile.disposition)
  if(profile.disposition==='REJECTED')reasons.push('LEARNING_STRATEGY_DEGRADED')
  if(profile.sizingMultiplierBps<10000)reasons.push('LEARNING_REDUCED_SIZE')
 }else{
  reasons.push('LEARNING_PROFILE_UNAVAILABLE')
 }

 if(temperament){
  evidenceIds.push(...temperament.evidenceIds)
  const live=input.autonomyMode==='LIVE_GOVERNED_INTENTS'
  if(live){
   if(temperament.explorationBps!==0)throw new Error('PURSE_LIVE_PERSONALITY_EXPLORATION_FORBIDDEN')
   reasons.push('PERSONALITY_LIVE_RISK_BOOST_FORBIDDEN')
  }else if(temperament.explorationBps>0&&!profile){
   scoreMultiplierBps=Math.min(10000,scoreMultiplierBps+Math.round(temperament.explorationBps*0.2))
   reasons.push('PAPER_EXPLORATION_ALLOWED')
  }
  minimumScoreBps=Math.round(temperament.cashPatienceBps*0.02)
  if(temperament.evidenceDisciplineBps>=7500)reasons.push('HEIGHTENED_EVIDENCE_DISCIPLINE')
 }
 return Object.freeze({
  profileId:profile?.profileId,confidenceDeltaBps:clamp(confidenceDeltaBps,-2500,1000),sizingMultiplierBps:clamp(sizingMultiplierBps,2500,10000),
  scoreMultiplierBps:clamp(scoreMultiplierBps,2500,10000),minimumScoreBps:bps(minimumScoreBps),reasonCodes:unique(reasons),evidenceIds:unique(evidenceIds),
  authority:'PURSE_LEARNING_ADJUSTMENT_ONLY',canExecute:false,
 })
}
