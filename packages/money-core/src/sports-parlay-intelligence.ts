import { createHash } from 'node:crypto'
import { sportsOddsToDecimal, type SportsMarketQuote } from './sports-paper-betting.js'

export type SportsParlayTicketKind='BANKROLL_BUILDER'|'TEASER'|'SAME_GAME_PARLAY'|'ANYTIME_TD_PARLAY'|'COMMUNITY_PARLAY'|'STANDARD'
export type SportsParlayMarketKind='MONEYLINE'|'SPREAD'|'TOTAL'|'PLAYER_PROP'|'ANYTIME_TD'|'ALT_SPREAD'|'ALT_TOTAL'|'TEASER_LEG'
export type ParlayDependencyKind='POSITIVE'|'NEGATIVE'|'SHARED_GAME_SCRIPT'|'COMMON_DRIVER'|'UNKNOWN'
export type ParlayCoherence='COHERENT'|'MIXED'|'CONTRADICTORY'|'UNVERIFIED'

export type SportsParlayLeg=Readonly<{
  legId:string
  eventId:string
  marketId:string
  selectionId:string
  marketKind:SportsParlayMarketKind
  quote:SportsMarketQuote
  fairProbability:number
  impliedProbability:number
  edgeAfterCostsBps:number
  thesis:string
  gameScriptTags:readonly string[]
  evidenceIds:readonly string[]
  authority:'INTELLIGENCE_ONLY'
  canExecute:false
}>

export type SportsParlayDependency=Readonly<{
  dependencyId:string
  legAId:string
  legBId:string
  kind:ParlayDependencyKind
  strengthBps:number
  rationale:string
  evidenceIds:readonly string[]
}>

export type TeaserAdjustment=Readonly<{
  legId:string
  originalLine:number
  adjustedLine:number
  pointsBought:number
  crossedKeyNumbers:readonly number[]
  priceBeforeDecimal:number
  priceAfterDecimal:number
  fairProbabilityAfter:number
  edgeAfterCostsBps:number
  evidenceIds:readonly string[]
}>

export type CommunitySelectionSignal=Readonly<{
  signalId:string
  eventId:string
  marketId:string
  selectionId:string
  voteCount:number
  eligibleVoterCount:number
  cutoffAt:string
  capturedAt:string
  evidenceIds:readonly string[]
  authority:'SENTIMENT_ONLY'
  canExecute:false
}>

