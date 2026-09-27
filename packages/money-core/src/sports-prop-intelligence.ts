import { createHash } from 'node:crypto'
import { assertSportsMarketQuote, sportsOddsToDecimal, type SportsMarketQuote } from './sports-paper-betting.js'
import type { SportsHandicapEvidenceSet } from './sports-handicap-evidence.js'

export type SportsPropMarketKind=
  |'RECEPTIONS'|'RECEIVING_YARDS'|'RUSH_ATTEMPTS'|'RUSHING_YARDS'
  |'PASS_ATTEMPTS'|'PASSING_YARDS'|'QB_RUSHING_YARDS'|'LONGEST_RECEPTION'
  |'TOUCHDOWNS'|'OTHER'

export type SportsPropSelectionSide='OVER'|'UNDER'
export type SportsPropOpportunityBasis='VOLUME'|'EFFICIENCY'|'MIXED'
export type SportsPropBuyLowStatus='SUPPORTED'|'UNSUPPORTED'|'NOT_APPLICABLE'
export type SportsPropLadderStatus='ELIGIBLE'|'PARTIAL'|'NOT_ELIGIBLE'|'REQUIRES_MODEL'

export type SportsPropLineObservation=Readonly<{
  observationId:string
  playerId:string
  marketKind:SportsPropMarketKind
  side:SportsPropSelectionSide
  line:number
  quote:SportsMarketQuote
  alternate:boolean
  observedAt:string
  evidenceIds:readonly string[]
}>

export type SportsPropRoleContext=Readonly<{
  routeParticipationBps?:number
  targetShareBps?:number
  firstReadShareBps?:number
  carryShareBps?:number
  snapShareBps?:number
  projectedOpportunityShareBps?:number
  priorOpportunityShareBps?:number
  publicTicketShareBps?:number
}>

export type SportsPropAssessment=Readonly<{
  assessmentId:string
  playerId:string
  eventId:string
  marketKind:SportsPropMarketKind
  side:SportsPropSelectionSide
  line:number
  decimalOdds:number
  impliedProbability:number
  fairProbability:number
  edgeAfterCostsBps:number
  opportunityBasis:SportsPropOpportunityBasis
  buyLowStatus:SportsPropBuyLowStatus
  pros:readonly string[]
  cons:readonly string[]
  reasonCodes:readonly string[]
  evidenceIds:readonly string[]
  marketResistanceInferenceAllowed:false
  authority:'INTELLIGENCE_ONLY'
  bettingAuthority:'NONE'
  financialAuthority:'NONE'
  canExecute:false
}>

export type SportsPropLadderRung=Readonly<{
  rungId:string
  observation:SportsPropLineObservation
  fairProbability:number
  estimatedCostsBps:number
}>

export type SportsPropLadderAssessment=Readonly<{
  ladderId:string
  playerId:string
  marketKind:SportsPropMarketKind
  side:SportsPropSelectionSide
  rungIds:readonly string[]
  eligibleRungIds:readonly string[]
  status:SportsPropLadderStatus
  reasonCodes:readonly string[]
  authority:'INTELLIGENCE_ONLY'
  bettingAuthority:'NONE'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}
const prob=(v:number,c:string)=>{if(!Number.isFinite(v)||v<=0||v>=1)throw new Error(c)}
const signedBps=(v:number,c:string)=>{if(!Number.isInteger(v)||v<-10000||v>10000)throw new Error(c)}
const unitBps=(v:number|undefined,c:string)=>{if(v!==undefined&&(!Number.isInteger(v)||v<0||v>10000))throw new Error(c)}
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function createSportsPropLineObservation(input:Omit<SportsPropLineObservation,'observedAt'>):SportsPropLineObservation{
  assertSportsMarketQuote(input.quote)
  nonEmpty(input.observationId,'MONEY_PROP_OBSERVATION_ID_REQUIRED')
  nonEmpty(input.playerId,'MONEY_PROP_PLAYER_REQUIRED')
  if(!Number.isFinite(input.line)||input.line<0)throw new Error('MONEY_PROP_LINE_INVALID')
  if(!input.evidenceIds.length)throw new Error('MONEY_PROP_LINE_EVIDENCE_REQUIRED')
  return Object.freeze({...input,observedAt:input.quote.observedAt,evidenceIds:unique([...input.quote.evidenceIds,...input.evidenceIds])})
}

