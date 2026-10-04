import {createHash} from 'node:crypto'
import {
  buildSharkShadowCounterfactual,
  buildSharkShadowDecisionTwin,
  buildSharkShadowMemoryCard,
  calibrateSharkShadowPerformance,
  observeSharkShadowOutcome,
  simulateSharkShadowExecution,
  type SharkShadowCounterfactualLesson,
  type SharkShadowDecisionTwin,
  type SharkShadowHorizon,
} from './shark-shadow-learning.js'
import {
  runpodMarketSampleId,
  type RunpodShadowMarketSample,
  type RunpodShadowStore,
} from './shark-shadow-runpod-store.js'

const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n))
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=(xs:readonly string[])=>[...new Set(xs.filter(Boolean))]

const HORIZONS:ReadonlyArray<Readonly<{name:SharkShadowHorizon;offsetMs:number;latestMs:number}>>=Object.freeze([
  {name:'15M',offsetMs:15*60_000,latestMs:60*60_000},
  {name:'1H',offsetMs:60*60_000,latestMs:4*60*60_000},
  {name:'4H',offsetMs:4*60*60_000,latestMs:24*60*60_000},
  {name:'24H',offsetMs:24*60*60_000,latestMs:3*24*60*60_000},
  {name:'3D',offsetMs:3*24*60*60_000,latestMs:7*24*60*60_000},
  {name:'7D',offsetMs:7*24*60*60_000,latestMs:14*24*60*60_000},
])

const numEnv=(name:string,fallback:number,min:number,max:number)=>{
  const raw=process.env[name]?.trim()
  if(!raw)return fallback
  const value=Number(raw)
  return Number.isFinite(value)&&value>=min&&value<=max?value:fallback
}
const intEnv=(name:string,fallback:number,min:number,max:number)=>Math.trunc(numEnv(name,fallback,min,max))
const bigEnv=(name:string,fallback:bigint,min:bigint,max:bigint)=>{
  const raw=process.env[name]?.trim()
  if(!raw)return fallback
  try{const value=BigInt(raw);return value>=min&&value<=max?value:fallback}catch{return fallback}
}

export type RunpodShadowCandidate=Readonly<{
  chainId:'solana'
  tokenAddress:string
  pairAddress:string
  dexId:string
  priceUsd:number
  liquidityUsd:number
  volume24hUsd:number
  buys24h:number
  sells24h:number
  priceChange1hPct:number
  pairCreatedAt?:string
  discoveredAt:string
  sourceUrl?:string
  evidenceIds:readonly string[]
  raw:unknown
}>

export type RunpodShadowLiveReceipt=Readonly<{
  observedAt:string
  discovered:number
  eligible:number
  paperTrades:number
  noTrades:number
  cooldownSkipped:number
  providerFailures:number
  decisionsInserted:number
  executionsInserted:number
  authority:'SHADOW_LEARNING_ONLY'
  canExecute:false
  canSign:false
  canBroadcast:false
}>

export type RunpodShadowOutcomeReceipt=Readonly<{
  observedAt:string
  decisionsScanned:number
  observationsInserted:number
  lessonsInserted:number
  calibrationsInserted:number
  memoriesInserted:number
  notDue:number
  missingPrice:number
  providerFailures:number
  authority:'SHADOW_LEARNING_ONLY'
  canExecute:false
  canAuthorizeLive:false
}>

type FetchLike=typeof fetch

export class DexScreenerRunpodShadowProvider{
  constructor(private readonly fetchImpl:FetchLike=fetch){}

  private async json(url:string):Promise<any>{
    const controller=new AbortController()
    const timeout=setTimeout(()=>controller.abort(),intEnv('SHARK_SHADOW_HTTP_TIMEOUT_MS',10000,1000,60000))
    try{
      const response=await this.fetchImpl(url,{headers:{accept:'application/json','user-agent':'jhadina-shark-shadow/1'},signal:controller.signal,cache:'no-store'})
      if(!response.ok)throw new Error('RUNPOD_SHADOW_PROVIDER_HTTP_'+response.status)
      return await response.json()
    }finally{clearTimeout(timeout)}
  }