export type SportsParlayAssessment=Readonly<{
  assessmentId:string
  ticketKind:SportsParlayTicketKind
  legIds:readonly string[]
  eventIds:readonly string[]
  quotedDecimalOdds:number
  marketImpliedProbability:number
  naiveIndependentFairProbability:number
  jointFairProbability:number|null
  expectedEdgeBps:number|null
  coherence:ParlayCoherence
  pros:readonly string[]
  cons:readonly string[]
  reasonCodes:readonly string[]
  evidenceIds:readonly string[]
  requiresJointModel:boolean
  authority:'INTELLIGENCE_ONLY'
  bettingAuthority:'NONE'
  financialAuthority:'NONE'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const prob=(v:number,c:string)=>{if(!Number.isFinite(v)||v<=0||v>=1)throw new Error(c)}
const bps=(v:number,c:string)=>{if(!Number.isInteger(v)||v<-10000||v>10000)throw new Error(c)}
const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function createSportsParlayLeg(input:{
  legId:string
  marketKind:SportsParlayMarketKind
  quote:SportsMarketQuote
  fairProbability:number
  edgeAfterCostsBps:number
  thesis:string
  gameScriptTags?:readonly string[]
  evidenceIds:readonly string[]
}):SportsParlayLeg{
  nonEmpty(input.legId,'MONEY_PARLAY_LEG_ID_REQUIRED')
  nonEmpty(input.thesis,'MONEY_PARLAY_THESIS_REQUIRED')
  prob(input.fairProbability,'MONEY_PARLAY_FAIR_PROBABILITY_INVALID')
  bps(input.edgeAfterCostsBps,'MONEY_PARLAY_EDGE_INVALID')
  if(!input.evidenceIds.length)throw new Error('MONEY_PARLAY_EVIDENCE_REQUIRED')
  const decimal=sportsOddsToDecimal(input.quote.oddsFormat,input.quote.odds)
  return Object.freeze({
    legId:input.legId,
    eventId:input.quote.eventId,
    marketId:input.quote.marketId,
    selectionId:input.quote.selectionId,
    marketKind:input.marketKind,
    quote:input.quote,
    fairProbability:input.fairProbability,
    impliedProbability:1/decimal,
    edgeAfterCostsBps:input.edgeAfterCostsBps,
    thesis:input.thesis,
    gameScriptTags:unique(input.gameScriptTags??[]),
    evidenceIds:unique([...input.quote.evidenceIds,...input.evidenceIds]),
    authority:'INTELLIGENCE_ONLY',
    canExecute:false,
  })
}

export function assessTeaserAdjustment(input:{
  legId:string
  originalLine:number
  adjustedLine:number
  priceBeforeDecimal:number
  priceAfterDecimal:number
  fairProbabilityAfter:number
  estimatedCostsBps:number
  evidenceIds:readonly string[]
  keyNumbers?:readonly number[]
}):TeaserAdjustment{
  nonEmpty(input.legId,'MONEY_TEASER_LEG_ID_REQUIRED')
  if(!Number.isFinite(input.originalLine)||!Number.isFinite(input.adjustedLine))throw new Error('MONEY_TEASER_LINE_INVALID')
  if(!Number.isFinite(input.priceBeforeDecimal)||input.priceBeforeDecimal<=1||!Number.isFinite(input.priceAfterDecimal)||input.priceAfterDecimal<=1)throw new Error('MONEY_TEASER_PRICE_INVALID')
  prob(input.fairProbabilityAfter,'MONEY_TEASER_FAIR_PROBABILITY_INVALID')
  if(!Number.isInteger(input.estimatedCostsBps)||input.estimatedCostsBps<0||input.estimatedCostsBps>10000)throw new Error('MONEY_TEASER_COST_INVALID')
  if(!input.evidenceIds.length)throw new Error('MONEY_TEASER_EVIDENCE_REQUIRED')
  const pointsBought=Math.abs(input.adjustedLine-input.originalLine)
  const keys=[...(input.keyNumbers??[3,7])].filter(Number.isFinite).map(Math.abs).sort((a,b)=>a-b)
  const lo=Math.min(Math.abs(input.originalLine),Math.abs(input.adjustedLine))
  const hi=Math.max(Math.abs(input.originalLine),Math.abs(input.adjustedLine))
  const crossedKeyNumbers=Object.freeze(keys.filter(k=>lo<k&&k<=hi))
  const marketProbAfter=1/input.priceAfterDecimal
  const edgeAfterCostsBps=Math.round((input.fairProbabilityAfter-marketProbAfter)*10000)-input.estimatedCostsBps
  return Object.freeze({
    legId:input.legId,
    originalLine:input.originalLine,
    adjustedLine:input.adjustedLine,
    pointsBought,
    crossedKeyNumbers,
    priceBeforeDecimal:input.priceBeforeDecimal,
    priceAfterDecimal:input.priceAfterDecimal,
    fairProbabilityAfter:input.fairProbabilityAfter,
    edgeAfterCostsBps,
    evidenceIds:unique(input.evidenceIds),
  })
}

export function createCommunitySelectionSignal(input:Omit<CommunitySelectionSignal,'authority'|'canExecute'>):CommunitySelectionSignal{
  nonEmpty(input.signalId,'MONEY_COMMUNITY_SIGNAL_ID_REQUIRED')
  nonEmpty(input.eventId,'MONEY_COMMUNITY_EVENT_REQUIRED')
  nonEmpty(input.marketId,'MONEY_COMMUNITY_MARKET_REQUIRED')
  nonEmpty(input.selectionId,'MONEY_COMMUNITY_SELECTION_REQUIRED')
  if(!Number.isInteger(input.voteCount)||input.voteCount<0||!Number.isInteger(input.eligibleVoterCount)||input.eligibleVoterCount<1||input.voteCount>input.eligibleVoterCount)throw new Error('MONEY_COMMUNITY_VOTE_INVALID')
  if(Number.isNaN(Date.parse(input.cutoffAt))||Number.isNaN(Date.parse(input.capturedAt))||input.capturedAt<input.cutoffAt)throw new Error('MONEY_COMMUNITY_TIME_INVALID')
  if(!input.evidenceIds.length)throw new Error('MONEY_COMMUNITY_EVIDENCE_REQUIRED')
  return Object.freeze({...input,evidenceIds:unique(input.evidenceIds),authority:'SENTIMENT_ONLY',canExecute:false})
}

function dependencyMap(deps:readonly SportsParlayDependency[]){
  const map=new Map<string,SportsParlayDependency>()
  for(const d of deps){
    if(d.legAId===d.legBId)throw new Error('MONEY_PARLAY_SELF_DEPENDENCY')
    if(!Number.isInteger(d.strengthBps)||d.strengthBps<0||d.strengthBps>10000)throw new Error('MONEY_PARLAY_DEPENDENCY_STRENGTH_INVALID')
    if(!d.evidenceIds.length)throw new Error('MONEY_PARLAY_DEPENDENCY_EVIDENCE_REQUIRED')
    const key=[d.legAId,d.legBId].sort().join('|')
    if(map.has(key))throw new Error('MONEY_PARLAY_DUPLICATE_DEPENDENCY')
    map.set(key,d)
  }
  return map
}

export function evaluateSportsParlay(input:{
  ticketKind:SportsParlayTicketKind
  legs:readonly SportsParlayLeg[]
  dependencies?:readonly SportsParlayDependency[]
  quotedDecimalOdds:number
  jointFairProbability?:number
  evidenceIds:readonly string[]
}):SportsParlayAssessment{
  if(input.legs.length<2)throw new Error('MONEY_PARLAY_MIN_TWO_LEGS')
  if(input.legs.length>12)throw new Error('MONEY_PARLAY_TOO_MANY_LEGS')
  if(!Number.isFinite(input.quotedDecimalOdds)||input.quotedDecimalOdds<=1)throw new Error('MONEY_PARLAY_ODDS_INVALID')
  if(!input.evidenceIds.length)throw new Error('MONEY_PARLAY_ASSESSMENT_EVIDENCE_REQUIRED')
  const legIds=input.legs.map(l=>l.legId)
  if(new Set(legIds).size!==legIds.length)throw new Error('MONEY_PARLAY_DUPLICATE_LEG')
  if(input.legs.some(l=>l.authority!=='INTELLIGENCE_ONLY'||l.canExecute!==false))throw new Error('MONEY_PARLAY_LEG_AUTHORITY_INVALID')
  const deps=input.dependencies??[]
  const depMap=dependencyMap(deps)
  const eventIds=unique(input.legs.map(l=>l.eventId))
  const naiveIndependentFairProbability=input.legs.reduce((p,l)=>p*l.fairProbability,1)
  const marketImpliedProbability=1/input.quotedDecimalOdds
  const sameEventPairs:number[]=[]
  for(let i=0;i<input.legs.length;i++)for(let j=i+1;j<input.legs.length;j++){
    if(input.legs[i]!.eventId===input.legs[j]!.eventId)sameEventPairs.push(i*100+j)
  }
  const requiresJointModel=sameEventPairs.length>0||input.ticketKind==='SAME_GAME_PARLAY'
  if(input.jointFairProbability!==undefined)prob(input.jointFairProbability,'MONEY_PARLAY_JOINT_PROBABILITY_INVALID')
  const jointFairProbability=input.jointFairProbability??(requiresJointModel?null:naiveIndependentFairProbability)
  const pros:string[]=[]
  const cons:string[]=[]
  const reasons:string[]=[]

  if(input.legs.every(l=>l.edgeAfterCostsBps>0))pros.push('Every leg has positive estimated standalone edge after costs.')
  else cons.push('At least one leg does not have positive estimated standalone edge after costs.')
  if(requiresJointModel&&jointFairProbability===null){
    cons.push('Same-event legs require a joint probability model; multiplying standalone probabilities is not sufficient.')
    reasons.push('JOINT_MODEL_REQUIRED')
  }
  if(sameEventPairs.length){
    for(let i=0;i<input.legs.length;i++)for(let j=i+1;j<input.legs.length;j++){
      const a=input.legs[i]!,b=input.legs[j]!
      if(a.eventId!==b.eventId)continue
      const key=[a.legId,b.legId].sort().join('|')
      if(!depMap.has(key)){
        cons.push(`Dependency between ${a.legId} and ${b.legId} is not documented.`)
        reasons.push('SAME_EVENT_DEPENDENCY_UNDOCUMENTED')
      }
    }
  }
  const positiveGameScript=deps.filter(d=>d.kind==='SHARED_GAME_SCRIPT'||d.kind==='POSITIVE')
  const negative=deps.filter(d=>d.kind==='NEGATIVE')
  if(positiveGameScript.length)pros.push('The ticket includes documented positive/game-script dependencies.')
  if(negative.length)cons.push('The ticket contains negatively related legs that can fight the same game script.')
  if(input.ticketKind==='BANKROLL_BUILDER')reasons.push('BANKROLL_LABEL_IS_NOT_RISK_PROOF')
  if(input.ticketKind==='COMMUNITY_PARLAY')reasons.push('COMMUNITY_POPULARITY_IS_SENTIMENT_ONLY')
  if(input.ticketKind==='TEASER')reasons.push('TEASER_VALUE_REQUIRES_PRICE_AND_FAIR_PROBABILITY_COMPARISON')

  let coherence:ParlayCoherence='UNVERIFIED'
  if(negative.length)coherence='CONTRADICTORY'
  else if(requiresJointModel&&jointFairProbability===null)coherence='UNVERIFIED'
  else if(positiveGameScript.length)coherence='COHERENT'
  else coherence='MIXED'

  const expectedEdgeBps=jointFairProbability===null?null:Math.round((jointFairProbability-marketImpliedProbability)*10000)
  if(expectedEdgeBps!==null){
    if(expectedEdgeBps>0)pros.push('Estimated joint fair probability exceeds the ticket break-even probability.')
    else cons.push('Estimated joint fair probability does not clear the ticket break-even probability.')
  }

  const evidenceIds=unique([
    ...input.evidenceIds,
    ...input.legs.flatMap(l=>l.evidenceIds),
    ...deps.flatMap(d=>d.evidenceIds),
  ])
  return Object.freeze({
    assessmentId:'sports-parlay:'+hash({ticketKind:input.ticketKind,legIds:[...legIds].sort(),quotedDecimalOdds:input.quotedDecimalOdds,jointFairProbability,deps}),
    ticketKind:input.ticketKind,
    legIds:Object.freeze([...legIds]),
    eventIds,
    quotedDecimalOdds:input.quotedDecimalOdds,
    marketImpliedProbability,
    naiveIndependentFairProbability,
    jointFairProbability,
    expectedEdgeBps,
    coherence,
    pros:Object.freeze(pros),
    cons:Object.freeze(cons),
    reasonCodes:unique(reasons),
    evidenceIds,
    requiresJointModel,
    authority:'INTELLIGENCE_ONLY',
    bettingAuthority:'NONE',
    financialAuthority:'NONE',
    canExecute:false,
  })
}
