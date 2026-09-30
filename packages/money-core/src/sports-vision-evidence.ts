import { createHash } from 'node:crypto'
import type { SportsPredictionFeature } from './sports-prediction-features.js'

export type SportsVisualInferenceObservation=Readonly<{
  observationId:string
  eventId:string
  frameAssetId:string
  provider:'roboflow-serverless'
  workflowId:string
  observedAt:string
  availableAt:string
  classScores:Readonly<Record<string,number>>
  evidenceIds:readonly string[]
  authority:'INFERRED_VISUAL_EVIDENCE_ONLY'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

export function assertSportsVisualInferenceObservation(o:SportsVisualInferenceObservation):void{
  if(!o.observationId.trim()||!o.eventId.trim()||!o.frameAssetId.trim()||!o.workflowId.trim())throw new Error('SPORT_SIM_VISION_IDENTITY_REQUIRED')
  if(Number.isNaN(Date.parse(o.observedAt))||Number.isNaN(Date.parse(o.availableAt))||o.availableAt<o.observedAt)throw new Error('SPORT_SIM_VISION_TIME_INVALID')
  if(!o.evidenceIds.length)throw new Error('SPORT_SIM_VISION_EVIDENCE_REQUIRED')
  for(const score of Object.values(o.classScores))if(!Number.isFinite(score)||score<0||score>1)throw new Error('SPORT_SIM_VISION_SCORE_INVALID')
  if(o.authority!=='INFERRED_VISUAL_EVIDENCE_ONLY'||o.canExecute!==false)throw new Error('SPORT_SIM_VISION_AUTHORITY_INVALID')
}

export function createSportsVisualInferenceObservation(input:Omit<SportsVisualInferenceObservation,'observationId'|'authority'|'canExecute'>):SportsVisualInferenceObservation{
  const observationId='sport-vision:'+hash({eventId:input.eventId,frameAssetId:input.frameAssetId,provider:input.provider,workflowId:input.workflowId,observedAt:input.observedAt,classScores:input.classScores})
  const result=Object.freeze({...input,observationId,evidenceIds:unique(input.evidenceIds),authority:'INFERRED_VISUAL_EVIDENCE_ONLY' as const,canExecute:false as const})
  assertSportsVisualInferenceObservation(result)
  return result
}

export function sportsVisualObservationToContextFeature(input:{
  observation:SportsVisualInferenceObservation
  featureId:string
  subjectId:string
  featureValue:number
  normalizedValue:number
  methodologyVersion:string
  evidenceIds:readonly string[]
}):SportsPredictionFeature{
  assertSportsVisualInferenceObservation(input.observation)
  if(!input.featureId.trim()||!input.subjectId.trim()||!input.methodologyVersion.trim()||!input.evidenceIds.length)throw new Error('SPORT_SIM_VISION_FEATURE_LINEAGE_REQUIRED')
  if(!Number.isFinite(input.featureValue)||!Number.isFinite(input.normalizedValue)||input.normalizedValue<-1||input.normalizedValue>1)throw new Error('SPORT_SIM_VISION_FEATURE_VALUE_INVALID')
  return Object.freeze({
    featureId:input.featureId,
    eventId:input.observation.eventId,
    subjectId:input.subjectId,
    family:'OTHER',
    evidenceClass:'DERIVED',
    inputRole:'CONTEXT_ONLY',
    value:input.featureValue,
    normalizedValue:input.normalizedValue,
    observedAt:input.observation.observedAt,
    availableAt:input.observation.availableAt,
    methodologyVersion:input.methodologyVersion,
    sourceObservationIds:Object.freeze([input.observation.observationId]),
    evidenceIds:unique([...input.observation.evidenceIds,...input.evidenceIds]),
    authority:'FEATURE_EVIDENCE_ONLY',
    canExecute:false,
  })
}
