import { createHash } from 'node:crypto'
import type { SportsRealitySnapshot } from './sports-prediction-reality.js'

export type SportsPredictionFeatureFamily=
  |'TEAM_STRENGTH'|'PLAYER_STRENGTH'|'FORM'|'MATCHUP'|'PLAYER_ROLE'|'AVAILABILITY'
  |'PACE'|'EFFICIENCY'|'SURFACE'|'WEATHER'|'TRAVEL'|'HOME_FIELD'|'LIVE_STATE'
  |'COACHING_SCHEME'|'MARKET_CONTEXT'|'NARRATIVE_CONTEXT'
  |'COVERAGE_SHELL'|'OPPORTUNITY_SHARE'|'EXPECTED_POSSESSION'|'FORMATION_ROLE'
  |'SET_PIECE_ROLE'|'PROJECTED_MINUTES'|'SUBSTITUTION_RISK'|'GAME_SCRIPT'
  |'TAIL_EVENT_RATE'|'LINEUP_STATUS'|'OTHER'

export type SportsPredictionFeatureEvidenceClass='MEASURED'|'REPORTED'|'DERIVED'|'MARKET'|'NARRATIVE'
export type SportsPredictionFeatureInputRole='PRIMARY'|'CONTEXT_ONLY'

export type SportsPredictionFeature=Readonly<{
  featureId:string
  eventId:string
  subjectId:string
  family:SportsPredictionFeatureFamily
  evidenceClass:SportsPredictionFeatureEvidenceClass
  inputRole:SportsPredictionFeatureInputRole
  value:number
  normalizedValue:number
  observedAt:string
  availableAt:string
  methodologyVersion:string
  sourceObservationIds:readonly string[]
  evidenceIds:readonly string[]
  authority:'FEATURE_EVIDENCE_ONLY'
  canExecute:false
}>

