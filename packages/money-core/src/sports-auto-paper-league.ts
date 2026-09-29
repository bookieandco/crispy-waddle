import {createHash} from 'node:crypto'
import {createSportsPaperWager,settleSportsPaperWager,type SportsMarketQuote,type SportsPaperSettlement,type SportsPaperWager,type SportsPaperWagerStatus} from './sports-paper-betting.js'
import type {SportsForwardShadowPrediction} from './sports-prediction-forward-shadow.js'

export type SportsAutoPaperAction='PAPER_WAGER'|'NO_BET'

export type SportsAutoPaperPolicy=Readonly<{
  policyId:string
  bankrollMinor:bigint
  currency:string
  stakeBps:number
  maxStakeMinor:bigint
  minimumEdgeBps:number
  maximumQuoteAgeSeconds:number
  allowedMarketFamilies?:readonly string[]
  authority:'PAPER_POLICY_ONLY'
  canAuthorizeLive:false
}>

export type SportsAutoPaperDecision=Readonly<{
  decisionId:string
  predictionId:string
  eventId:string
  marketFamily:string
  action:SportsAutoPaperAction
  reasonCodes:readonly string[]
  edgeBps:number
  quoteAgeSeconds:number
  stakeMinor:bigint
  decidedAt:string
  paperWager?:SportsPaperWager
  evidenceIds:readonly string[]
  authority:'PAPER_AUTOMATION_ONLY'
  bettingAuthority:'NONE'
  canExecute:false
}>

export type SportsPaperProcessClass=
  |'GOOD_PROCESS_GOOD_RESULT'
  |'GOOD_PROCESS_BAD_RESULT'
  |'WEAK_PROCESS_GOOD_RESULT'
  |'WEAK_PROCESS_BAD_RESULT'
  |'NON_DECISION_RESULT'

export type SportsAutoPaperReview=Readonly<{
  reviewId:string
  decisionId:string
  settlementId:string
  processClass:SportsPaperProcessClass
  positiveEntryEdge:boolean
  positiveClosingLineValue:boolean|null
  returnBps:number
  reasonCodes:readonly string[]
  evidenceIds:readonly string[]
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
}>

const stable=(value:unknown):string=>JSON.stringify(value,(_,item)=>typeof item==='bigint'?item.toString():item)
const hash=(value:unknown):string=>createHash('sha256').update(stable(value)).digest('hex')
const instant=(value:string,code:string):number=>{const parsed=Date.parse(value);if(Number.isNaN(parsed))throw new Error(code);return parsed}
const unique=(values:readonly string[]):readonly string[]=>Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))].sort())

export function assertSportsAutoPaperPolicy(policy:SportsAutoPaperPolicy):void{
  if(!policy.policyId.trim()||!policy.currency.trim())throw new Error('SPORT_AUTO_PAPER_POLICY_IDENTITY_REQUIRED')
  if(policy.bankrollMinor<=0n||policy.maxStakeMinor<=0n)throw new Error('SPORT_AUTO_PAPER_BANKROLL_INVALID')
  if(!Number.isInteger(policy.stakeBps)||policy.stakeBps<1||policy.stakeBps>10000)throw new Error('SPORT_AUTO_PAPER_STAKE_BPS_INVALID')
  if(!Number.isInteger(policy.minimumEdgeBps))throw new Error('SPORT_AUTO_PAPER_EDGE_THRESHOLD_INVALID')
  if(!Number.isInteger(policy.maximumQuoteAgeSeconds)||policy.maximumQuoteAgeSeconds<1)throw new Error('SPORT_AUTO_PAPER_QUOTE_AGE_INVALID')
  if(policy.authority!=='PAPER_POLICY_ONLY'||policy.canAuthorizeLive!==false)throw new Error('SPORT_AUTO_PAPER_POLICY_AUTHORITY_INVALID')
}

function paperStake(policy:SportsAutoPaperPolicy):bigint{
  const proportional=policy.bankrollMinor*BigInt(policy.stakeBps)/10000n
  const capped=proportional<policy.maxStakeMinor?proportional:policy.maxStakeMinor
  if(capped<=0n)throw new Error('SPORT_AUTO_PAPER_STAKE_ROUNDED_TO_ZERO')
  return capped
}

