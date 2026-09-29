export const DIRECTOR_SPORTS_WATCH_SCHEMA_VERSION='director-sports-watch.v1' as const

export type DirectorSportsObservationKind=
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

export type DirectorSportsWatchEnvelope=Readonly<{
  schemaVersion:typeof DIRECTOR_SPORTS_WATCH_SCHEMA_VERSION
  observationId:string
  eventId:string
  subjectId:string
  frameId:string
  kind:DirectorSportsObservationKind
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

const nonEmpty=(value:string,code:string):void=>{if(!value.trim())throw new Error(code)}
const instant=(value:string,code:string):number=>{nonEmpty(value,code);const parsed=Date.parse(value);if(Number.isNaN(parsed))throw new Error(code);return parsed}
const unique=(values:readonly string[]):readonly string[]=>
  Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))].sort())

const OFFICIAL_RECONCILIATION_KINDS:ReadonlySet<DirectorSportsObservationKind>=new Set([
  'POSSESSION_CANDIDATE','SCORE_CANDIDATE','CLOCK_CANDIDATE','SUBSTITUTION',
])

export function createDirectorSportsWatchEnvelope(input:{
  observationId:string
  eventId:string
  subjectId:string
  frameId:string
  kind:DirectorSportsObservationKind
  value:string|number|boolean
  confidence:number
  observedAt:string
  availableAt:string
  sourceLocator:string
  evidenceIds:readonly string[]
  rightsVerified:boolean
  sourceAuthorized:boolean
}):DirectorSportsWatchEnvelope{
  nonEmpty(input.observationId,'DIRECTOR_SPORTS_OBSERVATION_ID_REQUIRED')
  nonEmpty(input.eventId,'DIRECTOR_SPORTS_EVENT_ID_REQUIRED')
  nonEmpty(input.subjectId,'DIRECTOR_SPORTS_SUBJECT_ID_REQUIRED')
  nonEmpty(input.frameId,'DIRECTOR_SPORTS_FRAME_ID_REQUIRED')
  nonEmpty(input.sourceLocator,'DIRECTOR_SPORTS_SOURCE_LOCATOR_REQUIRED')
  const observedAt=instant(input.observedAt,'DIRECTOR_SPORTS_OBSERVED_AT_INVALID')
  const availableAt=instant(input.availableAt,'DIRECTOR_SPORTS_AVAILABLE_AT_INVALID')
  if(availableAt<observedAt)throw new Error('DIRECTOR_SPORTS_AVAILABLE_BEFORE_OBSERVED')
  if(!Number.isFinite(input.confidence)||input.confidence<0||input.confidence>1)throw new Error('DIRECTOR_SPORTS_CONFIDENCE_INVALID')
  if(input.rightsVerified!==true)throw new Error('DIRECTOR_SPORTS_RIGHTS_NOT_VERIFIED')
  if(input.sourceAuthorized!==true)throw new Error('DIRECTOR_SPORTS_SOURCE_NOT_AUTHORIZED')
  const evidenceIds=unique(input.evidenceIds)
  if(!evidenceIds.length)throw new Error('DIRECTOR_SPORTS_EVIDENCE_REQUIRED')
  return Object.freeze({
    schemaVersion:DIRECTOR_SPORTS_WATCH_SCHEMA_VERSION,
    observationId:input.observationId,
    eventId:input.eventId,
    subjectId:input.subjectId,
    frameId:input.frameId,
    kind:input.kind,
    value:input.value,
    confidence:input.confidence,
    observedAt:input.observedAt,
    availableAt:input.availableAt,
    sourceLocator:input.sourceLocator,
    evidenceIds,
    rightsVerified:true,
    sourceAuthorized:true,
    requiresOfficialReconciliation:OFFICIAL_RECONCILIATION_KINDS.has(input.kind),
    authority:'DIRECTOR_INFERENCE_ONLY',
    canEstablishOfficialScore:false,
    canAuthorizeBet:false,
    canExecute:false,
  })
}
