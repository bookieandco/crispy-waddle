import type {SupabaseClient} from '@supabase/supabase-js'
import {
  buildPurseStrategyLearningProfile,
  buildSharkShadowCounterfactual,
  buildSharkShadowDecisionTwin,
  buildSharkShadowMemoryCard,
  buildSharkShadowReplayManifest,
  calibrateSharkShadowPerformance,
  observeSharkShadowOutcome,
  simulateSharkShadowExecution,
  type PurseLearningMemory,
  type SharkShadowCounterfactualLesson,
  type SharkShadowDecisionTwin,
  type SharkShadowHorizon,
} from '@jhadina/money-core'
import {
  appendShadowCalibration,
  appendShadowDecision,
  appendShadowExecution,
  appendShadowLesson,
  appendShadowMemory,
  appendShadowObservation,
  appendShadowPosition,
  appendShadowPurseMemory,
  appendShadowReplay,
  appendShadowStrategyProfile,
  existingShadowHorizons,
  findShadowDecisionByRuntimeRun,
  listShadowDecisions,
  listShadowLessons,
  listShadowPurseMemories,
  listShadowRuntimeCandidates,
  loadHistoricalObservationAtOrAfter,
  loadHistoricalObservationAtOrBefore,
  loadLaunchId,
  loadShadowCharterMode,
  loadShadowExecution,
  loadShadowExecutionHint,
  loadShadowIngressContext,
  loadShadowInstrumentId,
} from './shark-shadow-learning-repository'

export type SharkShadowLearningMode='LIVE'|'REPLAY'

export type SharkShadowLearningCycleReceipt=Readonly<{
  mode:SharkShadowLearningMode
  ranAt:string
  runtimeCandidates:number
  decisionsInserted:number
  decisionsReplayed:number
  simulationsInserted:number
  positionsInserted:number
  observationsInserted:number
  lessonsInserted:number
  purseMemoriesInserted:number
  calibrationsInserted:number
  memoriesInserted:number
  profilesInserted:number
  replaysInserted:number
  futureEvidenceRejected:number
  skipped:number
  failures:readonly Readonly<{subject:string;reason:string}>[]
  authority:'SHADOW_LEARNING_ONLY'
  canExecute:false
  canAuthorizeLive:false
}>

const HORIZONS:readonly Readonly<{name:SharkShadowHorizon;offsetMs:number;latestMs:number}>[]=Object.freeze([
  {name:'15M',offsetMs:15*60_000,latestMs:60*60_000},
  {name:'1H',offsetMs:60*60_000,latestMs:4*60*60_000},
  {name:'4H',offsetMs:4*60*60_000,latestMs:24*60*60_000},
  {name:'24H',offsetMs:24*60*60_000,latestMs:3*24*60*60_000},
  {name:'3D',offsetMs:3*24*60*60_000,latestMs:7*24*60*60_000},
  {name:'7D',offsetMs:7*24*60*60_000,latestMs:14*24*60*60_000},
])
const iso=(v:string,code:string)=>{if(!v||Number.isNaN(Date.parse(v)))throw new Error(code)}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
const unique=<T>(xs:readonly T[])=>[...new Set(xs)]
const asBig=(raw:string|undefined,fallback:bigint,min:bigint,max:bigint)=>{
  if(!raw)return fallback
  try{const n=BigInt(raw);return n>=min&&n<=max?n:fallback}catch{return fallback}
}

export function shadowHorizonTarget(decidedAt:string,horizon:SharkShadowHorizon):Readonly<{dueAt:string;latestAt:string}>{
  iso(decidedAt,'SHADOW_HORIZON_DECISION_TIME_INVALID')
  const h=HORIZONS.find(x=>x.name===horizon)
  if(!h)throw new Error('SHADOW_HORIZON_INVALID')
  const t=Date.parse(decidedAt)
  return Object.freeze({dueAt:new Date(t+h.offsetMs).toISOString(),latestAt:new Date(t+h.latestMs-1).toISOString()})
}

function stableCandidate(disposition:string,mode:string|undefined):boolean{
  if(disposition==='BLOCKED'||disposition==='PURSE_REJECTED'||disposition==='AUTONOMOUS_INTENT_READY')return true
  if(disposition==='ALLOCATED')return mode==='PAPER_AUTONOMOUS'||mode==='SHADOW_AUTONOMOUS'
  return false
}

function defaultNotional():bigint{
  return asBig(process.env.MONEY_SHARK_SHADOW_DEFAULT_NOTIONAL_MINOR,1000n,1n,1_000_000_000n)
}

function launchOutcome(target:{liquidityRemoved?:boolean;tradingHalted?:boolean}):'RUG'|'FAILED'|'UNKNOWN'{
  if(target.liquidityRemoved)return 'RUG'
  if(target.tradingHalted)return 'FAILED'
  return 'UNKNOWN'
}

