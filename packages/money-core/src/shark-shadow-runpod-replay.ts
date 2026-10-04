import {createHash} from 'node:crypto'
import {
  buildSharkShadowCounterfactual,
  buildSharkShadowMemoryCard,
  calibrateSharkShadowPerformance,
  observeSharkShadowOutcome,
  type SharkShadowCounterfactualLesson,
  type SharkShadowHorizon,
} from './shark-shadow-learning.js'
import {
  DexScreenerRunpodShadowProvider,
  runRunpodShadowLiveCycle,
  runpodShadowHorizonTarget,
  type RunpodShadowCandidate,
} from './shark-shadow-runpod-runtime.js'
import type {RunpodShadowStore} from './shark-shadow-runpod-store.js'

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=(xs:readonly string[])=>[...new Set(xs.filter(Boolean))]
const RANK:Record<SharkShadowHorizon,number>={'15M':1,'1H':2,'4H':3,'24H':4,'3D':5,'7D':6}
const HORIZONS:readonly SharkShadowHorizon[]=['15M','1H','4H','24H','3D','7D']

export type RunpodShadowReplayRecord=RunpodShadowCandidate

export type RunpodShadowReplayReceipt=Readonly<{
  replayId:string
  source:string
  from:string
  to:string
  inputRecords:number
  decisionsInserted:number
  observationsInserted:number
  lessonsInserted:number
  calibrationsInserted:number
  memoriesInserted:number
  unavailableHorizons:number
  authority:'RESEARCH_REPLAY_ONLY'
  canExecute:false
  canAuthorizeLive:false
}>

class ReplayDiscoveryProvider extends DexScreenerRunpodShadowProvider{
  constructor(private readonly batch:readonly RunpodShadowCandidate[]){super()}
  override async discover():Promise<Readonly<{candidates:readonly RunpodShadowCandidate[];failures:number}>>{
    return Object.freeze({candidates:this.batch,failures:0})
  }
}

function latestLessonPerDecision(xs:readonly SharkShadowCounterfactualLesson[]):readonly SharkShadowCounterfactualLesson[]{
  const best=new Map<string,SharkShadowCounterfactualLesson>()
  for(const x of xs){
    const prior=best.get(x.decisionId)
    if(!prior||RANK[x.horizon]>RANK[prior.horizon]||(RANK[x.horizon]===RANK[prior.horizon]&&x.evaluatedAt>prior.evaluatedAt))best.set(x.decisionId,x)
  }
  return Object.freeze([...best.values()])
}

export function parseRunpodShadowReplayRecord(raw:any):RunpodShadowReplayRecord{
  const required=['tokenAddress','pairAddress','dexId','observedAt']
  for(const key of required)if(typeof raw?.[key]!=='string'||!raw[key].trim())throw new Error('RUNPOD_SHADOW_REPLAY_FIELD_REQUIRED:'+key)
  const numeric=['priceUsd','liquidityUsd','volume24hUsd','buys24h','sells24h']
  for(const key of numeric)if(!Number.isFinite(Number(raw?.[key]))||Number(raw[key])<0)throw new Error('RUNPOD_SHADOW_REPLAY_FIELD_INVALID:'+key)
  if(Number(raw.priceUsd)<=0)throw new Error('RUNPOD_SHADOW_REPLAY_PRICE_INVALID')
  if(Number.isNaN(Date.parse(raw.observedAt)))throw new Error('RUNPOD_SHADOW_REPLAY_TIME_INVALID')
  return Object.freeze({
    chainId:'solana',
    tokenAddress:String(raw.tokenAddress),
    pairAddress:String(raw.pairAddress),
    dexId:String(raw.dexId),
    priceUsd:Number(raw.priceUsd),
    liquidityUsd:Number(raw.liquidityUsd),
    volume24hUsd:Number(raw.volume24hUsd),
    buys24h:Math.trunc(Number(raw.buys24h)),
    sells24h:Math.trunc(Number(raw.sells24h)),
    priceChange1hPct:Number.isFinite(Number(raw.priceChange1hPct))?Number(raw.priceChange1hPct):0,
    pairCreatedAt:typeof raw.pairCreatedAt==='string'&&raw.pairCreatedAt.trim()?raw.pairCreatedAt:undefined,
    discoveredAt:String(raw.observedAt),
    sourceUrl:typeof raw.sourceUrl==='string'?raw.sourceUrl:undefined,
    evidenceIds:Object.freeze(unique([
      ...(Array.isArray(raw.evidenceIds)?raw.evidenceIds.map(String):[]),
      'runpod-shadow-replay-import:v1',
      'replay-pair:'+String(raw.pairAddress),
    ])),
    raw:raw.raw??raw,
  })
}

