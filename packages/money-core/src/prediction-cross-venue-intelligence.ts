import { createHash } from 'node:crypto'
import type { PredictionMarketSnapshot } from './prediction-market-reality.js'

export type PredictionVenueMarketType='REAL_MONEY'|'SENTIMENT'
export type PredictionVenueMatchConfidence='HIGH'|'MEDIUM'|'LOW'|'NOT_APPLICABLE'
export type PredictionVenueLiquidityStatus='HEALTHY'|'THIN'|'MISSING'|'UNKNOWN'
export type PredictionVenueRiskFlag=
  |'STALE_DATA'
  |'LOW_MATCH_CONFIDENCE'
  |'SETTLEMENT_RULE_MISMATCH'
  |'RESOLUTION_AUTHORITY_MISMATCH'
  |'THIN_LIQUIDITY'
  |'MISSING_LIQUIDITY'
  |'SENTIMENT_ONLY'
  |'OUTCOME_SCHEMA_MISMATCH'
  |'VENUE_DATA_FAILURE'

export type PredictionVenueObservation=Readonly<{
  observationId:string
  canonicalEventId:string
  venue:string
  marketId:string
  outcomeId:string
  marketType:PredictionVenueMarketType
  matchConfidence:PredictionVenueMatchConfidence
  midpointProbability:number
  executableBuyProbability:number|null
  executableSellProbability:number|null
  availableLiquidity:number|null
  liquidityStatus:PredictionVenueLiquidityStatus
  observedAt:string
  availableAt:string
  informationCutoff:string
  resolutionAuthorityId:string
  resolutionRuleVersion:string
  resolutionRuleFingerprint:string
  evidenceRefs:readonly string[]
  riskFlags:readonly PredictionVenueRiskFlag[]
  authority:'INTELLIGENCE_ONLY'
  financialAuthority:'NONE'
  canExecute:false
}>

export type PredictionCrossVenueComparison=Readonly<{
  comparisonId:string
  canonicalEventId:string
  outcomeId:string
  observations:readonly PredictionVenueObservation[]
  realMoneyVenueCount:number
  sentimentVenueCount:number
  bestExecutableBuyVenue:string|null
  bestExecutableBuyProbability:number|null
  bestExecutableSellVenue:string|null
  bestExecutableSellProbability:number|null
  maxMidpointDiscrepancyBps:number|null
  comparableSettlementRules:boolean
  riskFlags:readonly PredictionVenueRiskFlag[]
  informationCutoff:string
  evidenceRefs:readonly string[]
  authority:'INTELLIGENCE_ONLY'
  financialAuthority:'NONE'
  canAuthorizeLive:false
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}
const ts=(v:string,c:string)=>{nonEmpty(v,c);const n=Date.parse(v);if(Number.isNaN(n))throw new Error(c);return n}
const unique=<T extends string>(xs:readonly T[])=>Object.freeze([...new Set(xs)].sort()) as readonly T[]

function stateFor(snapshot:PredictionMarketSnapshot,outcomeId:string){
  const state=snapshot.outcomes.find(x=>x.outcomeId===outcomeId)
  if(!state)throw new Error('MONEY_PREDICTION_VENUE_OUTCOME_UNKNOWN')
  return state
}