export type SportsPredictionFeatureSnapshot=Readonly<{
  featureSnapshotId:string
  eventId:string
  sport:string
  realitySnapshotId:string
  methodologyVersion:string
  features:readonly SportsPredictionFeature[]
  excludedFutureFeatureIds:readonly string[]
  contextOnlyFeatureIds:readonly string[]
  informationCutoff:string
  featureSnapshotHash:string
  authority:'MODEL_INPUT_ONLY'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const nonEmpty=(v:string,c:string)=>{if(!v.trim())throw new Error(c)}
const instant=(v:string,c:string)=>{nonEmpty(v,c);const n=Date.parse(v);if(Number.isNaN(n))throw new Error(c);return n}
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function assertSportsPredictionFeature(f:SportsPredictionFeature):void{
  nonEmpty(f.featureId,'SPORT_PRED_FEATURE_ID_REQUIRED')
  nonEmpty(f.eventId,'SPORT_PRED_FEATURE_EVENT_REQUIRED')
  nonEmpty(f.subjectId,'SPORT_PRED_FEATURE_SUBJECT_REQUIRED')
  nonEmpty(f.methodologyVersion,'SPORT_PRED_FEATURE_METHOD_REQUIRED')
  const observed=instant(f.observedAt,'SPORT_PRED_FEATURE_OBSERVED_AT_INVALID')
  const available=instant(f.availableAt,'SPORT_PRED_FEATURE_AVAILABLE_AT_INVALID')
  if(available<observed)throw new Error('SPORT_PRED_FEATURE_AVAILABLE_BEFORE_OBSERVED')
  if(!Number.isFinite(f.value)||!Number.isFinite(f.normalizedValue))throw new Error('SPORT_PRED_FEATURE_VALUE_INVALID')
  if(f.normalizedValue<-1||f.normalizedValue>1)throw new Error('SPORT_PRED_FEATURE_NORMALIZED_VALUE_INVALID')
  if(!f.sourceObservationIds.length||!f.evidenceIds.length)throw new Error('SPORT_PRED_FEATURE_LINEAGE_REQUIRED')
  if(f.evidenceClass==='NARRATIVE'&&f.inputRole!=='CONTEXT_ONLY')throw new Error('SPORT_PRED_NARRATIVE_PRIMARY_INPUT_FORBIDDEN')
  if(f.authority!=='FEATURE_EVIDENCE_ONLY'||f.canExecute!==false)throw new Error('SPORT_PRED_FEATURE_AUTHORITY_INVALID')
}

export function buildSportsPredictionFeatureSnapshot(input:{
  reality:SportsRealitySnapshot
  features:readonly SportsPredictionFeature[]
  methodologyVersion:string
  informationCutoff:string
}):SportsPredictionFeatureSnapshot{
  if(input.reality.authority!=='REALITY_EVIDENCE_ONLY'||input.reality.canExecute!==false)throw new Error('SPORT_PRED_FEATURE_REALITY_AUTHORITY_INVALID')
  nonEmpty(input.methodologyVersion,'SPORT_PRED_FEATURE_SNAPSHOT_METHOD_REQUIRED')
  const cutoff=instant(input.informationCutoff,'SPORT_PRED_FEATURE_CUTOFF_INVALID')
  if(input.informationCutoff!==input.reality.informationCutoff)throw new Error('SPORT_PRED_FEATURE_REALITY_CUTOFF_MISMATCH')
  const realityObservationIds=new Set(input.reality.observations.map(o=>o.observationId))
  const realityObservationById=new Map(input.reality.observations.map(o=>[o.observationId,o] as const))
  const ids=new Set<string>()
  for(const f of input.features){
    assertSportsPredictionFeature(f)
    if(f.eventId!==input.reality.eventId)throw new Error('SPORT_PRED_FEATURE_EVENT_MISMATCH')
    if(ids.has(f.featureId))throw new Error('SPORT_PRED_FEATURE_DUPLICATE')
    ids.add(f.featureId)
    for(const sourceId of f.sourceObservationIds){
      if(!realityObservationIds.has(sourceId)&&Date.parse(f.availableAt)<=cutoff)throw new Error('SPORT_PRED_FEATURE_SOURCE_NOT_IN_REALITY_SNAPSHOT')
      const source=realityObservationById.get(sourceId)
      if(source?.evidenceClass==='DIRECTOR_INFERRED'&&f.inputRole!=='CONTEXT_ONLY')throw new Error('SPORT_PRED_DIRECTOR_INFERRED_PRIMARY_INPUT_FORBIDDEN')
    }
  }
  const included=input.features.filter(f=>Date.parse(f.availableAt)<=cutoff)
  const excluded=input.features.filter(f=>Date.parse(f.availableAt)>cutoff)
  if(!included.length)throw new Error('SPORT_PRED_FEATURE_NO_AS_OF_INPUTS')
  const featureSnapshotHash=hash({
    reality:input.reality.snapshotHash,
    method:input.methodologyVersion,
    cutoff:input.informationCutoff,
    features:included.map(f=>[f.featureId,f.normalizedValue,f.methodologyVersion]).sort(),
  })
  return Object.freeze({
    featureSnapshotId:'sport-features:'+featureSnapshotHash,
    eventId:input.reality.eventId,
    sport:input.reality.sport,
    realitySnapshotId:input.reality.snapshotId,
    methodologyVersion:input.methodologyVersion,
    features:Object.freeze(included.map(f=>Object.freeze({...f,sourceObservationIds:unique(f.sourceObservationIds),evidenceIds:unique(f.evidenceIds)}))),
    excludedFutureFeatureIds:unique(excluded.map(f=>f.featureId)),
    contextOnlyFeatureIds:unique(included.filter(f=>f.inputRole==='CONTEXT_ONLY').map(f=>f.featureId)),
    informationCutoff:input.informationCutoff,
    featureSnapshotHash,
    authority:'MODEL_INPUT_ONLY',
    canExecute:false,
  })
}