  private normalizePair(tokenAddress:string,pair:any,observedAt:string):RunpodShadowCandidate|undefined{
    if(!pair||pair.chainId!=='solana'||typeof pair.pairAddress!=='string')return undefined
    const priceUsd=Number(pair.priceUsd)
    if(!Number.isFinite(priceUsd)||priceUsd<=0)return undefined
    const liquidityUsd=Number(pair.liquidity?.usd??0)
    const volume24hUsd=Number(pair.volume?.h24??0)
    const buys24h=Number(pair.txns?.h24?.buys??0)
    const sells24h=Number(pair.txns?.h24?.sells??0)
    const priceChange1hPct=Number(pair.priceChange?.h1??0)
    const pairCreatedRaw=Number(pair.pairCreatedAt)
    const pairCreatedAt=Number.isFinite(pairCreatedRaw)&&pairCreatedRaw>0?new Date(pairCreatedRaw).toISOString():undefined
    const evidenceIds=unique([
      'dexscreener:pair:'+pair.pairAddress,
      typeof pair.url==='string'?pair.url:'',
      typeof pair.dexId==='string'?'dex:'+pair.dexId:'',
    ])
    return Object.freeze({
      chainId:'solana',tokenAddress,pairAddress:String(pair.pairAddress),dexId:String(pair.dexId??'unknown'),
      priceUsd,liquidityUsd:Number.isFinite(liquidityUsd)?Math.max(0,liquidityUsd):0,
      volume24hUsd:Number.isFinite(volume24hUsd)?Math.max(0,volume24hUsd):0,
      buys24h:Number.isFinite(buys24h)?Math.max(0,Math.trunc(buys24h)):0,
      sells24h:Number.isFinite(sells24h)?Math.max(0,Math.trunc(sells24h)):0,
      priceChange1hPct:Number.isFinite(priceChange1hPct)?priceChange1hPct:0,
      pairCreatedAt,discoveredAt:observedAt,sourceUrl:typeof pair.url==='string'?pair.url:undefined,evidenceIds,raw:pair,
    })
  }

  async marketForToken(tokenAddress:string,observedAt:string):Promise<RunpodShadowCandidate|undefined>{
    const body=await this.json('https://api.dexscreener.com/token-pairs/v1/solana/'+encodeURIComponent(tokenAddress))
    if(!Array.isArray(body))return undefined
    const candidates=body.map(pair=>this.normalizePair(tokenAddress,pair,observedAt)).filter((x):x is RunpodShadowCandidate=>Boolean(x))
    candidates.sort((a,b)=>b.liquidityUsd-a.liquidityUsd||b.volume24hUsd-a.volume24hUsd)
    return candidates[0]
  }

  async discover(observedAt:string,limit?:number):Promise<Readonly<{candidates:readonly RunpodShadowCandidate[];failures:number}>>{
    const cap=Math.max(1,Math.min(30,Math.trunc(limit??intEnv('SHARK_SHADOW_DISCOVERY_LIMIT',12,1,30))))
    const profiles=await this.json('https://api.dexscreener.com/token-profiles/latest/v1')
    const tokens=unique((Array.isArray(profiles)?profiles:[])
      .filter((x:any)=>x?.chainId==='solana'&&typeof x?.tokenAddress==='string')
      .map((x:any)=>String(x.tokenAddress)))
      .slice(0,cap)
    const out:RunpodShadowCandidate[]=[]
    let failures=0
    for(const tokenAddress of tokens){
      try{
        const market=await this.marketForToken(tokenAddress,observedAt)
        if(market)out.push(market)
      }catch{failures++}
    }
    return Object.freeze({candidates:Object.freeze(out),failures})
  }
}

export function runpodShadowSample(candidate:RunpodShadowCandidate):RunpodShadowMarketSample{
  return Object.freeze({
    sampleId:runpodMarketSampleId({
      chainId:candidate.chainId,tokenAddress:candidate.tokenAddress,pairAddress:candidate.pairAddress,
      observedAt:candidate.discoveredAt,priceUsd:candidate.priceUsd,
    }),
    chainId:candidate.chainId,tokenAddress:candidate.tokenAddress,pairAddress:candidate.pairAddress,dexId:candidate.dexId,
    priceUsd:candidate.priceUsd,liquidityUsd:candidate.liquidityUsd,volume24hUsd:candidate.volume24hUsd,
    buys24h:candidate.buys24h,sells24h:candidate.sells24h,pairCreatedAt:candidate.pairCreatedAt,
    observedAt:candidate.discoveredAt,evidenceIds:candidate.evidenceIds,raw:candidate.raw,
  })
}