function latestLessonPerDecision(xs:readonly SharkShadowCounterfactualLesson[]):readonly SharkShadowCounterfactualLesson[]{
  const rank:Record<SharkShadowHorizon,number>={'15M':1,'1H':2,'4H':3,'24H':4,'3D':5,'7D':6}
  const best=new Map<string,SharkShadowCounterfactualLesson>()
  for(const x of xs){
    const prior=best.get(x.decisionId)
    if(!prior||rank[x.horizon]>rank[prior.horizon]||(rank[x.horizon]===rank[prior.horizon]&&x.evaluatedAt>prior.evaluatedAt))best.set(x.decisionId,x)
  }
  return Object.freeze([...best.values()])
}

export function shadowPurseMemoryFromLesson(lesson:SharkShadowCounterfactualLesson):PurseLearningMemory{
  if(lesson.authority!=='LEARNING_ONLY'||lesson.canAuthorizeLive!==false||lesson.canExecute!==false)throw new Error('SHADOW_PURSE_LESSON_AUTHORITY_INVALID')
  const q=lesson.decisionQualityBps
  const executionQualityBps=clamp(10000-lesson.executionCostBps*4,2500,10000)
  const confidenceAdjustmentBps=clamp(Math.round(q/12-lesson.confidenceErrorBps/25),-1200,600)
  const sizeMultiplierBps=q<=-1500?5000:q<0?7000:q>=1000?10000:8500
  const status:PurseLearningMemory['status']=q>=500?'SUPPORTED':q<=-1000?'REJECTED':q<0?'MIXED':'INSUFFICIENT'
  return Object.freeze({
    memoryId:'purse-shadow-learning:'+lesson.lessonId,
    source:'PURSE_OUTCOME',
    lane:'MEME',
    strategyId:lesson.strategyId,
    instrumentId:lesson.instrumentId,
    sampleWeight:1,
    returnBps:q,
    downsideRateBps:q<0?10000:0,
    executionQualityBps,
    confidenceAdjustmentBps,
    sizeMultiplierBps,
    status,
    observedAt:lesson.evaluatedAt,
    evidenceIds:lesson.evidenceIds,
    authority:'LEARNING_ONLY',
    canAuthorizeLive:false,
  })
}

async function twinStableRuntime(input:{client:SupabaseClient;now:string;since:string;limit:number;mode:SharkShadowLearningMode;receipt:any}):Promise<void>{
  const rows=await listShadowRuntimeCandidates(input.client,{since:input.since,now:input.now,limit:input.limit})
  input.receipt.runtimeCandidates=rows.length
  for(const row of rows){
    try{
      const existing=await findShadowDecisionByRuntimeRun(input.client,row.runId)
      if(existing){input.receipt.decisionsReplayed++;continue}
      const charterMode=await loadShadowCharterMode(input.client,row.charterId)
      if(!stableCandidate(row.disposition,charterMode)){input.receipt.skipped++;continue}
      const context=await loadShadowIngressContext(input.client,row.envelopeId)
      const assessment=context.envelope?.assessment
      if(!assessment)throw new Error('SHADOW_ENVELOPE_ASSESSMENT_MISSING')
      const instrumentId=await loadShadowInstrumentId(input.client,row.opportunityId,context.chainId,context.tokenAddress)
      const hint=await loadShadowExecutionHint(input.client,{
        envelopeId:row.envelopeId,charterId:row.charterId,opportunityId:row.opportunityId,defaultNotionalMinor:defaultNotional(),
      })
      const market=context.market
      const d=buildSharkShadowDecisionTwin({
        runtimeRunId:row.runId,envelopeId:row.envelopeId,charterId:row.charterId,userId:row.userId,cofferId:row.cofferId,
        opportunityId:row.opportunityId,disposition:row.disposition,tradeType:String(assessment.tradeType??'meme'),
        chainId:context.chainId,tokenAddress:context.tokenAddress,instrumentId,sourceConfidence:Number(assessment.confidence??0),
        sourceRisk:Number(assessment.sourceRisk?.overallRisk??1),
        sourceGroups:(assessment.evidenceRefs??[]).map((x:any)=>String(x.sourceGroup??x.source??'unknown')),
        proposedNotionalMinor:hint.proposedNotionalMinor,side:hint.side,informationCutoff:row.informationCutoff,decidedAt:row.completedAt,
        market:{
          chainId:context.chainId,tokenAddress:context.tokenAddress,liquidityUsd:Number(market.liquidityUsd??0),volume24hUsd:Number(market.volume24hUsd??0),
          buys24h:Number(market.buys24h??0),sells24h:Number(market.sells24h??0),anomalyScore:Number(market.anomalyScore??0),
          observedAt:String(market.observedAt),availableAt:String(market.availableAt),evidenceIds:(market.evidenceIds??[]).map(String),
        },
        evidenceIds:unique([...row.evidenceIds,...hint.evidenceIds,(market.evidenceId?String(market.evidenceId):'')].filter(Boolean)),
      })
      const decisionDisposition=await appendShadowDecision(input.client,d)
      if(decisionDisposition==='INSERTED')input.receipt.decisionsInserted++;else input.receipt.decisionsReplayed++
      const s=simulateSharkShadowExecution({decision:d,simulatedAt:row.completedAt,requestedNotionalMinor:d.action==='PAPER_TRADE'?hint.proposedNotionalMinor:undefined,routeSource:hint.routeSource,routeEvidenceIds:hint.evidenceIds})
      if(await appendShadowExecution(input.client,s)==='INSERTED')input.receipt.simulationsInserted++
      if(await appendShadowPosition(input.client,d,s)==='INSERTED')input.receipt.positionsInserted++
    }catch(error){
      input.receipt.failures.push({subject:row.runId,reason:error instanceof Error?error.message:String(error)})
    }
  }
}

