import { createHash } from 'node:crypto'
import { assertSportsMarketQuote, sportsOddsToDecimal, sportsImpliedProbability, type SportsMarketQuote } from './sports-paper-betting.js'

export type SportsThresholdSide='OVER'|'UNDER'
export type SportsMarketSettlementKind=
  |'COUNT_THRESHOLD'
  |'YARDAGE_THRESHOLD'
  |'LONGEST_EVENT_THRESHOLD'
  |'COMPOSITE_SCORE_THRESHOLD'
  |'BINARY_EVENT'

export type SportsCompositeScoringRule=Readonly<{
  statId:string
  pointsPerUnit:number
  bonusThreshold?:number
  bonusPoints?:number
  evidenceIds:readonly string[]
}>

export type SportsMarketDefinition=Readonly<{
  marketDefinitionId:string
  eventId:string
  marketId:string
  selectionId:string
  provider:string
  settlementKind:SportsMarketSettlementKind
  threshold?:number
  side?:SportsThresholdSide
  scoringRuleVersion?:string
  compositeRules?:readonly SportsCompositeScoringRule[]
  requiresTailDistribution:boolean
  observedAt:string
  evidenceIds:readonly string[]
  authority:'MARKET_SEMANTICS_ONLY'
  canExecute:false
}>

export type SportsCompositeScore=Readonly<{
  scoreId:string
  marketDefinitionId:string
  totalScore:number
  componentScores:Readonly<Record<string,number>>
  hit:boolean|null
  evidenceIds:readonly string[]
  authority:'ANALYSIS_ONLY'
  canExecute:false
}>

export type SportsMarketLineMove=Readonly<{
  lineMoveId:string
  marketId:string
  fromQuoteId:string
  toQuoteId:string
  fromLine:number|null
  toLine:number|null
  lineDelta:number|null
  fromImpliedProbability:number
  toImpliedProbability:number
  impliedProbabilityDeltaBps:number
  direction:'MORE_EXPENSIVE'|'CHEAPER'|'UNCHANGED'
  interpretation:'MARKET_OBSERVATION_ONLY'
  authority:'ANALYSIS_ONLY'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())
const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}

export function assertSportsMarketDefinition(d:SportsMarketDefinition):void{
  nonEmpty(d.marketDefinitionId,'SPORT_PRED_MARKET_DEFINITION_ID_REQUIRED')
  nonEmpty(d.eventId,'SPORT_PRED_MARKET_EVENT_REQUIRED')
  nonEmpty(d.marketId,'SPORT_PRED_MARKET_ID_REQUIRED')
  nonEmpty(d.selectionId,'SPORT_PRED_MARKET_SELECTION_REQUIRED')
  nonEmpty(d.provider,'SPORT_PRED_MARKET_PROVIDER_REQUIRED')
  if(Number.isNaN(Date.parse(d.observedAt)))throw new Error('SPORT_PRED_MARKET_OBSERVED_AT_INVALID')
  if(!d.evidenceIds.length)throw new Error('SPORT_PRED_MARKET_EVIDENCE_REQUIRED')
  if(d.authority!=='MARKET_SEMANTICS_ONLY'||d.canExecute!==false)throw new Error('SPORT_PRED_MARKET_AUTHORITY_INVALID')

  const thresholdKind=d.settlementKind!=='BINARY_EVENT'
  if(thresholdKind){
    if(d.threshold===undefined||!Number.isFinite(d.threshold))throw new Error('SPORT_PRED_MARKET_THRESHOLD_REQUIRED')
    if(!d.side)throw new Error('SPORT_PRED_MARKET_SIDE_REQUIRED')
  }
  if(d.settlementKind==='COMPOSITE_SCORE_THRESHOLD'){
    nonEmpty(d.scoringRuleVersion??'','SPORT_PRED_MARKET_SCORING_RULE_VERSION_REQUIRED')
    if(!d.compositeRules?.length)throw new Error('SPORT_PRED_MARKET_COMPOSITE_RULES_REQUIRED')
    const statIds=new Set<string>()
    for(const r of d.compositeRules){
      nonEmpty(r.statId,'SPORT_PRED_MARKET_STAT_ID_REQUIRED')
      if(statIds.has(r.statId))throw new Error('SPORT_PRED_MARKET_DUPLICATE_STAT_RULE')
      statIds.add(r.statId)
      if(!Number.isFinite(r.pointsPerUnit))throw new Error('SPORT_PRED_MARKET_POINTS_PER_UNIT_INVALID')
      if(r.bonusThreshold!==undefined&&!Number.isFinite(r.bonusThreshold))throw new Error('SPORT_PRED_MARKET_BONUS_THRESHOLD_INVALID')
      if(r.bonusPoints!==undefined&&!Number.isFinite(r.bonusPoints))throw new Error('SPORT_PRED_MARKET_BONUS_POINTS_INVALID')
      if(!r.evidenceIds.length)throw new Error('SPORT_PRED_MARKET_RULE_EVIDENCE_REQUIRED')
    }
  }
  if(d.settlementKind==='LONGEST_EVENT_THRESHOLD'&&!d.requiresTailDistribution)throw new Error('SPORT_PRED_TAIL_MARKET_REQUIRES_TAIL_DISTRIBUTION')
}