export function scoreRunpodShadowCandidate(candidate:RunpodShadowCandidate,now:string):Readonly<{
  confidence:number
  sourceRisk:number
  anomalyScore:number
  disposition:'ALLOCATED'|'PURSE_REJECTED'
  reasonCodes:readonly string[]
}>{
  const minLiquidity=numEnv('SHARK_SHADOW_MIN_LIQUIDITY_USD',25000,0,1_000_000_000)
  const minVolume=numEnv('SHARK_SHADOW_MIN_VOLUME_24H_USD',10000,0,10_000_000_000)
  const minTxns=intEnv('SHARK_SHADOW_MIN_TXNS_24H',20,0,10_000_000)
  const minConfidence=numEnv('SHARK_SHADOW_MIN_CONFIDENCE',0.55,0,1)
  const total=candidate.buys24h+candidate.sells24h
  const buyShare=total?candidate.buys24h/total:.5
  const turnover=candidate.liquidityUsd>0?candidate.volume24hUsd/candidate.liquidityUsd:0
  const liquidityScore=clamp(Math.log10(candidate.liquidityUsd+1)/6,0,1)
  const activityScore=clamp(turnover/2,0,1)
  const flowScore=clamp((buyShare-.35)/.4,0,1)
  const ageHours=candidate.pairCreatedAt?Math.max(0,(Date.parse(now)-Date.parse(candidate.pairCreatedAt))/3_600_000):24
  const ageScore=clamp(ageHours/6,0,1)
  const confidence=clamp(liquidityScore*.35+activityScore*.25+flowScore*.25+ageScore*.15,0,1)
  const lowLiquidityRisk=candidate.liquidityUsd<minLiquidity?clamp(1-candidate.liquidityUsd/Math.max(1,minLiquidity),0,1):0
  const sellRisk=clamp((.5-buyShare)*2,0,1)
  const volatilityRisk=clamp(Math.abs(candidate.priceChange1hPct)/100,0,1)
  const anomalyScore=clamp(lowLiquidityRisk*.5+sellRisk*.25+volatilityRisk*.25,0,1)
  const sourceRisk=clamp(anomalyScore*.75+(total<minTxns?.25:0),0,1)
  const reasons:string[]=[]
  if(candidate.liquidityUsd<minLiquidity)reasons.push('LIQUIDITY_BELOW_SHADOW_FLOOR')
  if(candidate.volume24hUsd<minVolume)reasons.push('VOLUME_BELOW_SHADOW_FLOOR')
  if(total<minTxns)reasons.push('ACTIVITY_BELOW_SHADOW_FLOOR')
  if(confidence<minConfidence)reasons.push('CONFIDENCE_BELOW_SHADOW_FLOOR')
  if(anomalyScore>=.75)reasons.push('ANOMALY_RISK_HIGH')
  const disposition=reasons.length?'PURSE_REJECTED':'ALLOCATED'
  if(!reasons.length)reasons.push('RUNPOD_SHADOW_POLICY_ADMITTED')
  return Object.freeze({confidence,sourceRisk,anomalyScore,disposition,reasonCodes:Object.freeze(reasons)})
}