async function observeOutcomes(input:{client:SupabaseClient;now:string;since:string;limit:number;receipt:any}):Promise<Map<string,{decision:SharkShadowDecisionTwin;cofferId:string}>>{
  const decisions=await listShadowDecisions(input.client,{since:input.since,now:input.now,limit:Math.max(input.limit*4,500)})
  const touched=new Map<string,{decision:SharkShadowDecisionTwin;cofferId:string}>()
  for(const d of decisions){
    try{
      const execution=await loadShadowExecution(input.client,d.decisionId)
      if(!execution){input.receipt.skipped++;continue}
      const launchId=await loadLaunchId(input.client,{chainId:d.chainId,tokenAddress:d.tokenAddress})
      if(!launchId){input.receipt.skipped++;continue}
      const baseline=await loadHistoricalObservationAtOrBefore(input.client,launchId,d.decidedAt)
      const done=await existingShadowHorizons(input.client,d.decisionId)
      for(const h of HORIZONS){
        if(done.has(h.name))continue
        const targetWindow=shadowHorizonTarget(d.decidedAt,h.name)
        if(targetWindow.dueAt>input.now)continue
        const upper=targetWindow.latestAt<input.now?targetWindow.latestAt:input.now
        const target=await loadHistoricalObservationAtOrAfter(input.client,launchId,targetWindow.dueAt,upper)
        if(!target){input.receipt.skipped++;continue}
        if(target.observedAt<targetWindow.dueAt||target.observedAt>upper){
          input.receipt.futureEvidenceRejected++
          continue
        }
        const o=observeSharkShadowOutcome({
          decision:d,horizon:h.name,observedAt:target.observedAt,
          baselineLaunchReturnPct:baseline?.priceReturnFromLaunchPct,observedLaunchReturnPct:target.priceReturnFromLaunchPct,
          peakReturnPct:target.peakReturnPct,maxDrawdownPct:target.maxDrawdownPct,
          baselineLiquidityUsd:baseline?.currentLiquidityUsd??baseline?.initialLiquidityUsd??d.market.liquidityUsd,
          observedLiquidityUsd:target.currentLiquidityUsd,
          launchOutcome:launchOutcome(target),liquidityRemoved:target.liquidityRemoved,tradingHalted:target.tradingHalted,
          evidenceIds:unique([target.observationId,...target.evidenceIds,...(baseline?[baseline.observationId,...baseline.evidenceIds]:[])]),
        })
        if(await appendShadowObservation(input.client,o)==='INSERTED')input.receipt.observationsInserted++
        const lesson=buildSharkShadowCounterfactual({decision:d,execution,observation:o})
        if(await appendShadowLesson(input.client,lesson)==='INSERTED')input.receipt.lessonsInserted++
        const purse=shadowPurseMemoryFromLesson(lesson)
        if(await appendShadowPurseMemory(input.client,{
          eventId:'shadow-purse-event:'+lesson.lessonId,userId:d.userId,cofferId:d.cofferId,strategyId:d.strategyId,instrumentId:d.instrumentId,
          payload:purse,observedAt:purse.observedAt,evidenceIds:purse.evidenceIds,
        })==='INSERTED')input.receipt.purseMemoriesInserted++
        touched.set(d.userId+'|'+d.strategyId,{decision:d,cofferId:d.cofferId})
      }
    }catch(error){
      input.receipt.failures.push({subject:d.decisionId,reason:error instanceof Error?error.message:String(error)})
    }
  }
  return touched
}