export function buildPredictionVenueObservation(input:{
  canonicalEventId:string
  snapshot:PredictionMarketSnapshot
  outcomeId:string
  marketType:PredictionVenueMarketType
  matchConfidence:PredictionVenueMatchConfidence
  resolutionRuleFingerprint:string
  now:string
  staleAfterMs:number
  minimumHealthyLiquidity:number
  extraRiskFlags?:readonly PredictionVenueRiskFlag[]
}):PredictionVenueObservation{
  const s=input.snapshot
  if(s.researchAuthority!=='INTELLIGENCE_ONLY'||s.executionAuthority!=='NONE'||s.financialAuthority!=='NONE')throw new Error('MONEY_PREDICTION_VENUE_SNAPSHOT_AUTHORITY_INVALID')
  nonEmpty(input.canonicalEventId,'MONEY_PREDICTION_VENUE_EVENT_REQUIRED')
  nonEmpty(input.resolutionRuleFingerprint,'MONEY_PREDICTION_VENUE_RULE_FINGERPRINT_REQUIRED')
  if(!Number.isFinite(input.staleAfterMs)||input.staleAfterMs<0)throw new Error('MONEY_PREDICTION_VENUE_STALE_WINDOW_INVALID')
  if(!Number.isFinite(input.minimumHealthyLiquidity)||input.minimumHealthyLiquidity<0)throw new Error('MONEY_PREDICTION_VENUE_LIQUIDITY_FLOOR_INVALID')
  const now=ts(input.now,'MONEY_PREDICTION_VENUE_NOW_INVALID')
  const cutoff=ts(s.informationCutoff,'MONEY_PREDICTION_VENUE_CUTOFF_INVALID')
  if(cutoff>now)throw new Error('MONEY_PREDICTION_VENUE_FUTURE_INFORMATION')
  const state=stateFor(s,input.outcomeId)
  const liquidity=(state.bidSize===undefined&&state.askSize===undefined)?null:(state.bidSize??0)+(state.askSize??0)
  let liquidityStatus:PredictionVenueLiquidityStatus='UNKNOWN'
  const flags:PredictionVenueRiskFlag[]=[...(input.extraRiskFlags??[])]
  if(liquidity===null){liquidityStatus='MISSING';flags.push('MISSING_LIQUIDITY')}
  else if(liquidity<input.minimumHealthyLiquidity){liquidityStatus='THIN';flags.push('THIN_LIQUIDITY')}
  else liquidityStatus='HEALTHY'
  if(now-cutoff>input.staleAfterMs)flags.push('STALE_DATA')
  if(input.matchConfidence==='LOW')flags.push('LOW_MATCH_CONFIDENCE')
  if(input.marketType==='SENTIMENT')flags.push('SENTIMENT_ONLY')

  const executableBuyProbability=input.marketType==='REAL_MONEY'?state.askProbability:null
  const executableSellProbability=input.marketType==='REAL_MONEY'?state.bidProbability:null

  return Object.freeze({
    observationId:'prediction-venue:'+hash({canonicalEventId:input.canonicalEventId,snapshotId:s.snapshotId,outcomeId:input.outcomeId,marketType:input.marketType}),
    canonicalEventId:input.canonicalEventId,
    venue:s.venue,
    marketId:s.marketId,
    outcomeId:input.outcomeId,
    marketType:input.marketType,
    matchConfidence:input.matchConfidence,
    midpointProbability:state.midpointProbability,
    executableBuyProbability,
    executableSellProbability,
    availableLiquidity:liquidity,
    liquidityStatus,
    observedAt:s.derivedAt,
    availableAt:s.derivedAt,
    informationCutoff:s.informationCutoff,
    resolutionAuthorityId:s.resolution.authorityId,
    resolutionRuleVersion:s.resolution.ruleVersion,
    resolutionRuleFingerprint:input.resolutionRuleFingerprint,
    evidenceRefs:unique([...s.evidenceRefs,...state.evidenceRefs]),
    riskFlags:unique(flags),
    authority:'INTELLIGENCE_ONLY',
    financialAuthority:'NONE',
    canExecute:false,
  })
}