export function scoreSportsCompositeMarket(input:{
  definition:SportsMarketDefinition
  stats:Readonly<Record<string,number>>
  evidenceIds:readonly string[]
}):SportsCompositeScore{
  assertSportsMarketDefinition(input.definition)
  if(input.definition.settlementKind!=='COMPOSITE_SCORE_THRESHOLD')throw new Error('SPORT_PRED_MARKET_NOT_COMPOSITE')
  if(!input.evidenceIds.length)throw new Error('SPORT_PRED_MARKET_SCORE_EVIDENCE_REQUIRED')
  const componentScores:Record<string,number>={}
  let total=0
  for(const r of input.definition.compositeRules??[]){
    const value=input.stats[r.statId]
    if(value===undefined||!Number.isFinite(value))throw new Error('SPORT_PRED_MARKET_COMPOSITE_STAT_MISSING:'+r.statId)
    let score=value*r.pointsPerUnit
    if(r.bonusThreshold!==undefined&&r.bonusPoints!==undefined&&value>=r.bonusThreshold)score+=r.bonusPoints
    componentScores[r.statId]=score
    total+=score
  }
  const threshold=input.definition.threshold!
  const side=input.definition.side!
  const hit=side==='OVER'?total>threshold:total<threshold
  return Object.freeze({
    scoreId:'sports-composite:'+hash({marketDefinitionId:input.definition.marketDefinitionId,stats:input.stats}),
    marketDefinitionId:input.definition.marketDefinitionId,
    totalScore:total,
    componentScores:Object.freeze(componentScores),
    hit,
    evidenceIds:unique([...input.definition.evidenceIds,...input.evidenceIds,...(input.definition.compositeRules??[]).flatMap(r=>r.evidenceIds)]),
    authority:'ANALYSIS_ONLY',
    canExecute:false,
  })
}

export function assertProjectionMethodForSportsMarket(input:{
  definition:SportsMarketDefinition
  projectionMethod:'MEAN_ONLY'|'DISTRIBUTION'
}):void{
  assertSportsMarketDefinition(input.definition)
  if(input.definition.requiresTailDistribution&&input.projectionMethod!=='DISTRIBUTION')throw new Error('SPORT_PRED_TAIL_MARKET_MEAN_ONLY_FORBIDDEN')
  if(input.definition.settlementKind==='COMPOSITE_SCORE_THRESHOLD'&&input.projectionMethod==='MEAN_ONLY')throw new Error('SPORT_PRED_COMPOSITE_MARKET_MEAN_ONLY_INSUFFICIENT')
}

export function compareSportsMarketLine(input:{
  fromQuote:SportsMarketQuote
  toQuote:SportsMarketQuote
  fromLine?:number
  toLine?:number
}):SportsMarketLineMove{
  assertSportsMarketQuote(input.fromQuote)
  assertSportsMarketQuote(input.toQuote)
  if(
    input.fromQuote.eventId!==input.toQuote.eventId||
    input.fromQuote.marketId!==input.toQuote.marketId||
    input.fromQuote.selectionId!==input.toQuote.selectionId
  )throw new Error('SPORT_PRED_LINE_MOVE_MARKET_MISMATCH')
  if(input.toQuote.availableAt<input.fromQuote.availableAt)throw new Error('SPORT_PRED_LINE_MOVE_CLOCK_REVERSED')
  if((input.fromLine===undefined)!==(input.toLine===undefined))throw new Error('SPORT_PRED_LINE_MOVE_LINE_PAIR_REQUIRED')
  if(input.fromLine!==undefined&&(!Number.isFinite(input.fromLine)||!Number.isFinite(input.toLine!)))throw new Error('SPORT_PRED_LINE_MOVE_LINE_INVALID')
  const fromImplied=sportsImpliedProbability(sportsOddsToDecimal(input.fromQuote.oddsFormat,input.fromQuote.odds))
  const toImplied=sportsImpliedProbability(sportsOddsToDecimal(input.toQuote.oddsFormat,input.toQuote.odds))
  const deltaBps=Math.round((toImplied-fromImplied)*10000)
  return Object.freeze({
    lineMoveId:'sports-line-move:'+hash({from:input.fromQuote.quoteId,to:input.toQuote.quoteId,fromLine:input.fromLine??null,toLine:input.toLine??null}),
    marketId:input.fromQuote.marketId,
    fromQuoteId:input.fromQuote.quoteId,
    toQuoteId:input.toQuote.quoteId,
    fromLine:input.fromLine??null,
    toLine:input.toLine??null,
    lineDelta:input.fromLine===undefined?null:input.toLine!-input.fromLine,
    fromImpliedProbability:fromImplied,
    toImpliedProbability:toImplied,
    impliedProbabilityDeltaBps:deltaBps,
    direction:deltaBps>0?'MORE_EXPENSIVE':deltaBps<0?'CHEAPER':'UNCHANGED',
    interpretation:'MARKET_OBSERVATION_ONLY',
    authority:'ANALYSIS_ONLY',
    canExecute:false,
  })
}