async function calibrateTouched(input:{client:SupabaseClient;now:string;touched:Map<string,{decision:SharkShadowDecisionTwin;cofferId:string}>;receipt:any}):Promise<void>{
  for(const [key,ctx] of input.touched){
    try{
      const [userId,strategyId]=key.split('|')
      if(!userId||!strategyId)continue
      const all=await listShadowLessons(input.client,{userId,strategyId,through:input.now,limit:5000})
      const lessons=latestLessonPerDecision(all)
      if(!lessons.length)continue
      const calibration=calibrateSharkShadowPerformance({userId,strategyId,lessons,calibratedAt:input.now})
      if(await appendShadowCalibration(input.client,calibration)==='INSERTED')input.receipt.calibrationsInserted++
      for(const regime of unique(lessons.map(x=>x.marketRegime))){
        const card=buildSharkShadowMemoryCard({userId,strategyId,marketRegime:regime,lessons,calibration,createdAt:input.now})
        if(await appendShadowMemory(input.client,card)==='INSERTED')input.receipt.memoriesInserted++
      }
      const rawMemories=await listShadowPurseMemories(input.client,{userId,strategyId,through:input.now,limit:5000})
      const purseMemories=rawMemories.filter((x:any)=>x?.authority==='LEARNING_ONLY'&&x?.canAuthorizeLive===false) as PurseLearningMemory[]
      const profile=buildPurseStrategyLearningProfile({lane:'MEME',strategyId,memories:purseMemories,evaluatedAt:input.now})
      if(await appendShadowStrategyProfile(input.client,{
        eventId:'shadow-strategy-profile-event:'+profile.profileId,userId,cofferId:ctx.cofferId,strategyId,payload:profile,
        observedAt:input.now,evidenceIds:profile.evidenceIds.length?profile.evidenceIds:[calibration.calibrationId],
      })==='INSERTED')input.receipt.profilesInserted++
    }catch(error){
      input.receipt.failures.push({subject:key,reason:error instanceof Error?error.message:String(error)})
    }
  }
}

async function persistReplayManifests(input:{client:SupabaseClient;since:string;now:string;receipt:any}):Promise<void>{
  const decisions=await listShadowDecisions(input.client,{since:input.since,now:input.now,limit:2000})
  for(const userId of unique(decisions.map(x=>x.userId))){
    const userDecisions=decisions.filter(x=>x.userId===userId)
    const lessonRows:SharkShadowCounterfactualLesson[]=[]
    for(const strategyId of unique(userDecisions.map(x=>x.strategyId))){
      lessonRows.push(...await listShadowLessons(input.client,{userId,strategyId,through:input.now,limit:5000}))
    }
    const manifest=buildSharkShadowReplayManifest({
      userId,from:input.since,to:input.now,generatedAt:input.now,
      decisionIds:userDecisions.map(x=>x.decisionId),
      observationIds:unique(lessonRows.map(x=>x.evidenceIds.find(id=>id.startsWith('shark-shadow-observation:'))).filter((x):x is string=>Boolean(x))),
      lessonIds:unique(lessonRows.map(x=>x.lessonId)),
      futureEvidenceRejected:input.receipt.futureEvidenceRejected,
    })
    if(await appendShadowReplay(input.client,manifest)==='INSERTED')input.receipt.replaysInserted++
  }
}

export async function runSharkShadowLearningCycle(input:Readonly<{
  client:SupabaseClient
  now?:string
  mode?:SharkShadowLearningMode
  lookbackHours?:number
  limit?:number
}>):Promise<SharkShadowLearningCycleReceipt>{
  const now=input.now??new Date().toISOString()
  iso(now,'SHADOW_RUNTIME_NOW_INVALID')
  const mode=input.mode??'LIVE'
  const lookbackHours=Math.max(1,Math.min(mode==='REPLAY'?24*365*5:24*30,Math.trunc(input.lookbackHours??(mode==='REPLAY'?24*365:24*14))))
  const limit=Math.max(1,Math.min(1000,Math.trunc(input.limit??(mode==='REPLAY'?500:100))))
  const since=new Date(Date.parse(now)-lookbackHours*60*60_000).toISOString()
  const receipt:any={
    mode,ranAt:now,runtimeCandidates:0,decisionsInserted:0,decisionsReplayed:0,simulationsInserted:0,positionsInserted:0,
    observationsInserted:0,lessonsInserted:0,purseMemoriesInserted:0,calibrationsInserted:0,memoriesInserted:0,profilesInserted:0,
    replaysInserted:0,futureEvidenceRejected:0,skipped:0,failures:[],
  }
  await twinStableRuntime({client:input.client,now,since,limit,mode,receipt})
  const touched=await observeOutcomes({client:input.client,now,since,limit,receipt})
  await calibrateTouched({client:input.client,now,touched,receipt})
  if(mode==='REPLAY')await persistReplayManifests({client:input.client,since,now,receipt})
  return Object.freeze({
    ...receipt,failures:Object.freeze(receipt.failures),
    authority:'SHADOW_LEARNING_ONLY' as const,canExecute:false as const,canAuthorizeLive:false as const,
  })
}
