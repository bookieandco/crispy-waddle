import { createHash } from 'node:crypto'
import { assertSportsMarketQuote, createSportsPaperWager, sportsImpliedProbability, sportsOddsToDecimal, type SportsMarketQuote, type SportsPaperWager } from './sports-paper-betting.js'
import { evaluateOpenPosition, type OpenPositionSnapshot, type PositionManagementDecision, type PositionManagementPolicy } from './position-management.js'
import type { AlphaEvidence } from './cross-domain-alpha-router.js'

export type SportsBetAlphaVenueKind='SPORTSBOOK'|'PREDICTION_MARKET'

export type SportsBetAlphaCandidate=Readonly<{
  alphaId:string
  eventId:string
  instrumentId:string
  marketId:string
  selectionId:string
  venueKind:SportsBetAlphaVenueKind
  provider:string
  fairProbability:number
  marketImpliedProbability:number
  grossEdgeBps:number
  estimatedCostsBps:number
  uncertaintyPenaltyBps:number
  netEdgeBps:number
  confidenceBps:number
  liquidityQualityBps:number
  quote?:SportsMarketQuote
  simulationId:string
  modelVersion:string
  informationCutoff:string
  expiresAt:string
  thesis:string
  evidenceIds:readonly string[]
  authority:'INTELLIGENCE_ONLY'
  bettingAuthority:'NONE'
  financialAuthority:'NONE'
  canExecute:false
}>

export type SportsBetAlphaRanking=Readonly<{
  rankingId:string
  candidates:readonly SportsBetAlphaCandidate[]
  rankedAlphaIds:readonly string[]
  rejectedAlphaIds:readonly string[]
  minimumNetEdgeBps:number
  minimumLiquidityBps:number
  authority:'INTELLIGENCE_ONLY'
  canExecute:false
}>

export type SportsPaperAutomationPolicy=Readonly<{
  strategyId:string
  currency:string
  stakeMinor:bigint
  minimumNetEdgeBps:number
  minimumConfidenceBps:number
  minimumLiquidityBps:number
  maxWagers:number
}>

export type SportsPaperAutomationResult=Readonly<{
  runId:string
  consideredAlphaIds:readonly string[]
  acceptedAlphaIds:readonly string[]
  rejectedAlphaIds:readonly string[]
  wagers:readonly SportsPaperWager[]
  authority:'PAPER_ONLY'
  bettingAuthority:'NONE'
  financialAuthority:'NONE'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))
const bps=(v:number,c:string)=>{if(!Number.isInteger(v)||v<0||v>10000)throw new Error(c)}
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function createSportsBetAlpha(input:{
  eventId:string
  instrumentId:string
  marketId:string
  selectionId:string
  venueKind:SportsBetAlphaVenueKind
  provider:string
  fairProbability:number
  marketImpliedProbability?:number
  quote?:SportsMarketQuote
  estimatedCostsBps:number
  uncertaintyPenaltyBps:number
  liquidityQualityBps:number
  simulationId:string
  modelVersion:string
  informationCutoff:string
  expiresAt:string
  thesis:string
  evidenceIds:readonly string[]
}):SportsBetAlphaCandidate{
  if(!input.eventId.trim()||!input.instrumentId.trim()||!input.marketId.trim()||!input.selectionId.trim()||!input.provider.trim()||!input.simulationId.trim()||!input.modelVersion.trim()||!input.thesis.trim())throw new Error('SPORT_SIM_ALPHA_IDENTITY_REQUIRED')
  if(!Number.isFinite(input.fairProbability)||input.fairProbability<=0||input.fairProbability>=1)throw new Error('SPORT_SIM_ALPHA_FAIR_PROBABILITY_INVALID')
  bps(input.estimatedCostsBps,'SPORT_SIM_ALPHA_COST_INVALID');bps(input.uncertaintyPenaltyBps,'SPORT_SIM_ALPHA_UNCERTAINTY_INVALID');bps(input.liquidityQualityBps,'SPORT_SIM_ALPHA_LIQUIDITY_INVALID')
  if(Number.isNaN(Date.parse(input.informationCutoff))||Number.isNaN(Date.parse(input.expiresAt))||input.expiresAt<=input.informationCutoff)throw new Error('SPORT_SIM_ALPHA_CLOCK_INVALID')
  if(!input.evidenceIds.length)throw new Error('SPORT_SIM_ALPHA_EVIDENCE_REQUIRED')
  let implied=input.marketImpliedProbability
  if(input.quote){
    assertSportsMarketQuote(input.quote)
    if(input.quote.eventId!==input.eventId||input.quote.marketId!==input.marketId||input.quote.selectionId!==input.selectionId)throw new Error('SPORT_SIM_ALPHA_QUOTE_MISMATCH')
    if(input.quote.availableAt>input.informationCutoff)throw new Error('SPORT_SIM_ALPHA_FUTURE_QUOTE')
    const qImplied=sportsImpliedProbability(sportsOddsToDecimal(input.quote.oddsFormat,input.quote.odds))
    if(implied!==undefined&&Math.abs(implied-qImplied)>1e-9)throw new Error('SPORT_SIM_ALPHA_IMPLIED_PRICE_MISMATCH')
    implied=qImplied
  }
  if(implied===undefined||!Number.isFinite(implied)||implied<=0||implied>=1)throw new Error('SPORT_SIM_ALPHA_MARKET_PROBABILITY_REQUIRED')
  const grossEdgeBps=Math.round((input.fairProbability-implied)*10000)
  const netEdgeBps=grossEdgeBps-input.estimatedCostsBps-input.uncertaintyPenaltyBps
  const confidenceBps=clamp(10000-input.uncertaintyPenaltyBps,0,10000)
  return Object.freeze({
    alphaId:'sport-bet-alpha:'+hash({eventId:input.eventId,instrumentId:input.instrumentId,marketId:input.marketId,selectionId:input.selectionId,simulationId:input.simulationId,modelVersion:input.modelVersion,cutoff:input.informationCutoff}),
    eventId:input.eventId,instrumentId:input.instrumentId,marketId:input.marketId,selectionId:input.selectionId,venueKind:input.venueKind,provider:input.provider,
    fairProbability:input.fairProbability,marketImpliedProbability:implied,grossEdgeBps,estimatedCostsBps:input.estimatedCostsBps,uncertaintyPenaltyBps:input.uncertaintyPenaltyBps,netEdgeBps,confidenceBps,
    liquidityQualityBps:input.liquidityQualityBps,quote:input.quote,simulationId:input.simulationId,modelVersion:input.modelVersion,
    informationCutoff:input.informationCutoff,expiresAt:input.expiresAt,thesis:input.thesis,evidenceIds:unique([...(input.quote?.evidenceIds??[]),...input.evidenceIds]),
    authority:'INTELLIGENCE_ONLY',bettingAuthority:'NONE',financialAuthority:'NONE',canExecute:false,
  })
}

