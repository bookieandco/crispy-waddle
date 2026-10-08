import {createHash} from 'node:crypto'
import {
  buildSharkShadowCounterfactual,
  buildSharkShadowDecisionTwin,
  buildSharkShadowMemoryCard,
  calibrateSharkShadowPerformance,
  observeSharkShadowOutcome,
  retrieveSimilarSharkShadowMemory,
  sharkShadowMarketRegime,
  simulateSharkShadowExecution,
  type SharkShadowCounterfactualLesson,
  type SharkShadowMemoryCard,
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
  memoryApplied:number
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

export function runpodShadowSignalProvenance(candidate:RunpodShadowCandidate):Readonly<{
  verifiedSourceGroups:readonly string[]
  unverifiedSharkSignals:readonly string[]
  evidenceIds:readonly string[]
  sufficientForPaperResearch:boolean
  independentlyCorroborated:boolean
}>{
  // The current live adapter reads DexScreener pair API only. Pair age, pool
  // liquidity, and buy/sell flow are NOT evidence that any wallet-cluster,
  // Meteora, PumpSwap graduation or honeypot/rug detector has run.
  const dexPairProvenance=candidate.evidenceIds.includes('dexscreener:pair:'+candidate.pairAddress)
    && candidate.dexId.trim().length>0
    && candidate.pairAddress.trim().length>0
    && Number.isFinite(candidate.priceUsd)
    && candidate.priceUsd>0
  const groups=dexPairProvenance?['dexscreener']:[]
  const missing=['wallet-funding-cluster','meteora-adversarial-liquidity',
    'pumpfun-pumpswap-graduation','token-authority-and-honeypot']
  return Object.freeze({
    verifiedSourceGroups:Object.freeze(groups),
    unverifiedSharkSignals:Object.freeze(missing),
    evidenceIds:Object.freeze([
      ...(dexPairProvenance?['shark:provenance:dexscreener-pair-observed:v1']:[]),
      ...missing.map(x=>'shark:unverified:'+x),
    ]),
    sufficientForPaperResearch:dexPairProvenance,
    independentlyCorroborated:false,
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

export function applyRunpodShadowMemory(input:Readonly<{
  confidence:number
  disposition:'ALLOCATED'|'PURSE_REJECTED'
  reasonCodes:readonly string[]
  marketRegime:string
  cards:readonly SharkShadowMemoryCard[]
}>):Readonly<{
  confidence:number
  disposition:'ALLOCATED'|'PURSE_REJECTED'
  reasonCodes:readonly string[]
  memoryIds:readonly string[]
  adjustmentBps:number
}>{
  // Previous, unverified or tiny-cohort memory can no longer alter a fresh
  // paper decision. This is additional to SQL quarantine of legacy bad grades.
  const accepted=input.cards.filter(card=>
    card.sampleSize>=20
    && card.lessonIds.length>=20
    && card.evidenceIds.includes('runpod-shadow-pit-verified:v2')
    && !card.evidenceIds.includes('runpod-shadow-replay-outcome:v1')
    && card.sourceReliability.some(source=>
      source.sourceGroup==='dexscreener' && source.sampleSize>=20))
  const similar=retrieveSimilarSharkShadowMemory({strategyId:'SHARK_RUNTIME_NEW_PAIR',marketRegime:input.marketRegime,cards:accepted,limit:5})
  if(!similar.length)return Object.freeze({
    confidence:input.confidence,disposition:input.disposition,reasonCodes:input.reasonCodes,memoryIds:Object.freeze([]),adjustmentBps:0,
  })
  const totalWeight=similar.reduce((sum,card)=>sum+Math.max(1,card.sampleSize),0)
  const rawAdjustment=Math.round(similar.reduce((sum,card)=>sum+card.confidenceAdjustmentBps*Math.max(1,card.sampleSize),0)/Math.max(1,totalWeight))
  const cap=totalWeight>=20?500:300
  const adjustmentBps=clamp(rawAdjustment,-cap,cap)
  const confidence=clamp(input.confidence+adjustmentBps/10000,0,1)
  const reasons=[...input.reasonCodes,`SHADOW_MEMORY_APPLIED_${adjustmentBps>=0?'PLUS':'MINUS'}_${Math.abs(adjustmentBps)}BPS`,`SHADOW_MEMORY_SAMPLE_${totalWeight}`]
  let disposition=input.disposition
  const minConfidence=numEnv('SHARK_SHADOW_MIN_CONFIDENCE',0.55,0,1)
  if(disposition==='ALLOCATED'&&confidence<minConfidence){
    disposition='PURSE_REJECTED'
    reasons.push('SHADOW_MEMORY_DOWNGRADE')
  }
  return Object.freeze({
    confidence,disposition,reasonCodes:Object.freeze(unique(reasons)),memoryIds:Object.freeze(similar.map(x=>x.memoryId)),adjustmentBps,
  })
}

export function isRunpodShadowPointInTimeSample(input:Readonly<{
  decidedAt:string
  horizon:SharkShadowHorizon
  sample:RunpodShadowMarketSample
  chainId:string
  tokenAddress:string
  asOf:string
  expectedPairAddress?:string
}>):boolean{
  const target=runpodShadowHorizonTarget(input.decidedAt,input.horizon)
  const sampled=Date.parse(input.sample.observedAt)
  const asOf=Date.parse(input.asOf)
  return Number.isFinite(sampled)
    && Number.isFinite(asOf)
    && sampled>=Date.parse(target.dueAt)
    && sampled<=Date.parse(target.latestAt)
    && sampled<=asOf
    && input.sample.chainId===input.chainId
    && input.sample.tokenAddress===input.tokenAddress
    && (!input.expectedPairAddress||input.sample.pairAddress===input.expectedPairAddress)
    && typeof input.sample.priceUsd==='number'
    && Number.isFinite(input.sample.priceUsd)
    && input.sample.priceUsd>0
    && Array.isArray(input.sample.evidenceIds)
    && input.sample.evidenceIds.length>0
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
  ignoreCooldown?:boolean
  runtimeNamespace?:string
}>):Promise<RunpodShadowLiveReceipt>{
  const now=input.now??new Date().toISOString()
  // Quarantine legacy evidence before any existing memory is retrieved.
  await input.store.auditLegacyGrades()
  const provider=input.provider??new DexScreenerRunpodShadowProvider()
  const discovery=await provider.discover(now)
  let eligible=0,paperTrades=0,noTrades=0,cooldownSkipped=0,decisionsInserted=0,executionsInserted=0,memoryApplied=0
  const cooldownMs=intEnv('SHARK_SHADOW_TOKEN_COOLDOWN_MINUTES',60,1,10080)*60_000
  const userId=process.env.SHARK_SHADOW_USER_ID?.trim()||'runpod-shadow'
  const cofferId=process.env.SHARK_SHADOW_COFFER_ID?.trim()||'runpod-paper'
  const charterId=process.env.SHARK_SHADOW_CHARTER_ID?.trim()||'runpod-paper-charter'
  const notional=bigEnv('SHARK_SHADOW_DEFAULT_NOTIONAL_MINOR',1000n,1n,100_000_000n)

  for(const candidate of discovery.candidates){
    const since=new Date(Date.parse(now)-cooldownMs).toISOString()
    if(!input.ignoreCooldown&&await input.store.hasRecentDecision({chainId:candidate.chainId,tokenAddress:candidate.tokenAddress,since})){
      cooldownSkipped++
      continue
    }
    const baseScore=scoreRunpodShadowCandidate(candidate,now)
    const provenance=runpodShadowSignalProvenance(candidate)
    // Weak or malformed provenance remains a research-only NO_TRADE,
    // never a promoted wallet/on-chain confirmation.
    const researchScore=provenance.sufficientForPaperResearch?baseScore:{
      ...baseScore,disposition:'PURSE_REJECTED' as const,
      reasonCodes:Object.freeze([...baseScore.reasonCodes,'SHARK_SOURCE_PROVENANCE_UNVERIFIED']),
    }
    const marketRegime=sharkShadowMarketRegime({
      liquidityUsd:candidate.liquidityUsd,volume24hUsd:candidate.volume24hUsd,
      buys24h:candidate.buys24h,sells24h:candidate.sells24h,anomalyScore:baseScore.anomalyScore,
    })
    const cards=await input.store.listMemoryCards({userId,strategyId:'SHARK_RUNTIME_NEW_PAIR',through:now,limit:200})
    const scored=applyRunpodShadowMemory({
      confidence:researchScore.confidence,disposition:researchScore.disposition,reasonCodes:researchScore.reasonCodes,marketRegime,cards,
    })
    if(scored.memoryIds.length)memoryApplied++
    if(scored.disposition==='ALLOCATED')eligible++
    const sample=runpodShadowSample(candidate)
    await input.store.appendMarketSample(sample)
    const bucket=new Date(Math.floor(Date.parse(now)/60_000)*60_000).toISOString()
    const runtimeNamespace=input.runtimeNamespace?.trim()||'runpod-shadow-run'
    const runtimeRunId=runtimeNamespace+':'+hash({token:candidate.tokenAddress,pair:candidate.pairAddress,bucket})
    const evidenceIds=unique([...candidate.evidenceIds,...provenance.evidenceIds,
      'runpod-shadow-policy:v1',...scored.reasonCodes,...scored.memoryIds])
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
      sourceRisk:baseScore.sourceRisk,
      sourceGroups:provenance.verifiedSourceGroups,
      proposedNotionalMinor:notional,
      side:'BUY',
      informationCutoff:now,
      decidedAt:now,
      market:{
        chainId:candidate.chainId,tokenAddress:candidate.tokenAddress,liquidityUsd:candidate.liquidityUsd,
        volume24hUsd:candidate.volume24hUsd,buys24h:candidate.buys24h,sells24h:candidate.sells24h,
        anomalyScore:baseScore.anomalyScore,observedAt:now,availableAt:now,evidenceIds:candidate.evidenceIds,
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
    providerFailures:discovery.failures,decisionsInserted,executionsInserted,memoryApplied,
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
  // Review is append-only; previously produced grades and lessons are retained
  // as audit evidence, but quarantined from new calibration and decision memory.
  await input.store.auditLegacyGrades()
  const decisions=await input.store.listDecisions({since,through:now,limit:5000})
  let observationsInserted=0,lessonsInserted=0,calibrationsInserted=0,memoriesInserted=0,notDue=0,missingPrice=0,providerFailures=0
  const touched=new Map<string,SharkShadowDecisionTwin>()

  for(const stored of decisions){
    const d=stored.decision
    const execution=await input.store.loadExecution(d.decisionId)
    if(!execution)continue
    const completed=await input.store.completedHorizons(d.decisionId)
    const due=HORIZONS.filter(h=>!completed.has(h.name)&&runpodShadowHorizonTarget(d.decidedAt,h.name).dueAt<=now)
    notDue+=HORIZONS.filter(h=>!completed.has(h.name)&&runpodShadowHorizonTarget(d.decidedAt,h.name).dueAt>now).length
    if(!due.length)continue
    if(!stored.baselinePriceUsd||stored.baselinePriceUsd<=0){missingPrice+=due.length;continue}
    // Capture the current quote exactly once per decision, never relabel it
    // as a quote from a missed historical horizon.
    try{
      const fresh=await provider.marketForToken(d.tokenAddress,now)
      if(fresh&&Date.parse(fresh.discoveredAt)===Date.parse(now)){
        await input.store.appendMarketSample(runpodShadowSample(fresh))
      }
    }catch{providerFailures++}
    const baseline=await input.store.findMarketSampleById(stored.baselineSampleId)
    // Fail closed: absence of the original pair sample must not silently
    // broaden later grading to *any* pool for the same token.
    if(!baseline
      || baseline.chainId!==d.chainId
      || baseline.tokenAddress!==d.tokenAddress
      || !baseline.pairAddress?.trim()
      || !Number.isFinite(baseline.priceUsd)
      || baseline.priceUsd!==stored.baselinePriceUsd){
      missingPrice+=due.length
      continue
    }
    for(const h of due){
      const target=runpodShadowHorizonTarget(d.decidedAt,h.name)
      const through=target.latestAt<now?target.latestAt:now
      const sample=await input.store.findMarketSampleAtOrAfter({
        chainId:d.chainId,tokenAddress:d.tokenAddress,from:target.dueAt,through,
        pairAddress:baseline?.pairAddress,
      })
      if(!sample||!isRunpodShadowPointInTimeSample({
        decidedAt:d.decidedAt,horizon:h.name,sample,chainId:d.chainId,
        tokenAddress:d.tokenAddress,asOf:now,expectedPairAddress:baseline?.pairAddress,
      })){
        missingPrice++
        continue
      }
      const returnPct=(sample.priceUsd!/stored.baselinePriceUsd-1)*100
      const observation=observeSharkShadowOutcome({
        decision:d,horizon:h.name,observedAt:sample.observedAt,
        baselineLaunchReturnPct:0,observedLaunchReturnPct:returnPct,
        baselineLiquidityUsd:d.market.liquidityUsd,observedLiquidityUsd:sample.liquidityUsd,
        launchOutcome:sample.liquidityUsd<=0?'FAILED':'UNKNOWN',
        liquidityRemoved:sample.liquidityUsd<=0,tradingHalted:false,
        evidenceIds:unique([...sample.evidenceIds,sample.sampleId,'runpod-shadow-pit-verified:v2']),
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