export function decideSportsAutomaticPaperWager(input:{
  prediction:SportsForwardShadowPrediction
  policy:SportsAutoPaperPolicy
  decisionAt:string
  evidenceIds:readonly string[]
}):SportsAutoPaperDecision{
  assertSportsAutoPaperPolicy(input.policy)
  const prediction=input.prediction
  if(prediction.authority!=='SHADOW_ONLY'||prediction.canExecute!==false||prediction.bettingAuthority!=='NONE')throw new Error('SPORT_AUTO_PAPER_PREDICTION_AUTHORITY_INVALID')
  const decidedAt=instant(input.decisionAt,'SPORT_AUTO_PAPER_DECISION_TIME_INVALID')
  const quoteAt=instant(prediction.quote.availableAt,'SPORT_AUTO_PAPER_QUOTE_TIME_INVALID')
  if(quoteAt>decidedAt)throw new Error('SPORT_AUTO_PAPER_FUTURE_QUOTE')
  const evidenceIds=unique([...prediction.evidenceIds,...input.evidenceIds])
  if(!evidenceIds.length)throw new Error('SPORT_AUTO_PAPER_EVIDENCE_REQUIRED')
  const quoteAgeSeconds=Math.floor((decidedAt-quoteAt)/1000)
  const reasons:string[]=[]
  if(quoteAgeSeconds>input.policy.maximumQuoteAgeSeconds)reasons.push('STALE_QUOTE')
  if(prediction.edgeAtEntryBps<input.policy.minimumEdgeBps)reasons.push('EDGE_BELOW_THRESHOLD')
  if(input.policy.allowedMarketFamilies&&!input.policy.allowedMarketFamilies.includes(prediction.marketFamily))reasons.push('MARKET_FAMILY_NOT_ALLOWED')
  const stakeMinor=paperStake(input.policy)
  const action:SportsAutoPaperAction=reasons.length?'NO_BET':'PAPER_WAGER'
  const paperWager=action==='PAPER_WAGER'?createSportsPaperWager({
    strategyId:prediction.envelope.model.modelId+'@'+prediction.envelope.model.modelVersion,
    quote:prediction.quote,
    fairProbability:prediction.fairProbability,
    stakeMinor,
    currency:input.policy.currency,
    placedAt:input.decisionAt,
    informationCutoff:prediction.envelope.informationCutoff,
    evidenceIds,
  }):undefined
  return Object.freeze({
    decisionId:'sports-auto-paper:'+hash({predictionId:prediction.predictionId,policyId:input.policy.policyId,decisionAt:input.decisionAt}),
    predictionId:prediction.predictionId,
    eventId:prediction.eventId,
    marketFamily:prediction.marketFamily,
    action,
    reasonCodes:unique(reasons),
    edgeBps:prediction.edgeAtEntryBps,
    quoteAgeSeconds,
    stakeMinor,
    decidedAt:input.decisionAt,
    paperWager,
    evidenceIds,
    authority:'PAPER_AUTOMATION_ONLY',
    bettingAuthority:'NONE',
    canExecute:false,
  })
}

