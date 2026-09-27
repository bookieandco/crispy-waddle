import { createHash } from 'node:crypto'

export type SportsEventStatus='SCHEDULED'|'LIVE'|'FINAL'|'CANCELLED'|'POSTPONED'
export type SportsParticipantRole='HOME'|'AWAY'|'PLAYER_A'|'PLAYER_B'|'TEAM'|'ATHLETE'
export type SportsRealityObservationKind=
  |'SCHEDULE'|'SCORE'|'CLOCK'|'LINEUP'|'AVAILABILITY'|'INJURY'|'WEATHER'
  |'VENUE'|'RESULT'|'PLAYER_ROLE'|'TEAM_STATE'|'OTHER'

export type SportsParticipant=Readonly<{
  participantId:string
  label:string
  role:SportsParticipantRole
}>

export type SportsRealityObservation=Readonly<{
  observationId:string
  eventId:string
  subjectId:string
  kind:SportsRealityObservationKind
  value:string|number|boolean
  unit?:string
  observedAt:string
  availableAt:string
  sourceType:string
  sourceLocator?:string
  evidenceIds:readonly string[]
  authority:'EVIDENCE_ONLY'
  canExecute:false
}>

export type SportsRealitySnapshot=Readonly<{
  snapshotId:string
  eventId:string
  sport:string
  competitionId:string
  status:SportsEventStatus
  scheduledStartAt:string
  participants:readonly SportsParticipant[]
  observations:readonly SportsRealityObservation[]
  excludedFutureObservationIds:readonly string[]
  informationCutoff:string
  snapshotHash:string
  authority:'REALITY_EVIDENCE_ONLY'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}
const instant=(v:string,c:string)=>{nonEmpty(v,c);const n=Date.parse(v);if(Number.isNaN(n))throw new Error(c);return n}
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function assertSportsRealityObservation(o:SportsRealityObservation):void{
  nonEmpty(o.observationId,'SPORT_PRED_REALITY_OBSERVATION_ID_REQUIRED')
  nonEmpty(o.eventId,'SPORT_PRED_REALITY_EVENT_REQUIRED')
  nonEmpty(o.subjectId,'SPORT_PRED_REALITY_SUBJECT_REQUIRED')
  nonEmpty(o.sourceType,'SPORT_PRED_REALITY_SOURCE_REQUIRED')
  const observed=instant(o.observedAt,'SPORT_PRED_REALITY_OBSERVED_AT_INVALID')
  const available=instant(o.availableAt,'SPORT_PRED_REALITY_AVAILABLE_AT_INVALID')
  if(available<observed)throw new Error('SPORT_PRED_REALITY_AVAILABLE_BEFORE_OBSERVED')
  if(!o.evidenceIds.length)throw new Error('SPORT_PRED_REALITY_EVIDENCE_REQUIRED')
  if(o.authority!=='EVIDENCE_ONLY'||o.canExecute!==false)throw new Error('SPORT_PRED_REALITY_AUTHORITY_INVALID')
}

export function buildSportsRealitySnapshot(input:{
  eventId:string
  sport:string
  competitionId:string
  status:SportsEventStatus
  scheduledStartAt:string
  participants:readonly SportsParticipant[]
  observations:readonly SportsRealityObservation[]
  informationCutoff:string
}):SportsRealitySnapshot{
  nonEmpty(input.eventId,'SPORT_PRED_REALITY_EVENT_REQUIRED')
  nonEmpty(input.sport,'SPORT_PRED_REALITY_SPORT_REQUIRED')
  nonEmpty(input.competitionId,'SPORT_PRED_REALITY_COMPETITION_REQUIRED')
  instant(input.scheduledStartAt,'SPORT_PRED_REALITY_START_INVALID')
  const cutoff=instant(input.informationCutoff,'SPORT_PRED_REALITY_CUTOFF_INVALID')
  if(input.participants.length<2)throw new Error('SPORT_PRED_REALITY_PARTICIPANTS_INSUFFICIENT')
  const participantIds=new Set<string>()
  for(const p of input.participants){
    nonEmpty(p.participantId,'SPORT_PRED_REALITY_PARTICIPANT_ID_REQUIRED')
    nonEmpty(p.label,'SPORT_PRED_REALITY_PARTICIPANT_LABEL_REQUIRED')
    if(participantIds.has(p.participantId))throw new Error('SPORT_PRED_REALITY_DUPLICATE_PARTICIPANT')
    participantIds.add(p.participantId)
  }

  const observationIds=new Set<string>()
  for(const o of input.observations){
    assertSportsRealityObservation(o)
    if(o.eventId!==input.eventId)throw new Error('SPORT_PRED_REALITY_EVENT_MISMATCH')
    if(observationIds.has(o.observationId))throw new Error('SPORT_PRED_REALITY_DUPLICATE_OBSERVATION')
    observationIds.add(o.observationId)
  }

  const included=input.observations.filter(o=>Date.parse(o.availableAt)<=cutoff)
  const excluded=input.observations.filter(o=>Date.parse(o.availableAt)>cutoff)
  if(!included.length)throw new Error('SPORT_PRED_REALITY_NO_AS_OF_EVIDENCE')
  if(input.status==='FINAL'&&!included.some(o=>o.kind==='RESULT'))throw new Error('SPORT_PRED_REALITY_FINAL_RESULT_REQUIRED')

  const payload={
    eventId:input.eventId,
    sport:input.sport,
    competitionId:input.competitionId,
    status:input.status,
    scheduledStartAt:input.scheduledStartAt,
    participants:input.participants.map(p=>[p.participantId,p.role]),
    observations:included.map(o=>o.observationId).sort(),
    cutoff:input.informationCutoff,
  }
  const snapshotHash=hash(payload)
  return Object.freeze({
    snapshotId:'sport-reality:'+snapshotHash,
    eventId:input.eventId,
    sport:input.sport,
    competitionId:input.competitionId,
    status:input.status,
    scheduledStartAt:input.scheduledStartAt,
    participants:Object.freeze(input.participants.map(p=>Object.freeze({...p}))),
    observations:Object.freeze(included.map(o=>Object.freeze({...o,evidenceIds:unique(o.evidenceIds)}))),
    excludedFutureObservationIds:unique(excluded.map(o=>o.observationId)),
    informationCutoff:input.informationCutoff,
    snapshotHash,
    authority:'REALITY_EVIDENCE_ONLY',
    canExecute:false,
  })
}
