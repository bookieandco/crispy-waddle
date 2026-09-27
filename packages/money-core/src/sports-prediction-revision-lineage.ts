import { createHash } from 'node:crypto'
import type { SportsPredictionTransportEnvelope } from './sports-intelligence-ingress.js'

export type SportsPredictionRevisionReason=
  |'LINEUP_CONFIRMED'
  |'LINEUP_ROTATION'
  |'INJURY_UPDATE'
  |'ROLE_CHANGE'
  |'SET_PIECE_CHANGE'
  |'WEATHER_UPDATE'
  |'MARKET_MOVE'
  |'GAME_STATE_UPDATE'
  |'OTHER'

export type SportsPredictionRevision=Readonly<{
  revisionId:string
  eventId:string
  sport:string
  previousEnvelopeId:string
  nextEnvelopeId:string
  previousInformationCutoff:string
  nextInformationCutoff:string
  previousIssuedAt:string
  nextIssuedAt:string
  modelId:string
  modelVersion:string
  reasonCodes:readonly SportsPredictionRevisionReason[]
  changedEvidenceIds:readonly string[]
  previousEnvelopeRetained:true
  authority:'LINEAGE_ONLY'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=<T extends string>(xs:readonly T[])=>Object.freeze([...new Set(xs)].sort()) as readonly T[]

export function createSportsPredictionRevision(input:{
  previous:SportsPredictionTransportEnvelope
  next:SportsPredictionTransportEnvelope
  reasonCodes:readonly SportsPredictionRevisionReason[]
  changedEvidenceIds:readonly string[]
}):SportsPredictionRevision{
  const prev=input.previous,next=input.next
  const prevEvent=prev.subject.gameId??prev.subject.subjectId
  const nextEvent=next.subject.gameId??next.subject.subjectId
  if(prevEvent!==nextEvent||prev.sport!==next.sport)throw new Error('SPORT_PRED_REVISION_EVENT_MISMATCH')
  if(prev.envelopeId===next.envelopeId)throw new Error('SPORT_PRED_REVISION_REQUIRES_NEW_ENVELOPE')
  if(!input.reasonCodes.length||!input.changedEvidenceIds.length)throw new Error('SPORT_PRED_REVISION_LINEAGE_REQUIRED')
  if(Date.parse(next.informationCutoff)<=Date.parse(prev.informationCutoff))throw new Error('SPORT_PRED_REVISION_CUTOFF_NOT_ADVANCED')
  if(Date.parse(next.issuedAt)<Date.parse(next.informationCutoff))throw new Error('SPORT_PRED_REVISION_NEXT_ISSUED_BEFORE_CUTOFF')
  if(Date.parse(next.issuedAt)<=Date.parse(prev.issuedAt))throw new Error('SPORT_PRED_REVISION_ISSUANCE_NOT_ADVANCED')
  if(prev.model.modelId!==next.model.modelId||prev.model.modelVersion!==next.model.modelVersion)throw new Error('SPORT_PRED_REVISION_MODEL_MUTATION_REQUIRES_NEW_COHORT')
  return Object.freeze({
    revisionId:'sport-pred-revision:'+hash({previous:prev.envelopeId,next:next.envelopeId,reasons:[...input.reasonCodes].sort(),changed:[...input.changedEvidenceIds].sort()}),
    eventId:prevEvent,
    sport:prev.sport,
    previousEnvelopeId:prev.envelopeId,
    nextEnvelopeId:next.envelopeId,
    previousInformationCutoff:prev.informationCutoff,
    nextInformationCutoff:next.informationCutoff,
    previousIssuedAt:prev.issuedAt,
    nextIssuedAt:next.issuedAt,
    modelId:prev.model.modelId,
    modelVersion:prev.model.modelVersion,
    reasonCodes:unique(input.reasonCodes),
    changedEvidenceIds:unique(input.changedEvidenceIds),
    previousEnvelopeRetained:true,
    authority:'LINEAGE_ONLY',
    canExecute:false,
  })
}
