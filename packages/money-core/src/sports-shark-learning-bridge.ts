import {createHash} from 'node:crypto'
import type {StrategyCalibration} from './autonomous-strategy-learning.js'
import type {AlphaEvidence} from './cross-domain-alpha-router.js'
import type {SportsLearningEpisode} from './sports-learning-memory.js'
import type {SportsForwardShadowPrediction} from './sports-prediction-forward-shadow.js'

export type SportsThesisDisposition='SUPPORTED'|'MIXED'|'INVALIDATED'|'NON_DECISION'

export type SportsThesisLearningRecord=Readonly<{
  thesisId:string
  episodeId:string
  predictionId:string
  eventId:string
  strategyId:string
  thesis:string
  entryEdgeBps:number
  returnBps:number
  closingLineValueBps:number|null
  processClass:SportsLearningEpisode['processClass']
  disposition:SportsThesisDisposition
  strengthBps:number
  confidenceBps:number
  reasonCodes:readonly string[]
  evidenceIds:readonly string[]
  reviewedAt:string
  authority:'SPORTS_THESIS_MEMORY'
  canAuthorizeLive:false
  canExecute:false
}>

export type SportsReusableLearningSignal=Readonly<{
  signalId:string
  thesis:SportsThesisLearningRecord
  alpha:AlphaEvidence
  reusableFor:['SPORTS_BETTING','PREDICTION_MARKET']
  targetTruthClaim:false
  authority:'CROSS_DOMAIN_EVIDENCE_ONLY'
  canAuthorizeLive:false
  canExecute:false
}>

const hash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const clamp=(value:number,min:number,max:number):number=>Math.max(min,Math.min(max,value))
const unique=(values:readonly string[]):readonly string[]=>Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))].sort())

export function buildSportsThesisLearningRecord(input:{
  prediction:SportsForwardShadowPrediction
  episode:SportsLearningEpisode
  calibration:StrategyCalibration
}):SportsThesisLearningRecord{
  if(input.episode.predictionId!==input.prediction.predictionId)throw new Error('SPORT_AUTO_SHARK_EPISODE_PREDICTION_MISMATCH')
  if(input.calibration.domain!=='SPORTS_BETTING'||input.calibration.strategyId!==input.episode.strategyId)throw new Error('SPORT_AUTO_SHARK_CALIBRATION_MISMATCH')
  if(input.calibration.authority!=='LEARNING_ONLY'||input.calibration.canAuthorizeLive!==false)throw new Error('SPORT_AUTO_SHARK_CALIBRATION_AUTHORITY_INVALID')
  const clvBps=input.episode.closingLineValue===null?null:Math.round(input.episode.closingLineValue*10000)
  let disposition:SportsThesisDisposition='MIXED'
  if(input.episode.processClass==='NON_DECISION_RESULT')disposition='NON_DECISION'
  else if(input.episode.processClass.startsWith('GOOD_PROCESS'))disposition=input.episode.returnBps>=0?'SUPPORTED':'MIXED'
  else disposition='INVALIDATED'
  const reasons:string[]=[]
  reasons.push('ENTRY_EDGE_BPS:'+input.prediction.edgeAtEntryBps)
  reasons.push('PROCESS:'+input.episode.processClass)
  reasons.push('OUTCOME_RETURN_BPS:'+input.episode.returnBps)
  if(clvBps!==null)reasons.push('CLV_BPS:'+clvBps)
  if(disposition==='INVALIDATED')reasons.push('THESIS_REQUIRES_REVISION')
  if(disposition==='SUPPORTED')reasons.push('THESIS_SUPPORTED_BY_PROCESS_AND_OUTCOME')
  const strengthBps=clamp(Math.abs(input.prediction.edgeAtEntryBps)*4,0,10000)
  const confidenceBps=clamp(Math.round(input.calibration.evidenceStrength*10000),0,10000)
  const evidenceIds=unique([...input.episode.evidenceIds,...input.calibration.learningRecordIds])
  return Object.freeze({
    thesisId:'sports-thesis:'+hash({episodeId:input.episode.episodeId,calibrationId:input.calibration.calibrationId}),
    episodeId:input.episode.episodeId,
    predictionId:input.prediction.predictionId,
    eventId:input.prediction.eventId,
    strategyId:input.episode.strategyId,
    thesis:'Model '+input.prediction.envelope.model.modelId+' identified '+input.prediction.marketFamily+' edge on '+input.prediction.selectionOutcomeId,
    entryEdgeBps:input.prediction.edgeAtEntryBps,
    returnBps:input.episode.returnBps,
    closingLineValueBps:clvBps,
    processClass:input.episode.processClass,
    disposition,
    strengthBps,
    confidenceBps,
    reasonCodes:unique(reasons),
    evidenceIds,
    reviewedAt:input.episode.resolvedAt,
    authority:'SPORTS_THESIS_MEMORY',
    canAuthorizeLive:false,
    canExecute:false,
  })
}

export function projectSportsThesisToReusableAlpha(input:{
  thesis:SportsThesisLearningRecord
  availableAt:string
  expiresAt:string
}):SportsReusableLearningSignal{
  if(input.thesis.authority!=='SPORTS_THESIS_MEMORY'||input.thesis.canAuthorizeLive!==false||input.thesis.canExecute!==false)throw new Error('SPORT_AUTO_SHARK_THESIS_AUTHORITY_INVALID')
  if(Number.isNaN(Date.parse(input.availableAt))||Number.isNaN(Date.parse(input.expiresAt))||input.expiresAt<=input.availableAt)throw new Error('SPORT_AUTO_SHARK_ALPHA_TIME_INVALID')
  const evidenceIds=unique(input.thesis.evidenceIds)
  const alpha:AlphaEvidence=Object.freeze({
    alphaId:'sports-alpha:'+hash({thesisId:input.thesis.thesisId,availableAt:input.availableAt}),
    sourceDomain:'SPORTS_BETTING',
    sourceSubjectId:input.thesis.eventId,
    sourceInstrumentId:'sports:'+input.thesis.eventId+':'+input.thesis.predictionId,
    featureKind:'MODEL_DISAGREEMENT',
    direction:'MIXED',
    strengthBps:input.thesis.strengthBps,
    confidenceBps:input.thesis.confidenceBps,
    thesis:input.thesis.thesis,
    observedAt:input.thesis.reviewedAt,
    availableAt:input.availableAt,
    expiresAt:input.expiresAt,
    evidenceIds,
    authority:'INTELLIGENCE_ONLY',
    canExecute:false,
  })
  return Object.freeze({
    signalId:'sports-reusable-signal:'+hash({alphaId:alpha.alphaId,thesisId:input.thesis.thesisId}),
    thesis:input.thesis,
    alpha,
    reusableFor:Object.freeze(['SPORTS_BETTING','PREDICTION_MARKET'] as const),
    targetTruthClaim:false,
    authority:'CROSS_DOMAIN_EVIDENCE_ONLY',
    canAuthorizeLive:false,
    canExecute:false,
  })
}