export async function runRunpodShadowReplay(input:Readonly<{
  store:RunpodShadowStore
  records:readonly RunpodShadowReplayRecord[]
  source:string
}>):Promise<RunpodShadowReplayReceipt>{
  if(!input.source.trim())throw new Error('RUNPOD_SHADOW_REPLAY_SOURCE_REQUIRED')
  const records=[...input.records].sort((a,b)=>a.discoveredAt.localeCompare(b.discoveredAt)||a.tokenAddress.localeCompare(b.tokenAddress))
  if(!records.length)throw new Error('RUNPOD_SHADOW_REPLAY_RECORDS_REQUIRED')
  const from=records[0]!.discoveredAt
  const to=records[records.length-1]!.discoveredAt
  let decisionsInserted=0,observationsInserted=0,lessonsInserted=0,calibrationsInserted=0,memoriesInserted=0,unavailableHorizons=0

  const groups=new Map<string,RunpodShadowCandidate[]>()
  for(const record of records){
    const batch=groups.get(record.discoveredAt)??[]
    batch.push(record)
    groups.set(record.discoveredAt,batch)
  }
  for(const [observedAt,batch] of [...groups.entries()].sort(([a],[b])=>a.localeCompare(b))){
    const receipt=await runRunpodShadowLiveCycle({store:input.store,provider:new ReplayDiscoveryProvider(batch),now:observedAt})
    decisionsInserted+=receipt.decisionsInserted
  }

  const decisions=await input.store.listDecisions({since:from,through:to,limit:10000})
  const touched=new Map<string,{userId:string;strategyId:string}>()
  for(const stored of decisions){
    const d=stored.decision
    const execution=await input.store.loadExecution(d.decisionId)
    if(!execution||!stored.baselinePriceUsd||stored.baselinePriceUsd<=0)continue
    const done=await input.store.completedHorizons(d.decisionId)
    for(const horizon of HORIZONS){
      if(done.has(horizon))continue
      const target=runpodShadowHorizonTarget(d.decidedAt,horizon)
      const sample=await input.store.findMarketSampleAtOrAfter({
        chainId:d.chainId,tokenAddress:d.tokenAddress,from:target.dueAt,through:target.latestAt,
      })
      if(!sample||!sample.priceUsd||sample.priceUsd<=0){unavailableHorizons++;continue}
      const returnPct=(sample.priceUsd/stored.baselinePriceUsd-1)*100
      const observation=observeSharkShadowOutcome({
        decision:d,horizon,observedAt:sample.observedAt,
        baselineLaunchReturnPct:0,observedLaunchReturnPct:returnPct,
        baselineLiquidityUsd:d.market.liquidityUsd,observedLiquidityUsd:sample.liquidityUsd,
        launchOutcome:sample.liquidityUsd<=0?'FAILED':'UNKNOWN',
        liquidityRemoved:sample.liquidityUsd<=0,tradingHalted:false,
        evidenceIds:unique([...sample.evidenceIds,sample.sampleId,'runpod-shadow-replay-outcome:v1']),
      })
      if(await input.store.appendObservation({observation,targetSampleId:sample.sampleId})==='INSERTED')observationsInserted++
      const lesson=buildSharkShadowCounterfactual({decision:d,execution,observation})
      if(await input.store.appendLesson(lesson)==='INSERTED')lessonsInserted++
      touched.set(d.userId+'|'+d.strategyId,{userId:d.userId,strategyId:d.strategyId})
    }
  }

  for(const {userId,strategyId} of touched.values()){
    const lessons=latestLessonPerDecision(await input.store.listLessons({userId,strategyId,through:to,limit:10000}))
    if(!lessons.length)continue
    const calibration=calibrateSharkShadowPerformance({userId,strategyId,lessons,calibratedAt:to})
    if(await input.store.appendCalibration(calibration)==='INSERTED')calibrationsInserted++
    for(const marketRegime of unique(lessons.map(x=>x.marketRegime))){
      const memory=buildSharkShadowMemoryCard({userId,strategyId,marketRegime,lessons,calibration,createdAt:to})
      if(await input.store.appendMemory(memory)==='INSERTED')memoriesInserted++
    }
  }

  const replayId='runpod-shadow-replay:'+hash({source:input.source,from,to,inputRecords:records.length,records:records.map(x=>[x.tokenAddress,x.pairAddress,x.discoveredAt,x.priceUsd])})
  const receipt=Object.freeze({
    replayId,source:input.source,from,to,inputRecords:records.length,decisionsInserted,observationsInserted,lessonsInserted,
    calibrationsInserted,memoriesInserted,unavailableHorizons,authority:'RESEARCH_REPLAY_ONLY' as const,canExecute:false as const,canAuthorizeLive:false as const,
  })
  await input.store.appendReplayReceipt(replayId,receipt)
  return receipt
}
