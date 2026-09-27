import { createHash } from 'node:crypto'

export type SportsHandicapFeatureKind=
  |'TEAM_EFFICIENCY'
  |'MATCHUP'
  |'INJURY_AVAILABILITY'
  |'DEPTH'
  |'TURNOVER_DISCIPLINE'
  |'PENALTY_DISCIPLINE'
  |'THIRD_DOWN'
  |'RED_ZONE'
  |'PACE_POSSESSION'
  |'WEATHER'
  |'TRAVEL_BODY_CLOCK'
  |'HOME_FIELD'
  |'HISTORICAL_SERIES'
  |'MARKET_MOVE'
  |'PUBLIC_OR_SHARP_FLOW'
  |'COACHING_SCHEME'
  |'PLAYER_ROLE'
  |'NARRATIVE_MOTIVATION'
  |'OTHER'

export type SportsEvidenceClass='MEASURED'|'REPORTED'|'MARKET'|'HISTORICAL'|'NARRATIVE'
export type SportsCausalStatus='DIRECT_MECHANISM'|'SUPPORTING_CONTEXT'|'CORRELATIONAL'|'UNTESTED_NARRATIVE'

export type SportsHandicapEvidence=Readonly<{
  evidenceId:string
  eventId:string
  subjectId:string
  featureKind:SportsHandicapFeatureKind
  evidenceClass:SportsEvidenceClass
  causalStatus:SportsCausalStatus
  value:number|string|boolean
  unit?:string
  direction:'SUPPORTS_SIDE_A'|'SUPPORTS_SIDE_B'|'SUPPORTS_OVER'|'SUPPORTS_UNDER'|'NEUTRAL'|'MIXED'
  observedAt:string
  informationCutoff:string
  sourceType:string
  sourceLocator?:string
  sampleSize?:number
  methodologyVersion?:string
  notes?:string
  authority:'INTELLIGENCE_ONLY'
  canExecute:false
}>

export type SportsHandicapEvidenceSet=Readonly<{
  evidenceSetId:string
  eventId:string
  evidence:readonly SportsHandicapEvidence[]
  measuredCount:number
  reportedCount:number
  marketCount:number
  historicalCount:number
  narrativeCount:number
  untestedNarrativeIds:readonly string[]
  informationCutoff:string
  authority:'INTELLIGENCE_ONLY'
  bettingAuthority:'NONE'
  financialAuthority:'NONE'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}
const iso=(v:string,c:string)=>{nonEmpty(v,c);if(Number.isNaN(Date.parse(v)))throw new Error(c)}
const unique=<T extends string>(xs:readonly T[])=>Object.freeze([...new Set(xs)].sort()) as readonly T[]

export function assertSportsHandicapEvidence(e:SportsHandicapEvidence):void{
  nonEmpty(e.evidenceId,'MONEY_SPORTS_FEATURE_EVIDENCE_ID_REQUIRED')
  nonEmpty(e.eventId,'MONEY_SPORTS_FEATURE_EVENT_REQUIRED')
  nonEmpty(e.subjectId,'MONEY_SPORTS_FEATURE_SUBJECT_REQUIRED')
  nonEmpty(e.sourceType,'MONEY_SPORTS_FEATURE_SOURCE_REQUIRED')
  iso(e.observedAt,'MONEY_SPORTS_FEATURE_OBSERVED_AT_INVALID')
  iso(e.informationCutoff,'MONEY_SPORTS_FEATURE_CUTOFF_INVALID')
  if(Date.parse(e.observedAt)>Date.parse(e.informationCutoff))throw new Error('MONEY_SPORTS_FEATURE_AFTER_CUTOFF')
  if(typeof e.value==='number'&&!Number.isFinite(e.value))throw new Error('MONEY_SPORTS_FEATURE_VALUE_INVALID')
  if(e.sampleSize!==undefined&&(!Number.isInteger(e.sampleSize)||e.sampleSize<0))throw new Error('MONEY_SPORTS_FEATURE_SAMPLE_INVALID')
  if(e.authority!=='INTELLIGENCE_ONLY'||e.canExecute!==false)throw new Error('MONEY_SPORTS_FEATURE_AUTHORITY_INVALID')
  if(e.evidenceClass==='NARRATIVE'&&e.causalStatus!=='UNTESTED_NARRATIVE')throw new Error('MONEY_SPORTS_NARRATIVE_CAUSALITY_OVERCLAIM')
  if(e.featureKind==='NARRATIVE_MOTIVATION'&&e.evidenceClass!=='NARRATIVE')throw new Error('MONEY_SPORTS_NARRATIVE_CLASS_REQUIRED')
  if(e.featureKind==='MARKET_MOVE'||e.featureKind==='PUBLIC_OR_SHARP_FLOW'){
    if(e.evidenceClass!=='MARKET')throw new Error('MONEY_SPORTS_MARKET_EVIDENCE_CLASS_REQUIRED')
  }
}

export function buildSportsHandicapEvidenceSet(input:{
  eventId:string
  evidence:readonly SportsHandicapEvidence[]
  informationCutoff:string
}):SportsHandicapEvidenceSet{
  nonEmpty(input.eventId,'MONEY_SPORTS_FEATURE_SET_EVENT_REQUIRED')
  iso(input.informationCutoff,'MONEY_SPORTS_FEATURE_SET_CUTOFF_INVALID')
  if(!input.evidence.length)throw new Error('MONEY_SPORTS_FEATURE_SET_EMPTY')
  const ids=new Set<string>()
  for(const e of input.evidence){
    assertSportsHandicapEvidence(e)
    if(e.eventId!==input.eventId)throw new Error('MONEY_SPORTS_FEATURE_SET_EVENT_MISMATCH')
    if(Date.parse(e.informationCutoff)>Date.parse(input.informationCutoff))throw new Error('MONEY_SPORTS_FEATURE_SET_FUTURE_INFORMATION')
    if(ids.has(e.evidenceId))throw new Error('MONEY_SPORTS_FEATURE_SET_DUPLICATE_EVIDENCE')
    ids.add(e.evidenceId)
  }
  const count=(c:SportsEvidenceClass)=>input.evidence.filter(e=>e.evidenceClass===c).length
  const narrativeIds=unique(input.evidence.filter(e=>e.causalStatus==='UNTESTED_NARRATIVE').map(e=>e.evidenceId))
  return Object.freeze({
    evidenceSetId:'sports-handicap:'+hash({eventId:input.eventId,evidence:[...ids].sort(),informationCutoff:input.informationCutoff}),
    eventId:input.eventId,
    evidence:Object.freeze([...input.evidence]),
    measuredCount:count('MEASURED'),
    reportedCount:count('REPORTED'),
    marketCount:count('MARKET'),
    historicalCount:count('HISTORICAL'),
    narrativeCount:count('NARRATIVE'),
    untestedNarrativeIds:narrativeIds,
    informationCutoff:input.informationCutoff,
    authority:'INTELLIGENCE_ONLY',
    bettingAuthority:'NONE',
    financialAuthority:'NONE',
    canExecute:false,
  })
}