export function runpodShadowHorizonTarget(decidedAt:string,horizon:SharkShadowHorizon):Readonly<{dueAt:string;latestAt:string}>{
  const h=HORIZONS.find(x=>x.name===horizon)
  if(!h)throw new Error('RUNPOD_SHADOW_HORIZON_INVALID')
  const start=Date.parse(decidedAt)
  if(Number.isNaN(start))throw new Error('RUNPOD_SHADOW_DECIDED_AT_INVALID')
  return Object.freeze({dueAt:new Date(start+h.offsetMs).toISOString(),latestAt:new Date(start+h.latestMs-1).toISOString()})
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

export async function runRunpodShadowLiveCycle(input:Readonly<{
  store:RunpodShadowStore
  provider?:DexScreenerRunpodShadowProvider
  now?:string
}>):Promise<RunpodShadowLiveReceipt>{
  const now=input.now??new Date().toISOString()
  const provider=input.provider??new DexScreenerRunpodShadowProvider()
  const discovery=await provider.discover(now)
  let eligible=0,paperTrades=0,noTrades=0,cooldownSkipped=0,decisionsInserted=0,executionsInserted=0
  const cooldownMs=intEnv('SHARK_SHADOW_TOKEN_COOLDOWN_MINUTES',60,1,10080)*60_000
  const userId=process.env.SHARK_SHADOW_USER_ID?.trim()||'runpod-shadow'
  const cofferId=process.env.SHARK_SHADOW_COFFER_ID?.trim()||'runpod-paper'
  const charterId=process.env.SHARK_SHADOW_CHARTER_ID?.trim()||'runpod-paper-charter'
  const notional=bigEnv('SHARK_SHADOW_DEFAULT_NOTIONAL_MINOR',1000n,1n,100_000_000n)

  for(const candidate of discovery.candidates){
    const since=new Date(Date.parse(now)-cooldownMs).toISOString()
    if(await input.store.hasRecentDecision({chainId:candidate.chainId,tokenAddress:candidate.tokenAddress,since})){
      cooldownSkipped++
      continue
    }
    const scored=scoreRunpodShadowCandidate(candidate,now)
    if(scored.disposition==='ALLOCATED')eligible++
    const sample=runpodShadowSample(candidate)
    await input.store.appendMarketSample(sample)
    const bucket=new Date(Math.floor(Date.parse(now)/60_000)*60_000).toISOString()
    const runtimeRunId='runpod-shadow-run:'+hash({token:candidate.tokenAddress,pair:candidate.pairAddress,bucket})
    const evidenceIds=unique([...candidate.evidenceIds,'runpod-shadow-policy:v1',...scored.reasonCodes])
    const decision=buildSharkShadowDecisionTwin({
      runtimeRunId,
      envelopeId:'runpod-shadow-envelope:'+hash({runtimeRunId,token:candidate.tokenAddress}),
      charterId,userId,cofferId,
      opportunityId:'runpod-shadow-opportunity:'+hash({token:candidate.tokenAddress,bucket}),
      disposition:scored.disposition,
      tradeType:'new-pair-speculation',
      chainId:candidate.chainId,
      tokenAddress:candidate.tokenAddress,
      instrumentId:'meme:solana:'+candidate.tokenAddress,
      sourceConfidence:scored.confidence,
      sourceRisk:scored.sourceRisk,
      sourceGroups:['dexscreener'],
      proposedNotionalMinor:notional,
      side:'BUY',
      informationCutoff:now,
      decidedAt:now,
      market:{
        chainId:candidate.chainId,tokenAddress:candidate.tokenAddress,liquidityUsd:candidate.liquidityUsd,
        volume24hUsd:candidate.volume24hUsd,buys24h:candidate.buys24h,sells24h:candidate.sells24h,
        anomalyScore:scored.anomalyScore,observedAt:now,availableAt:now,evidenceIds:candidate.evidenceIds,
      },
      evidenceIds,
    })
    const d=await input.store.appendDecision({decision,baselineSampleId:sample.sampleId,baselinePriceUsd:candidate.priceUsd})
    if(d==='INSERTED')decisionsInserted++
    if(decision.action==='PAPER_TRADE')paperTrades++;else noTrades++
    const execution=simulateSharkShadowExecution({
      decision,simulatedAt:now,requestedNotionalMinor:decision.action==='PAPER_TRADE'?notional:undefined,
      routeSource:'LIQUIDITY_MODEL',routeEvidenceIds:candidate.evidenceIds,
    })
    if(await input.store.appendExecution(execution)==='INSERTED')executionsInserted++
  }

  const receipt:Object & RunpodShadowLiveReceipt={
    observedAt:now,discovered:discovery.candidates.length,eligible,paperTrades,noTrades,cooldownSkipped,
    providerFailures:discovery.failures,decisionsInserted,executionsInserted,
    authority:'SHADOW_LEARNING_ONLY',canExecute:false,canSign:false,canBroadcast:false,
  }
  await input.store.putRuntimeState('last-live-cycle',receipt)
  return Object.freeze(receipt)
}

export async function runRunpodShadowOutcomeCycle(input:Readonly<{
  store:RunpodShadowStore
  provider?:DexScreenerRunpodShadowProvider
  now?:string
  lookbackDays?:number
}>):Promise<RunpodShadowOutcomeReceipt>{
  const now=input.now??new Date().toISOString()
  const provider=input.provider??new DexScreenerRunpodShadowProvider()
  const lookbackDays=Math.max(1,Math.min(30,Math.trunc(input.lookbackDays??14)))
  const since=new Date(Date.parse(now)-lookbackDays*86_400_000).toISOString()
  const decisions=await input.store.listDecisions({since,through:now,limit:5000})
  let observationsInserted=0,lessonsInserted=0,calibrationsInserted=0,memoriesInserted=0,notDue=0,missingPrice=0,providerFailures=0
  const touched=new Map<string,SharkShadowDecisionTwin>()

  for(const stored of decisions){
    const d=stored.decision
    const execution=await input.store.loadExecution(d.decisionId)
    if(!execution)continue
    const completed=await input.store.completedHorizons(d.decisionId)
    for(const h of HORIZONS){
      if(completed.has(h.name))continue
      const target=runpodShadowHorizonTarget(d.decidedAt,h.name)
      if(target.dueAt>now){notDue++;continue}
      if(!stored.baselinePriceUsd||stored.baselinePriceUsd<=0){missingPrice++;break}
      let candidate:RunpodShadowCandidate|undefined
      try{candidate=await provider.marketForToken(d.tokenAddress,now)}catch{providerFailures++;break}
      if(!candidate){missingPrice++;break}
      const sample=runpodShadowSample(candidate)
      await input.store.appendMarketSample(sample)
      const returnPct=(candidate.priceUsd/stored.baselinePriceUsd-1)*100
      const observation=observeSharkShadowOutcome({
        decision:d,horizon:h.name,observedAt:now,
        baselineLaunchReturnPct:0,observedLaunchReturnPct:returnPct,
        baselineLiquidityUsd:d.market.liquidityUsd,observedLiquidityUsd:candidate.liquidityUsd,
        launchOutcome:candidate.liquidityUsd<=0?'FAILED':'UNKNOWN',
        liquidityRemoved:candidate.liquidityUsd<=0,tradingHalted:false,
        evidenceIds:unique([...candidate.evidenceIds,sample.sampleId,'runpod-shadow-reprice:v1']),
      })
      if(await input.store.appendObservation({observation,targetSampleId:sample.sampleId})==='INSERTED')observationsInserted++
      const lesson=buildSharkShadowCounterfactual({decision:d,execution,observation})
      if(await input.store.appendLesson(lesson)==='INSERTED')lessonsInserted++
      touched.set(d.userId+'|'+d.strategyId,d)
    }
  }

  for(const key of touched.keys()){
    const [userId,strategyId]=key.split('|')
    if(!userId||!strategyId)continue
    const lessons=latestLessonPerDecision(await input.store.listLessons({userId,strategyId,through:now,limit:10000}))
    if(!lessons.length)continue
    const calibration=calibrateSharkShadowPerformance({userId,strategyId,lessons,calibratedAt:now})
    if(await input.store.appendCalibration(calibration)==='INSERTED')calibrationsInserted++
    for(const marketRegime of unique(lessons.map(x=>x.marketRegime))){
      const memory=buildSharkShadowMemoryCard({userId,strategyId,marketRegime,lessons,calibration,createdAt:now})
      if(await input.store.appendMemory(memory)==='INSERTED')memoriesInserted++
    }
  }

  const receipt:Object & RunpodShadowOutcomeReceipt={
    observedAt:now,decisionsScanned:decisions.length,observationsInserted,lessonsInserted,calibrationsInserted,memoriesInserted,
    notDue,missingPrice,providerFailures,authority:'SHADOW_LEARNING_ONLY',canExecute:false,canAuthorizeLive:false,
  }
  await input.store.putRuntimeState('last-outcome-cycle',receipt)
  return Object.freeze(receipt)
}

export async function runRunpodShadowCycle(input:Readonly<{
  store:RunpodShadowStore
  provider?:DexScreenerRunpodShadowProvider
  now?:string
}>):Promise<Readonly<{live:RunpodShadowLiveReceipt;outcomes:RunpodShadowOutcomeReceipt}>>{
  const now=input.now??new Date().toISOString()
  const provider=input.provider??new DexScreenerRunpodShadowProvider()
  const live=await runRunpodShadowLiveCycle({store:input.store,provider,now})
  const outcomes=await runRunpodShadowOutcomeCycle({store:input.store,provider,now})
  return Object.freeze({live,outcomes})
}
