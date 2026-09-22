import { createHash } from 'node:crypto'

export type SportsOddsFormat='DECIMAL'|'AMERICAN'
export type SportsPaperWagerStatus='OPEN'|'WON'|'LOST'|'PUSH'|'VOID'

export type SportsMarketQuote=Readonly<{
  quoteId:string
  provider:string
  eventId:string
  marketId:string
  selectionId:string
  oddsFormat:SportsOddsFormat
  odds:string
  observedAt:string
  availableAt:string
  evidenceIds:readonly string[]
  authority:'EVIDENCE_ONLY'
  canExecute:false
}>

export type SportsPaperWager=Readonly<{
  wagerId:string
  strategyId:string
  eventId:string
  marketId:string
  selectionId:string
  quoteId:string
  decimalOdds:number
  impliedProbability:number
  fairProbability:number
  estimatedEdge:number
  stakeMinor:bigint
  currency:string
  placedAt:string
  informationCutoff:string
  evidenceIds:readonly string[]
  status:'OPEN'
  simulationAuthority:'PAPER_ONLY'
  bettingAuthority:'NONE'
  financialAuthority:'NONE'
  canExecute:false
}>

export type SportsPaperSettlement=Readonly<{
  settlementId:string
  wagerId:string
  status:Exclude<SportsPaperWagerStatus,'OPEN'>
  payoutMinor:bigint
  profitLossMinor:bigint
  closingDecimalOdds?:number
  closingImpliedProbability?:number
  closingLineValue?:number
  resolvedAt:string
  evidenceIds:readonly string[]
  authority:'LEARNING_ONLY'
  bettingAuthority:'NONE'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const iso=(v:string,c:string)=>{if(Number.isNaN(Date.parse(v)))throw new Error(c)}
const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}
const prob=(v:number,c:string)=>{if(!Number.isFinite(v)||v<=0||v>=1)throw new Error(c)}
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function sportsOddsToDecimal(format:SportsOddsFormat,odds:string):number{
  nonEmpty(odds,'MONEY_SPORTS_ODDS_REQUIRED')
  const n=Number(odds)
  if(!Number.isFinite(n))throw new Error('MONEY_SPORTS_ODDS_INVALID')
  if(format==='DECIMAL'){
    if(n<=1)throw new Error('MONEY_SPORTS_DECIMAL_ODDS_INVALID')
    return n
  }
  if(n===0||Math.abs(n)<100)throw new Error('MONEY_SPORTS_AMERICAN_ODDS_INVALID')
  return n>0?1+n/100:1+100/Math.abs(n)
}

export function sportsImpliedProbability(decimalOdds:number):number{
  if(!Number.isFinite(decimalOdds)||decimalOdds<=1)throw new Error('MONEY_SPORTS_DECIMAL_ODDS_INVALID')
  return 1/decimalOdds
}

export function assertSportsMarketQuote(q:SportsMarketQuote):void{
  for(const [v,c] of [[q.quoteId,'MONEY_SPORTS_QUOTE_ID_REQUIRED'],[q.provider,'MONEY_SPORTS_QUOTE_PROVIDER_REQUIRED'],[q.eventId,'MONEY_SPORTS_EVENT_REQUIRED'],[q.marketId,'MONEY_SPORTS_MARKET_REQUIRED'],[q.selectionId,'MONEY_SPORTS_SELECTION_REQUIRED']] as const)nonEmpty(v,c)
  iso(q.observedAt,'MONEY_SPORTS_QUOTE_OBSERVED_INVALID');iso(q.availableAt,'MONEY_SPORTS_QUOTE_AVAILABLE_INVALID')
  if(q.availableAt<q.observedAt)throw new Error('MONEY_SPORTS_QUOTE_AVAILABLE_BEFORE_OBSERVED')
  sportsOddsToDecimal(q.oddsFormat,q.odds)
  if(!q.evidenceIds.length)throw new Error('MONEY_SPORTS_QUOTE_EVIDENCE_REQUIRED')
  if(q.authority!=='EVIDENCE_ONLY'||q.canExecute!==false)throw new Error('MONEY_SPORTS_QUOTE_AUTHORITY_FORBIDDEN')
}