export function rankSportsBetAlpha(input:{
  candidates:readonly SportsBetAlphaCandidate[]
  minimumNetEdgeBps:number
  minimumLiquidityBps:number
}):SportsBetAlphaRanking{
  if(!Number.isInteger(input.minimumNetEdgeBps))throw new Error('SPORT_SIM_ALPHA_RANK_EDGE_INVALID')
  bps(input.minimumLiquidityBps,'SPORT_SIM_ALPHA_RANK_LIQUIDITY_INVALID')
  const accepted=input.candidates.filter(c=>c.netEdgeBps>=input.minimumNetEdgeBps&&c.liquidityQualityBps>=input.minimumLiquidityBps)
    .sort((a,b)=>b.netEdgeBps-a.netEdgeBps||b.confidenceBps-a.confidenceBps||a.alphaId.localeCompare(b.alphaId))
  const rejected=input.candidates.filter(c=>!accepted.some(a=>a.alphaId===c.alphaId))
  return Object.freeze({
    rankingId:'sport-alpha-ranking:'+hash({ids:input.candidates.map(c=>c.alphaId).sort(),minimumNetEdgeBps:input.minimumNetEdgeBps,minimumLiquidityBps:input.minimumLiquidityBps}),
    candidates:Object.freeze([...input.candidates]),rankedAlphaIds:Object.freeze(accepted.map(c=>c.alphaId)),rejectedAlphaIds:Object.freeze(rejected.map(c=>c.alphaId)),
    minimumNetEdgeBps:input.minimumNetEdgeBps,minimumLiquidityBps:input.minimumLiquidityBps,authority:'INTELLIGENCE_ONLY',canExecute:false,
  })
}