function assertRoleContext(r:SportsPropRoleContext):void{
  for(const [v,c] of [
    [r.routeParticipationBps,'MONEY_PROP_ROUTE_SHARE_INVALID'],
    [r.targetShareBps,'MONEY_PROP_TARGET_SHARE_INVALID'],
    [r.firstReadShareBps,'MONEY_PROP_FIRST_READ_INVALID'],
    [r.carryShareBps,'MONEY_PROP_CARRY_SHARE_INVALID'],
    [r.snapShareBps,'MONEY_PROP_SNAP_SHARE_INVALID'],
    [r.projectedOpportunityShareBps,'MONEY_PROP_PROJECTED_SHARE_INVALID'],
    [r.priorOpportunityShareBps,'MONEY_PROP_PRIOR_SHARE_INVALID'],
    [r.publicTicketShareBps,'MONEY_PROP_PUBLIC_SHARE_INVALID'],
  ] as const)unitBps(v,c)
}

export function assessSportsProp(input:{
  observation:SportsPropLineObservation
  fairProbability:number
  estimatedCostsBps:number
  opportunityBasis:SportsPropOpportunityBasis
  evidenceSet:SportsHandicapEvidenceSet
  roleContext?:SportsPropRoleContext
  priorClosingLine?:number
  priorResultMissed?:boolean
  lineMovementSincePublicSplit?:number
}):SportsPropAssessment{
  const o=input.observation
  assertSportsMarketQuote(o.quote)
  prob(input.fairProbability,'MONEY_PROP_FAIR_PROBABILITY_INVALID')
  if(!Number.isInteger(input.estimatedCostsBps)||input.estimatedCostsBps<0||input.estimatedCostsBps>10000)throw new Error('MONEY_PROP_COST_INVALID')
  if(input.evidenceSet.eventId!==o.quote.eventId)throw new Error('MONEY_PROP_EVIDENCE_EVENT_MISMATCH')
  if(input.evidenceSet.authority!=='INTELLIGENCE_ONLY'||input.evidenceSet.canExecute!==false)throw new Error('MONEY_PROP_EVIDENCE_AUTHORITY_INVALID')
  const role=input.roleContext??{}
  assertRoleContext(role)
  if(input.priorClosingLine!==undefined&&(!Number.isFinite(input.priorClosingLine)||input.priorClosingLine<0))throw new Error('MONEY_PROP_PRIOR_LINE_INVALID')
  if(input.lineMovementSincePublicSplit!==undefined&&!Number.isFinite(input.lineMovementSincePublicSplit))throw new Error('MONEY_PROP_LINE_MOVE_INVALID')

  const decimalOdds=sportsOddsToDecimal(o.quote.oddsFormat,o.quote.odds)
  const impliedProbability=1/decimalOdds
  const edgeAfterCostsBps=Math.round((input.fairProbability-impliedProbability)*10000)-input.estimatedCostsBps
  signedBps(Math.max(-10000,Math.min(10000,edgeAfterCostsBps)),'MONEY_PROP_EDGE_INVALID')
  const pros:string[]=[]
  const cons:string[]=[]
  const reasons:string[]=[]

  if(edgeAfterCostsBps>0)pros.push('Estimated fair hit probability clears the offered break-even probability after costs.')
  else cons.push('Estimated fair hit probability does not clear the offered break-even probability after costs.')

  const shares=[role.routeParticipationBps,role.targetShareBps,role.firstReadShareBps,role.carryShareBps,role.snapShareBps,role.projectedOpportunityShareBps].filter((x):x is number=>x!==undefined)
  if(shares.some(x=>x>=7000))pros.push('Role/opportunity concentration is high.')
  if(input.opportunityBasis==='VOLUME'&&shares.length===0){
    cons.push('Volume thesis has no explicit role/opportunity-share evidence.')
    reasons.push('VOLUME_THESIS_REQUIRES_USAGE_EVIDENCE')
  }

  let buyLowStatus:SportsPropBuyLowStatus='NOT_APPLICABLE'
  if(input.priorClosingLine!==undefined){
    const lineImproved=o.side==='OVER'?o.line<input.priorClosingLine:o.line>input.priorClosingLine
    const current=role.projectedOpportunityShareBps
    const prior=role.priorOpportunityShareBps
    const roleStable=current!==undefined&&prior!==undefined&&current>=prior-500
    if(lineImproved&&roleStable){
      buyLowStatus='SUPPORTED'
      pros.push('The current line is more favorable than the prior close while projected opportunity share remains stable.')
      reasons.push('BUY_LOW_REQUIRES_PRICE_DISCOUNT_PLUS_ROLE_STABILITY')
    }else{
      buyLowStatus='UNSUPPORTED'
      cons.push('A lower recent box-score result or cheaper line is not enough to establish a buy-low edge.')
    }
  }
  if(input.priorResultMissed&&buyLowStatus!=='SUPPORTED')reasons.push('RECENT_MISS_IS_NOT_BUY_LOW_PROOF')

  if(role.publicTicketShareBps!==undefined&&role.publicTicketShareBps>=7500&&input.lineMovementSincePublicSplit!==undefined&&Math.abs(input.lineMovementSincePublicSplit)<0.5){
    reasons.push('LINE_RESISTANCE_IS_OBSERVATION_NOT_SHARP_PROOF')
    cons.push('Heavy public ticket concentration with little line movement is not sufficient to infer bookmaker or sharp-side intent.')
  }

  if(input.evidenceSet.untestedNarrativeIds.length)reasons.push('NARRATIVE_EVIDENCE_REMAINS_UNTESTED')
  if(input.evidenceSet.marketCount)pros.push('Market evidence is explicitly separated from player/team performance evidence.')

  return Object.freeze({
    assessmentId:'sports-prop:'+hash({observationId:o.observationId,fairProbability:input.fairProbability,estimatedCostsBps:input.estimatedCostsBps,opportunityBasis:input.opportunityBasis,evidenceSetId:input.evidenceSet.evidenceSetId}),
    playerId:o.playerId,eventId:o.quote.eventId,marketKind:o.marketKind,side:o.side,line:o.line,
    decimalOdds,impliedProbability,fairProbability:input.fairProbability,edgeAfterCostsBps,
    opportunityBasis:input.opportunityBasis,buyLowStatus,pros:Object.freeze(pros),cons:Object.freeze(cons),
    reasonCodes:unique(reasons),evidenceIds:unique([...o.evidenceIds,...input.evidenceSet.evidence.map(e=>e.evidenceId)]),
    marketResistanceInferenceAllowed:false,authority:'INTELLIGENCE_ONLY',bettingAuthority:'NONE',financialAuthority:'NONE',canExecute:false,
  })
}

