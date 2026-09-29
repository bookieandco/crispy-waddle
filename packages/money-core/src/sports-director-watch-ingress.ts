import {createHash} from 'node:crypto'
import type {SportsRealityObservation,SportsRealityObservationKind} from './sports-prediction-reality.js'

export const EXPECTED_DIRECTOR_SPORTS_WATCH_SCHEMA_VERSION='director-sports-watch.v1' as const

export type DirectorSportsWatchKind=
  |'FORMATION'
  |'MATCHUP'
  |'TEMPO'
  |'FATIGUE'
  |'MOMENTUM'
  |'TACTICAL_ADJUSTMENT'
  |'PLAYER_ROLE'
  |'SUBSTITUTION'
  |'POSSESSION_CANDIDATE'
  |'SCORE_CANDIDATE'
  |'CLOCK_CANDIDATE'
  |'OTHER'

export type DirectorSportsWatchIngressEnvelope=Readonly<{
  schemaVersion:typeof EXPECTED_DIRECTOR_SPORTS_WATCH_SCHEMA_VERSION
  observationId:string
  eventId:string
  subjectId:string
  frameId:string
  kind:DirectorSportsWatchKind
  value:string|number|boolean
  confidence:number
  observedAt:string
  availableAt:string
  sourceLocator:string
  evidenceIds:readonly string[]
  rightsVerified:true
  sourceAuthorized:true
  requiresOfficialReconciliation:boolean
  authority:'DIRECTOR_INFERENCE_ONLY'
  canEstablishOfficialScore:false
  canAuthorizeBet:false
  canExecute:false
}>

export type SportsDirectorPerceptionUpdate=Readonly<{
  perceptionId:string
  eventId:string
  frameId:string
  kind:DirectorSportsWatchKind
  observation:SportsRealityObservation
  requiresOfficialReconciliation:boolean
  canonicalRealityEligible:false
  authority:'INFERRED_CONTEXT_ONLY'
  canAuthorizeBet:false
  canExecute:false
}>

const hash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const instant=(value:string,code:string):number=>{const parsed=Date.parse(value);if(Number.isNaN(parsed))throw new Error(code);return parsed}
const unique=(values:readonly string[]):readonly string[]=>Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))].sort())

function realityKind(kind:DirectorSportsWatchKind):SportsRealityObservationKind{
  if(kind==='SCORE_CANDIDATE')return'SCORE'
  if(kind==='CLOCK_CANDIDATE')return'CLOCK'
  if(kind==='PLAYER_ROLE')return'PLAYER_ROLE'
  if(kind==='SUBSTITUTION')return'AVAILABILITY'
  if(kind==='POSSESSION_CANDIDATE'||kind==='FORMATION'||kind==='MATCHUP'||kind==='TEMPO'||kind==='FATIGUE'||kind==='MOMENTUM'||kind==='TACTICAL_ADJUSTMENT')return'TEAM_STATE'
  return'OTHER'
}

export function ingestDirectorSportsWatchObservation(input:DirectorSportsWatchIngressEnvelope):SportsDirectorPerceptionUpdate{
  if(input.schemaVersion!==EXPECTED_DIRECTOR_SPORTS_WATCH_SCHEMA_VERSION)throw new Error('SPORT_AUTO_DIRECTOR_SCHEMA_UNSUPPORTED')
  if(input.authority!=='DIRECTOR_INFERENCE_ONLY'||input.canExecute!==false||input.canAuthorizeBet!==false||input.canEstablishOfficialScore!==false)throw new Error('SPORT_AUTO_DIRECTOR_AUTHORITY_INVALID')
  if(input.rightsVerified!==true||input.sourceAuthorized!==true)throw new Error('SPORT_AUTO_DIRECTOR_SOURCE_RIGHTS_INVALID')
  if(!input.observationId.trim()||!input.eventId.trim()||!input.subjectId.trim()||!input.frameId.trim()||!input.sourceLocator.trim())throw new Error('SPORT_AUTO_DIRECTOR_IDENTITY_REQUIRED')
  const observedAt=instant(input.observedAt,'SPORT_AUTO_DIRECTOR_OBSERVED_AT_INVALID')
  const availableAt=instant(input.availableAt,'SPORT_AUTO_DIRECTOR_AVAILABLE_AT_INVALID')
  if(availableAt<observedAt)throw new Error('SPORT_AUTO_DIRECTOR_AVAILABLE_BEFORE_OBSERVED')
  if(!Number.isFinite(input.confidence)||input.confidence<0||input.confidence>1)throw new Error('SPORT_AUTO_DIRECTOR_CONFIDENCE_INVALID')
  const evidenceIds=unique(input.evidenceIds)
  if(!evidenceIds.length)throw new Error('SPORT_AUTO_DIRECTOR_EVIDENCE_REQUIRED')
  const critical=input.kind==='SCORE_CANDIDATE'||input.kind==='CLOCK_CANDIDATE'||input.kind==='POSSESSION_CANDIDATE'||input.kind==='SUBSTITUTION'
  if(critical&&input.requiresOfficialReconciliation!==true)throw new Error('SPORT_AUTO_DIRECTOR_OFFICIAL_RECONCILIATION_REQUIRED')
  const observation:SportsRealityObservation=Object.freeze({
    observationId:'sports-director:'+hash({source:input.observationId,frame:input.frameId}),
    eventId:input.eventId,
    subjectId:input.subjectId,
    kind:realityKind(input.kind),
    value:input.value,
    observedAt:input.observedAt,
    availableAt:input.availableAt,
    sourceType:'DIRECTOR_INFERRED:'+input.kind,
    sourceLocator:input.sourceLocator,
    evidenceIds,
    evidenceClass:'DIRECTOR_INFERRED',
    confidence:input.confidence,
    authority:'EVIDENCE_ONLY',
    canExecute:false,
  })
  return Object.freeze({
    perceptionId:'sports-director-perception:'+hash({observation:observation.observationId,kind:input.kind}),
    eventId:input.eventId,
    frameId:input.frameId,
    kind:input.kind,
    observation,
    requiresOfficialReconciliation:input.requiresOfficialReconciliation,
    canonicalRealityEligible:false,
    authority:'INFERRED_CONTEXT_ONLY',
    canAuthorizeBet:false,
    canExecute:false,
  })
}