export function comparePredictionVenues(input:{
  canonicalEventId:string
  outcomeId:string
  observations:readonly PredictionVenueObservation[]
  comparedAt:string
}):PredictionCrossVenueComparison{
  nonEmpty(input.canonicalEventId,'MONEY_PREDICTION_COMPARISON_EVENT_REQUIRED')
  nonEmpty(input.outcomeId,'MONEY_PREDICTION_COMPARISON_OUTCOME_REQUIRED')
  const comparedAt=ts(input.comparedAt,'MONEY_PREDICTION_COMPARISON_TIME_INVALID')
  if(input.observations.length<2)throw new Error('MONEY_PREDICTION_COMPARISON_MIN_TWO_VENUES')
  const ids=new Set<string>()
  for(const o of input.observations){
    if(ids.has(o.observationId))throw new Error('MONEY_PREDICTION_COMPARISON_DUPLICATE_OBSERVATION')
    ids.add(o.observationId)
    if(o.canonicalEventId!==input.canonicalEventId||o.outcomeId!==input.outcomeId)throw new Error('MONEY_PREDICTION_COMPARISON_LINEAGE_MISMATCH')
    if(o.authority!=='INTELLIGENCE_ONLY'||o.financialAuthority!=='NONE'||o.canExecute!==false)throw new Error('MONEY_PREDICTION_COMPARISON_AUTHORITY_INVALID')
    if(ts(o.informationCutoff,'MONEY_PREDICTION_COMPARISON_CUTOFF_INVALID')>comparedAt)throw new Error('MONEY_PREDICTION_COMPARISON_FUTURE_INFORMATION')
  }

  const real=input.observations.filter(o=>o.marketType==='REAL_MONEY')
  const sentiment=input.observations.filter(o=>o.marketType==='SENTIMENT')
  const flags:PredictionVenueRiskFlag[]=[...input.observations.flatMap(o=>o.riskFlags)]
  const fingerprints=unique(real.map(o=>o.resolutionRuleFingerprint))
  const authorities=unique(real.map(o=>o.resolutionAuthorityId))
  const comparableSettlementRules=real.length>=2&&fingerprints.length===1&&authorities.length===1
  if(real.length>=2&&!comparableSettlementRules){
    if(fingerprints.length>1)flags.push('SETTLEMENT_RULE_MISMATCH')
    if(authorities.length>1)flags.push('RESOLUTION_AUTHORITY_MISMATCH')
  }

  const goodReal=real.filter(o=>o.matchConfidence!=='LOW'&&!o.riskFlags.includes('STALE_DATA'))
  const buys=goodReal.filter(o=>o.executableBuyProbability!==null)
  const sells=goodReal.filter(o=>o.executableSellProbability!==null)
  const bestBuy=[...buys].sort((a,b)=>(a.executableBuyProbability??Infinity)-(b.executableBuyProbability??Infinity))[0]
  const bestSell=[...sells].sort((a,b)=>(b.executableSellProbability??-Infinity)-(a.executableSellProbability??-Infinity))[0]
  let maxMidpointDiscrepancyBps:number|null=null
  if(goodReal.length>=2){
    const ps=goodReal.map(o=>o.midpointProbability)
    maxMidpointDiscrepancyBps=Math.round((Math.max(...ps)-Math.min(...ps))*10000)
  }

  const cutoff=new Date(Math.min(...input.observations.map(o=>Date.parse(o.informationCutoff)))).toISOString()
  const evidenceRefs=unique(input.observations.flatMap(o=>o.evidenceRefs))
  return Object.freeze({
    comparisonId:'prediction-cross-venue:'+hash({canonicalEventId:input.canonicalEventId,outcomeId:input.outcomeId,observations:input.observations.map(o=>o.observationId).sort(),comparedAt:input.comparedAt}),
    canonicalEventId:input.canonicalEventId,
    outcomeId:input.outcomeId,
    observations:Object.freeze([...input.observations]),
    realMoneyVenueCount:real.length,
    sentimentVenueCount:sentiment.length,
    bestExecutableBuyVenue:bestBuy?.venue??null,
    bestExecutableBuyProbability:bestBuy?.executableBuyProbability??null,
    bestExecutableSellVenue:bestSell?.venue??null,
    bestExecutableSellProbability:bestSell?.executableSellProbability??null,
    maxMidpointDiscrepancyBps,
    comparableSettlementRules,
    riskFlags:unique(flags),
    informationCutoff:cutoff,
    evidenceRefs,
    authority:'INTELLIGENCE_ONLY',
    financialAuthority:'NONE',
    canAuthorizeLive:false,
    canExecute:false,
  })
}