export function assessSportsPropLadder(input:{
  playerId:string
  marketKind:SportsPropMarketKind
  side:SportsPropSelectionSide
  rungs:readonly SportsPropLadderRung[]
}):SportsPropLadderAssessment{
  nonEmpty(input.playerId,'MONEY_PROP_LADDER_PLAYER_REQUIRED')
  if(input.rungs.length<2)throw new Error('MONEY_PROP_LADDER_MIN_TWO_RUNGS')
  const ordered=[...input.rungs].sort((a,b)=>a.observation.line-b.observation.line)
  for(const r of ordered){
    if(r.observation.playerId!==input.playerId||r.observation.marketKind!==input.marketKind||r.observation.side!==input.side)throw new Error('MONEY_PROP_LADDER_LINEAGE_MISMATCH')
    prob(r.fairProbability,'MONEY_PROP_LADDER_FAIR_PROBABILITY_INVALID')
    if(!Number.isInteger(r.estimatedCostsBps)||r.estimatedCostsBps<0||r.estimatedCostsBps>10000)throw new Error('MONEY_PROP_LADDER_COST_INVALID')
  }
  let monotonic=true
  for(let i=1;i<ordered.length;i++){
    const prev=ordered[i-1]!,cur=ordered[i]!
    if(input.side==='OVER'&&cur.fairProbability>prev.fairProbability)monotonic=false
    if(input.side==='UNDER'&&cur.fairProbability<prev.fairProbability)monotonic=false
  }
  const reasons:string[]=[]
  if(!monotonic)reasons.push('ALT_LINE_PROBABILITIES_NON_MONOTONIC')
  const eligible=monotonic?ordered.filter(r=>{
    const implied=1/sportsOddsToDecimal(r.observation.quote.oddsFormat,r.observation.quote.odds)
    return Math.round((r.fairProbability-implied)*10000)-r.estimatedCostsBps>0
  }).map(r=>r.rungId):[]
  const status:SportsPropLadderStatus=!monotonic?'REQUIRES_MODEL':eligible.length===0?'NOT_ELIGIBLE':eligible.length===ordered.length?'ELIGIBLE':'PARTIAL'
  if(eligible.length<ordered.length)reasons.push('EACH_ALT_RUNG_REQUIRES_ITS_OWN_POSITIVE_EDGE')
  return Object.freeze({
    ladderId:'sports-prop-ladder:'+hash({playerId:input.playerId,marketKind:input.marketKind,side:input.side,rungs:ordered.map(r=>r.rungId)}),
    playerId:input.playerId,marketKind:input.marketKind,side:input.side,rungIds:Object.freeze(ordered.map(r=>r.rungId)),
    eligibleRungIds:Object.freeze(eligible),status,reasonCodes:unique(reasons),
    authority:'INTELLIGENCE_ONLY',bettingAuthority:'NONE',canExecute:false,
  })
}