export function createSportsPaperWager(input:{
  strategyId:string
  quote:SportsMarketQuote
  fairProbability:number
  stakeMinor:bigint
  currency:string
  placedAt:string
  informationCutoff:string
  evidenceIds:readonly string[]
}):SportsPaperWager{
  assertSportsMarketQuote(input.quote);nonEmpty(input.strategyId,'MONEY_SPORTS_STRATEGY_REQUIRED');nonEmpty(input.currency,'MONEY_SPORTS_CURRENCY_REQUIRED')
  prob(input.fairProbability,'MONEY_SPORTS_FAIR_PROBABILITY_INVALID')
  if(input.stakeMinor<=0n)throw new Error('MONEY_SPORTS_STAKE_INVALID')
  iso(input.placedAt,'MONEY_SPORTS_PLACED_AT_INVALID');iso(input.informationCutoff,'MONEY_SPORTS_CUTOFF_INVALID')
  if(input.quote.availableAt>input.informationCutoff)throw new Error('MONEY_SPORTS_QUOTE_FUTURE_LEAK')
  if(input.informationCutoff>input.placedAt)throw new Error('MONEY_SPORTS_CUTOFF_AFTER_PLACED')
  if(!input.evidenceIds.length)throw new Error('MONEY_SPORTS_WAGER_EVIDENCE_REQUIRED')
  const decimalOdds=sportsOddsToDecimal(input.quote.oddsFormat,input.quote.odds)
  const impliedProbability=sportsImpliedProbability(decimalOdds)
  const estimatedEdge=input.fairProbability-impliedProbability
  return Object.freeze({
    wagerId:'sports-paper:'+hash({strategyId:input.strategyId,quoteId:input.quote.quoteId,fairProbability:input.fairProbability,stakeMinor:input.stakeMinor.toString(),placedAt:input.placedAt}),
    strategyId:input.strategyId,eventId:input.quote.eventId,marketId:input.quote.marketId,selectionId:input.quote.selectionId,quoteId:input.quote.quoteId,
    decimalOdds,impliedProbability,fairProbability:input.fairProbability,estimatedEdge,stakeMinor:input.stakeMinor,currency:input.currency,placedAt:input.placedAt,informationCutoff:input.informationCutoff,
    evidenceIds:unique([...input.quote.evidenceIds,...input.evidenceIds]),status:'OPEN',simulationAuthority:'PAPER_ONLY',bettingAuthority:'NONE',financialAuthority:'NONE',canExecute:false,
  })
}

function roundedMinor(value:number):bigint{
  if(!Number.isFinite(value)||value<0)throw new Error('MONEY_SPORTS_PAYOUT_INVALID')
  return BigInt(Math.round(value))
}

export function settleSportsPaperWager(input:{
  wager:SportsPaperWager
  status:Exclude<SportsPaperWagerStatus,'OPEN'>
  resolvedAt:string
  evidenceIds:readonly string[]
  closingQuote?:SportsMarketQuote
}):SportsPaperSettlement{
  if(input.wager.simulationAuthority!=='PAPER_ONLY'||input.wager.bettingAuthority!=='NONE'||input.wager.canExecute!==false)throw new Error('MONEY_SPORTS_PAPER_AUTHORITY_FORBIDDEN')
  iso(input.resolvedAt,'MONEY_SPORTS_RESOLVED_AT_INVALID')
  if(input.resolvedAt<input.wager.placedAt)throw new Error('MONEY_SPORTS_RESOLVED_BEFORE_PLACED')
  if(!input.evidenceIds.length)throw new Error('MONEY_SPORTS_SETTLEMENT_EVIDENCE_REQUIRED')
  let payoutMinor=0n
  if(input.status==='WON')payoutMinor=roundedMinor(Number(input.wager.stakeMinor)*input.wager.decimalOdds)
  else if(input.status==='PUSH'||input.status==='VOID')payoutMinor=input.wager.stakeMinor
  const profitLossMinor=payoutMinor-input.wager.stakeMinor
  let closingDecimalOdds:number|undefined,closingImpliedProbability:number|undefined,closingLineValue:number|undefined
  if(input.closingQuote){
    assertSportsMarketQuote(input.closingQuote)
    if(input.closingQuote.eventId!==input.wager.eventId||input.closingQuote.marketId!==input.wager.marketId||input.closingQuote.selectionId!==input.wager.selectionId)throw new Error('MONEY_SPORTS_CLOSING_QUOTE_MISMATCH')
    if(input.closingQuote.availableAt>input.resolvedAt)throw new Error('MONEY_SPORTS_CLOSING_QUOTE_FUTURE_LEAK')
    closingDecimalOdds=sportsOddsToDecimal(input.closingQuote.oddsFormat,input.closingQuote.odds)
    closingImpliedProbability=sportsImpliedProbability(closingDecimalOdds)
    closingLineValue=closingImpliedProbability-input.wager.impliedProbability
  }
  return Object.freeze({
    settlementId:'sports-paper-settlement:'+hash({wagerId:input.wager.wagerId,status:input.status,resolvedAt:input.resolvedAt,evidenceIds:[...input.evidenceIds].sort()}),
    wagerId:input.wager.wagerId,status:input.status,payoutMinor,profitLossMinor,closingDecimalOdds,closingImpliedProbability,closingLineValue,resolvedAt:input.resolvedAt,
    evidenceIds:unique([...input.wager.evidenceIds,...input.evidenceIds,...(input.closingQuote?.evidenceIds??[])]),authority:'LEARNING_ONLY',bettingAuthority:'NONE',canExecute:false,
  })
}