export function automateSportsPaperCore(input:{
  candidates:readonly SportsBetAlphaCandidate[]
  policy:SportsPaperAutomationPolicy
  placedAt:string
}):SportsPaperAutomationResult{
  if(!input.policy.strategyId.trim()||!input.policy.currency.trim()||input.policy.stakeMinor<=0n||!Number.isInteger(input.policy.maxWagers)||input.policy.maxWagers<1)throw new Error('SPORT_SIM_PAPER_POLICY_INVALID')
  bps(input.policy.minimumConfidenceBps,'SPORT_SIM_PAPER_CONFIDENCE_INVALID');bps(input.policy.minimumLiquidityBps,'SPORT_SIM_PAPER_LIQUIDITY_INVALID')
  if(!Number.isInteger(input.policy.minimumNetEdgeBps)||Number.isNaN(Date.parse(input.placedAt)))throw new Error('SPORT_SIM_PAPER_POLICY_INVALID')
  const eligible=input.candidates.filter(c=>
    c.venueKind==='SPORTSBOOK'&&
    c.quote!==undefined&&
    c.netEdgeBps>=input.policy.minimumNetEdgeBps&&
    c.confidenceBps>=input.policy.minimumConfidenceBps&&
    c.liquidityQualityBps>=input.policy.minimumLiquidityBps&&
    c.expiresAt>input.placedAt
  ).sort((a,b)=>b.netEdgeBps-a.netEdgeBps||a.alphaId.localeCompare(b.alphaId)).slice(0,input.policy.maxWagers)
  const wagers=eligible.map(c=>createSportsPaperWager({
    strategyId:input.policy.strategyId,quote:c.quote!,fairProbability:c.fairProbability,stakeMinor:input.policy.stakeMinor,currency:input.policy.currency,
    placedAt:input.placedAt,informationCutoff:c.informationCutoff,evidenceIds:c.evidenceIds,
  }))
  const acceptedIds=new Set(eligible.map(c=>c.alphaId))
  return Object.freeze({
    runId:'sport-paper-auto:'+hash({alpha:input.candidates.map(c=>c.alphaId).sort(),policy:input.policy,placedAt:input.placedAt}),
    consideredAlphaIds:Object.freeze(input.candidates.map(c=>c.alphaId)),acceptedAlphaIds:Object.freeze(eligible.map(c=>c.alphaId)),
    rejectedAlphaIds:Object.freeze(input.candidates.filter(c=>!acceptedIds.has(c.alphaId)).map(c=>c.alphaId)),wagers:Object.freeze(wagers),
    authority:'PAPER_ONLY',bettingAuthority:'NONE',financialAuthority:'NONE',canExecute:false,
  })
}

export function sportsAlphaToCrossDomainEvidence(input:{
  alpha:SportsBetAlphaCandidate
  observedAt:string
}):AlphaEvidence{
  if(Number.isNaN(Date.parse(input.observedAt))||input.observedAt<input.alpha.informationCutoff)throw new Error('SPORT_SIM_ALPHA_ROUTE_TIME_INVALID')
  return Object.freeze({
    alphaId:input.alpha.alphaId,
    sourceDomain:input.alpha.venueKind==='PREDICTION_MARKET'?'PREDICTION_MARKET':'SPORTS_BETTING',
    sourceSubjectId:input.alpha.eventId,
    sourceInstrumentId:input.alpha.instrumentId,
    featureKind:'PRICE_MISPRICING',
    direction:input.alpha.netEdgeBps>0?'BULLISH':input.alpha.netEdgeBps<0?'BEARISH':'NEUTRAL',
    strengthBps:clamp(Math.abs(input.alpha.netEdgeBps)*5,0,10000),
    confidenceBps:input.alpha.confidenceBps,
    thesis:input.alpha.thesis,
    observedAt:input.observedAt,
    availableAt:input.observedAt,
    expiresAt:input.alpha.expiresAt,
    evidenceIds:input.alpha.evidenceIds,
    authority:'INTELLIGENCE_ONLY',
    canExecute:false,
  })
}

export function reunderwriteSportsPositionFromAlpha(input:{
  position:OpenPositionSnapshot
  alpha:SportsBetAlphaCandidate
  evaluatedAt:string
  policy?:PositionManagementPolicy
  thesisStrengthBps:number
  invalidationRiskBps:number
  momentumBps:number
}):PositionManagementDecision{
  if(input.position.domain!=='SPORTS_BETTING'&&input.position.domain!=='PREDICTION_MARKET')throw new Error('SPORT_SIM_POSITION_DOMAIN_INVALID')
  if(input.position.instrumentId!==input.alpha.instrumentId)throw new Error('SPORT_SIM_POSITION_INSTRUMENT_MISMATCH')
  return evaluateOpenPosition({
    position:input.position,
    assessment:Object.freeze({
      fairProbability:input.alpha.fairProbability,
      marketImpliedProbability:input.alpha.marketImpliedProbability,
      edgeAfterCostsBps:input.alpha.netEdgeBps,
      thesisStrengthBps:input.thesisStrengthBps,
      invalidationRiskBps:input.invalidationRiskBps,
      liquidityQualityBps:input.alpha.liquidityQualityBps,
      momentumBps:input.momentumBps,
      correlationRiskBps:0,
      alphaRoutes:Object.freeze([]),
      evidenceIds:input.alpha.evidenceIds,
      assessedAt:input.evaluatedAt,
      authority:'INTELLIGENCE_ONLY',
      canExecute:false,
    }),
    policy:input.policy,
    evaluatedAt:input.evaluatedAt,
  })
}
