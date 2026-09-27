import { createHash } from 'node:crypto'
import type { SportsPredictionTransportEnvelope } from './sports-intelligence-ingress.js'
import { assertSportsMarketQuote, sportsOddsToDecimal, sportsImpliedProbability, type SportsMarketQuote } from './sports-paper-betting.js'
import { createSportsArenaObservation, type SportsArenaObservation, type SportsArenaSourceClass } from './sports-prediction-model-arena.js'

export type SportsForwardShadowPrediction=Readonly<{
  predictionId:string
  envelope:SportsPredictionTransportEnvelope
  eventId:string
  marketFamily:string
  selectionOutcomeId:string
  quote:SportsMarketQuote
  fairProbability:number
  impliedProbability:number
  edgeAtEntryBps:number
  sourceClass:SportsArenaSourceClass
  evidenceIds:readonly string[]
  authority:'SHADOW_ONLY'
  bettingAuthority:'NONE'
  financialAuthority:'NONE'
  canExecute:false
}>

export type SportsForwardShadowResolutionStatus='WON'|'LOST'|'PUSH'|'VOID'

export type SportsForwardShadowRecord=Readonly<{
  recordId:string
  prediction:SportsForwardShadowPrediction
  status:SportsForwardShadowResolutionStatus
  actualOutcomeId:string|null
  resolvedAt:string
  closingQuote?:SportsMarketQuote
  shadowReturnBps:number
  closingLineValueBps:number|null
  arenaObservation:SportsArenaObservation|null
  evidenceIds:readonly string[]
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
}>

export type SportsForwardShadowCohort=Readonly<{
  cohortId:string
  cohortName:string
  modelId:string
  modelVersion:string
  issuanceRegistryIds:readonly string[]
  predictions:readonly SportsForwardShadowPrediction[]
  records:readonly SportsForwardShadowRecord[]
  unresolvedPredictionIds:readonly string[]
  mutationIds:readonly string[]
  startedAt:string
  closedAt:string
  sourceClass:'REAL_AS_OF'|'SYNTHETIC_TEST'|'MIXED'
  authority:'CERTIFICATION_EVIDENCE_ONLY'
  canAuthorizeLive:false
}>

export type SportsForwardShadowCertificationCriteria=Readonly<{
  minimumResolvedSamples:number
  minimumDistinctEvents:number
  minimumForwardDays:number
  maximumMeanBrierScore:number
  maximumExpectedCalibrationError:number
  minimumMeanClosingLineValueBps?:number
  minimumMeanReturnBps?:number
}>

export type SportsForwardShadowCertification=Readonly<{
  certificationId:string
  cohortId:string
  status:'SOFTWARE_ONLY'|'INSUFFICIENT_FORWARD_EVIDENCE'|'FORWARD_SHADOW_CERTIFIED'|'REJECTED'
  resolvedSamples:number
  distinctEvents:number
  forwardDays:number
  meanBrierScore:number|null
  expectedCalibrationError:number|null
  meanClosingLineValueBps:number|null
  meanReturnBps:number|null
  predictionQualityCertified:boolean
  economicEdgeCertified:boolean
  reasonCodes:readonly string[]
  evidenceIds:readonly string[]
  liveBettingEligible:false
  authority:'CERTIFICATION_ONLY'
  canExecute:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())