export function settleSportsAutomaticPaperWager(input:{
  decision:SportsAutoPaperDecision
  status:Exclude<SportsPaperWagerStatus,'OPEN'>
  resolvedAt:string
  evidenceIds:readonly string[]
  closingQuote?:SportsMarketQuote
}):Readonly<{settlement:SportsPaperSettlement;review:SportsAutoPaperReview}>{
  const wager=input.decision.paperWager
  if(input.decision.action!=='PAPER_WAGER'||!wager)throw new Error('SPORT_AUTO_PAPER_NO_WAGER_TO_SETTLE')
  const settlement=settleSportsPaperWager({
    wager,
    status:input.status,
    resolvedAt:input.resolvedAt,
    evidenceIds:input.evidenceIds,
    closingQuote:input.closingQuote,
  })
  const positiveEntryEdge=input.decision.edgeBps>0
  const positiveClosingLineValue=settlement.closingLineValue===undefined?null:settlement.closingLineValue>0
  const processPositive=positiveEntryEdge&&(positiveClosingLineValue===null||positiveClosingLineValue)
  let processClass:SportsPaperProcessClass='NON_DECISION_RESULT'
  if(settlement.status==='WON')processClass=processPositive?'GOOD_PROCESS_GOOD_RESULT':'WEAK_PROCESS_GOOD_RESULT'
  else if(settlement.status==='LOST')processClass=processPositive?'GOOD_PROCESS_BAD_RESULT':'WEAK_PROCESS_BAD_RESULT'
  const reasons:string[]=[]
  reasons.push(positiveEntryEdge?'POSITIVE_ENTRY_EDGE':'ENTRY_EDGE_NOT_POSITIVE')
  if(positiveClosingLineValue===true)reasons.push('POSITIVE_CLOSING_LINE_VALUE')
  else if(positiveClosingLineValue===false)reasons.push('NON_POSITIVE_CLOSING_LINE_VALUE')
  else reasons.push('CLOSING_LINE_VALUE_UNAVAILABLE')
  if(settlement.status==='LOST')reasons.push('LOSS_REMAINS_LOSS')
  if(settlement.status==='PUSH'||settlement.status==='VOID')reasons.push('NON_DECISION_RESULT')
  const returnBps=Number(settlement.profitLossMinor*10000n/wager.stakeMinor)
  const evidenceIds=unique([...input.decision.evidenceIds,...settlement.evidenceIds])
  const review:SportsAutoPaperReview=Object.freeze({
    reviewId:'sports-auto-paper-review:'+hash({decisionId:input.decision.decisionId,settlementId:settlement.settlementId}),
    decisionId:input.decision.decisionId,
    settlementId:settlement.settlementId,
    processClass,
    positiveEntryEdge,
    positiveClosingLineValue,
    returnBps,
    reasonCodes:unique(reasons),
    evidenceIds,
    authority:'LEARNING_ONLY',
    canAuthorizeLive:false,
  })
  return Object.freeze({settlement,review})
}

export class SportsAutomaticPaperLeague{
  private readonly decisions=new Map<string,SportsAutoPaperDecision>()
  private readonly settlements=new Map<string,SportsPaperSettlement>()
  private readonly reviews=new Map<string,SportsAutoPaperReview>()

  evaluate(input:{
    prediction:SportsForwardShadowPrediction
    policy:SportsAutoPaperPolicy
    decisionAt:string
    evidenceIds:readonly string[]
  }):SportsAutoPaperDecision{
    const existing=this.decisions.get(input.prediction.predictionId)
    if(existing)return existing
    const decision=decideSportsAutomaticPaperWager(input)
    this.decisions.set(input.prediction.predictionId,decision)
    return decision
  }

  settle(input:{
    predictionId:string
    status:Exclude<SportsPaperWagerStatus,'OPEN'>
    resolvedAt:string
    evidenceIds:readonly string[]
    closingQuote?:SportsMarketQuote
  }):Readonly<{settlement:SportsPaperSettlement;review:SportsAutoPaperReview}>{
    const decision=this.decisions.get(input.predictionId)
    if(!decision)throw new Error('SPORT_AUTO_PAPER_DECISION_NOT_FOUND')
    const existingSettlement=decision.paperWager?this.settlements.get(decision.paperWager.wagerId):undefined
    const existingReview=this.reviews.get(decision.decisionId)
    if(existingSettlement&&existingReview)return Object.freeze({settlement:existingSettlement,review:existingReview})
    const result=settleSportsAutomaticPaperWager({...input,decision})
    this.settlements.set(result.settlement.wagerId,result.settlement)
    this.reviews.set(decision.decisionId,result.review)
    return result
  }

  listDecisions():readonly SportsAutoPaperDecision[]{return Object.freeze([...this.decisions.values()])}
  listSettlements():readonly SportsPaperSettlement[]{return Object.freeze([...this.settlements.values()])}
  listReviews():readonly SportsAutoPaperReview[]{return Object.freeze([...this.reviews.values()])}
}