const mean=(xs:readonly number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:0

function ece(xs:readonly SportsArenaObservation[]):number{
  if(!xs.length)return 0
  const buckets=Array.from({length:10},()=>[] as SportsArenaObservation[])
  for(const x of xs)buckets[Math.min(9,Math.floor(x.topConfidence*10))]!.push(x)
  let total=0
  for(const b of buckets){
    if(!b.length)continue
    const confidence=mean(b.map(x=>x.topConfidence))
    const accuracy=b.filter(x=>x.topCorrect).length/b.length
    total+=b.length/xs.length*Math.abs(confidence-accuracy)
  }
  return total
}

export function createSportsForwardShadowPrediction(input:{
  envelope:SportsPredictionTransportEnvelope
  eventId:string
  marketFamily:string
  selectionOutcomeId:string
  quote:SportsMarketQuote
  sourceClass:SportsArenaSourceClass
  evidenceIds:readonly string[]
}):SportsForwardShadowPrediction{
  assertSportsMarketQuote(input.quote)
  if(!input.marketFamily.trim()||!input.evidenceIds.length)throw new Error('SPORT_PRED_SHADOW_LINEAGE_REQUIRED')
  const envelopeEvent=input.envelope.subject.gameId??input.envelope.subject.subjectId
  if(input.eventId!==envelopeEvent||input.quote.eventId!==input.eventId)throw new Error('SPORT_PRED_SHADOW_EVENT_MISMATCH')
  if(input.quote.availableAt>input.envelope.informationCutoff)throw new Error('SPORT_PRED_SHADOW_QUOTE_AFTER_CUTOFF')
  if(input.envelope.issuedAt<input.envelope.informationCutoff)throw new Error('SPORT_PRED_SHADOW_CLOCK_INVALID')
  const outcome=input.envelope.distribution.outcomes.find(o=>o.outcomeId===input.selectionOutcomeId)
  if(!outcome)throw new Error('SPORT_PRED_SHADOW_SELECTION_UNKNOWN')
  const decimal=sportsOddsToDecimal(input.quote.oddsFormat,input.quote.odds)
  const implied=sportsImpliedProbability(decimal)
  const edgeAtEntryBps=Math.round((outcome.probability-implied)*10000)
  return Object.freeze({
    predictionId:'sport-shadow-prediction:'+hash({envelope:input.envelope.envelopeId,quote:input.quote.quoteId,selection:input.selectionOutcomeId}),
    envelope:input.envelope,
    eventId:input.eventId,
    marketFamily:input.marketFamily,
    selectionOutcomeId:input.selectionOutcomeId,
    quote:input.quote,
    fairProbability:outcome.probability,
    impliedProbability:implied,
    edgeAtEntryBps,
    sourceClass:input.sourceClass,
    evidenceIds:unique([...input.quote.evidenceIds,...input.evidenceIds]),
    authority:'SHADOW_ONLY',
    bettingAuthority:'NONE',
    financialAuthority:'NONE',
    canExecute:false,
  })
}

export function resolveSportsForwardShadowPrediction(input:{
  prediction:SportsForwardShadowPrediction
  status:SportsForwardShadowResolutionStatus
  actualOutcomeId?:string
  resolvedAt:string
  closingQuote?:SportsMarketQuote
  evidenceIds:readonly string[]
}):SportsForwardShadowRecord{
  const p=input.prediction
  if(p.authority!=='SHADOW_ONLY'||p.canExecute!==false||p.bettingAuthority!=='NONE')throw new Error('SPORT_PRED_SHADOW_AUTHORITY_INVALID')
  if(Date.parse(input.resolvedAt)<=Date.parse(p.envelope.issuedAt))throw new Error('SPORT_PRED_SHADOW_RESOLUTION_NOT_AFTER_PREDICTION')
  if(!input.evidenceIds.length)throw new Error('SPORT_PRED_SHADOW_RESOLUTION_EVIDENCE_REQUIRED')
  const terminal=input.status==='WON'||input.status==='LOST'
  if(terminal&&!input.actualOutcomeId)throw new Error('SPORT_PRED_SHADOW_ACTUAL_OUTCOME_REQUIRED')
  if(!terminal&&input.actualOutcomeId)throw new Error('SPORT_PRED_SHADOW_NONTERMINAL_OUTCOME_FORBIDDEN')
  const decimal=sportsOddsToDecimal(p.quote.oddsFormat,p.quote.odds)
  const shadowReturnBps=input.status==='WON'?Math.round((decimal-1)*10000):input.status==='LOST'?-10000:0
  let closingLineValueBps:number|null=null
  if(input.closingQuote){
    assertSportsMarketQuote(input.closingQuote)
    if(input.closingQuote.eventId!==p.eventId||input.closingQuote.marketId!==p.quote.marketId||input.closingQuote.selectionId!==p.quote.selectionId)throw new Error('SPORT_PRED_SHADOW_CLOSING_QUOTE_MISMATCH')
    if(input.closingQuote.availableAt>input.resolvedAt)throw new Error('SPORT_PRED_SHADOW_CLOSING_QUOTE_AFTER_RESOLUTION')
    const closing=sportsImpliedProbability(sportsOddsToDecimal(input.closingQuote.oddsFormat,input.closingQuote.odds))
    closingLineValueBps=Math.round((closing-p.impliedProbability)*10000)
  }
  const arenaObservation=terminal?createSportsArenaObservation({
    envelope:p.envelope,
    marketFamily:p.marketFamily,
    actualOutcomeId:input.actualOutcomeId!,
    resolvedAt:input.resolvedAt,
    sourceClass:p.sourceClass,
    evidenceIds:input.evidenceIds,
    shadowReturnBps,
    closingLineValueBps:closingLineValueBps??undefined,
  }):null
  return Object.freeze({
    recordId:'sport-shadow-record:'+hash({prediction:p.predictionId,status:input.status,actual:input.actualOutcomeId??null,resolvedAt:input.resolvedAt}),
    prediction:p,
    status:input.status,
    actualOutcomeId:input.actualOutcomeId??null,
    resolvedAt:input.resolvedAt,
    closingQuote:input.closingQuote,
    shadowReturnBps,
    closingLineValueBps,
    arenaObservation,
    evidenceIds:unique([...p.evidenceIds,...input.evidenceIds,...(input.closingQuote?.evidenceIds??[])]),
    authority:'LEARNING_ONLY',
    canAuthorizeLive:false,
  })
}

export function buildSportsForwardShadowCohort(input:{
  cohortName:string
  issuedPredictionIds:readonly string[]
  predictions:readonly SportsForwardShadowPrediction[]
  records:readonly SportsForwardShadowRecord[]
  mutationIds?:readonly string[]
  closedAt:string
}):SportsForwardShadowCohort{
  if(!input.cohortName.trim()||!input.predictions.length)throw new Error('SPORT_PRED_SHADOW_COHORT_REQUIRED')
  const registryIds=unique(input.issuedPredictionIds)
  if(registryIds.length!==input.issuedPredictionIds.length)throw new Error('SPORT_PRED_SHADOW_DUPLICATE_ISSUANCE_REGISTRY_ID')
  const predictionIds=new Set<string>()
  for(const p of input.predictions){
    if(predictionIds.has(p.predictionId))throw new Error('SPORT_PRED_SHADOW_DUPLICATE_PREDICTION')
    predictionIds.add(p.predictionId)
  }
  if(registryIds.length!==predictionIds.size||registryIds.some(id=>!predictionIds.has(id)))throw new Error('SPORT_PRED_SHADOW_SURVIVORSHIP_FILTER_DETECTED')
  const recordPredictions=new Set<string>()
  for(const r of input.records){
    if(!predictionIds.has(r.prediction.predictionId))throw new Error('SPORT_PRED_SHADOW_RECORD_NOT_IN_COHORT')
    if(recordPredictions.has(r.prediction.predictionId))throw new Error('SPORT_PRED_SHADOW_DUPLICATE_RESOLUTION')
    recordPredictions.add(r.prediction.predictionId)
  }
  const modelKeys=unique(input.predictions.map(p=>p.envelope.model.modelId+'@'+p.envelope.model.modelVersion))
  if(modelKeys.length!==1)throw new Error('SPORT_PRED_SHADOW_MODEL_VERSION_MUTATED_DURING_COHORT')
  const modelId=input.predictions[0]!.envelope.model.modelId
  const modelVersion=input.predictions[0]!.envelope.model.modelVersion
  const unresolved=unique(input.predictions.filter(p=>!recordPredictions.has(p.predictionId)).map(p=>p.predictionId))
  const classes=unique(input.predictions.map(p=>p.sourceClass))
  const sourceClass:SportsForwardShadowCohort['sourceClass']=classes.length===1?(classes[0] as SportsArenaSourceClass):'MIXED'
  const startedAt=[...input.predictions].sort((a,b)=>a.envelope.issuedAt.localeCompare(b.envelope.issuedAt))[0]!.envelope.issuedAt
  if(Date.parse(input.closedAt)<Date.parse(startedAt))throw new Error('SPORT_PRED_SHADOW_COHORT_CLOCK_INVALID')
  const mutationIds=unique(input.mutationIds??[])
  const cohortId='sport-shadow-cohort:'+hash({
    name:input.cohortName,
    issuanceRegistryIds:registryIds,
    predictions:[...predictionIds].sort(),
    records:input.records.map(r=>r.recordId).sort(),
    mutations:mutationIds,
    closedAt:input.closedAt,
  })
  return Object.freeze({
    cohortId,
    cohortName:input.cohortName,
    modelId,
    modelVersion,
    issuanceRegistryIds:registryIds,
    predictions:Object.freeze([...input.predictions]),
    records:Object.freeze([...input.records]),
    unresolvedPredictionIds:unresolved,
    mutationIds,
    startedAt,
    closedAt:input.closedAt,
    sourceClass,
    authority:'CERTIFICATION_EVIDENCE_ONLY',
    canAuthorizeLive:false,
  })
}

export function certifySportsForwardShadow(input:{
  cohort:SportsForwardShadowCohort
  criteria:SportsForwardShadowCertificationCriteria
}):SportsForwardShadowCertification{
  const c=input.criteria
  if(c.minimumResolvedSamples<2||c.minimumDistinctEvents<2||c.minimumForwardDays<1)throw new Error('SPORT_PRED_SHADOW_CERT_CRITERIA_INVALID')
  if(c.maximumMeanBrierScore<0||c.maximumMeanBrierScore>1||c.maximumExpectedCalibrationError<0||c.maximumExpectedCalibrationError>1)throw new Error('SPORT_PRED_SHADOW_CERT_THRESHOLD_INVALID')
  const records=input.cohort.records.filter(r=>r.arenaObservation!==null)
  const arena=records.map(r=>r.arenaObservation!)
  const reasons:string[]=[]
  const resolvedSamples=arena.length
  const distinctEvents=new Set(records.map(r=>r.prediction.eventId)).size
  const forwardDays=Math.max(0,(Date.parse(input.cohort.closedAt)-Date.parse(input.cohort.startedAt))/86400000)
  const meanBrierScore=arena.length?mean(arena.map(a=>a.brierScore)):null
  const expectedCalibrationError=arena.length?ece(arena):null
  const clv=records.flatMap(r=>r.closingLineValueBps===null?[]:[r.closingLineValueBps])
  const returns=records.map(r=>r.shadowReturnBps)
  const meanClosingLineValueBps=clv.length?Math.round(mean(clv)):null
  const meanReturnBps=returns.length?Math.round(mean(returns)):null

  if(input.cohort.sourceClass!=='REAL_AS_OF')reasons.push('SYNTHETIC_OR_MIXED_EVIDENCE_CANNOT_CERTIFY_FORWARD_EDGE')
  if(input.cohort.mutationIds.length)reasons.push('MODEL_MUTATION_REQUIRES_NEW_COHORT')
  if(resolvedSamples<c.minimumResolvedSamples)reasons.push('INSUFFICIENT_RESOLVED_SAMPLE')
  if(distinctEvents<c.minimumDistinctEvents)reasons.push('INSUFFICIENT_DISTINCT_EVENTS')
  if(forwardDays<c.minimumForwardDays)reasons.push('INSUFFICIENT_FORWARD_DURATION')
  if(meanBrierScore===null||meanBrierScore>c.maximumMeanBrierScore)reasons.push('BRIER_ABOVE_THRESHOLD')
  if(expectedCalibrationError===null||expectedCalibrationError>c.maximumExpectedCalibrationError)reasons.push('CALIBRATION_ERROR_ABOVE_THRESHOLD')
  if(c.minimumMeanClosingLineValueBps!==undefined&&(meanClosingLineValueBps===null||meanClosingLineValueBps<c.minimumMeanClosingLineValueBps))reasons.push('CLOSING_LINE_VALUE_BELOW_THRESHOLD')
  if(c.minimumMeanReturnBps!==undefined&&(meanReturnBps===null||meanReturnBps<c.minimumMeanReturnBps))reasons.push('SHADOW_RETURN_BELOW_THRESHOLD')

  let status:SportsForwardShadowCertification['status']='FORWARD_SHADOW_CERTIFIED'
  if(input.cohort.sourceClass!=='REAL_AS_OF')status='SOFTWARE_ONLY'
  else if(reasons.some(r=>r.startsWith('INSUFFICIENT_')))status='INSUFFICIENT_FORWARD_EVIDENCE'
  else if(reasons.length)status='REJECTED'

  const probabilityReasons=new Set(['BRIER_ABOVE_THRESHOLD','CALIBRATION_ERROR_ABOVE_THRESHOLD','INSUFFICIENT_RESOLVED_SAMPLE','INSUFFICIENT_DISTINCT_EVENTS','INSUFFICIENT_FORWARD_DURATION','SYNTHETIC_OR_MIXED_EVIDENCE_CANNOT_CERTIFY_FORWARD_EDGE','MODEL_MUTATION_REQUIRES_NEW_COHORT'])
  const predictionQualityCertified=status==='FORWARD_SHADOW_CERTIFIED'&&!reasons.some(r=>probabilityReasons.has(r))
  const economicsRequested=c.minimumMeanClosingLineValueBps!==undefined||c.minimumMeanReturnBps!==undefined
  const economicEdgeCertified=predictionQualityCertified&&economicsRequested&&!reasons.includes('CLOSING_LINE_VALUE_BELOW_THRESHOLD')&&!reasons.includes('SHADOW_RETURN_BELOW_THRESHOLD')
  return Object.freeze({
    certificationId:'sport-shadow-cert:'+hash({cohort:input.cohort.cohortId,criteria:c,reasons}),
    cohortId:input.cohort.cohortId,
    status,
    resolvedSamples,
    distinctEvents,
    forwardDays,
    meanBrierScore,
    expectedCalibrationError,
    meanClosingLineValueBps,
    meanReturnBps,
    predictionQualityCertified,
    economicEdgeCertified,
    reasonCodes:unique(reasons),
    evidenceIds:unique(input.cohort.records.flatMap(r=>r.evidenceIds)),
    liveBettingEligible:false,
    authority:'CERTIFICATION_ONLY',
    canExecute:false,
  })
}
