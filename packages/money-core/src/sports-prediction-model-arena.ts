import { createHash } from 'node:crypto'
import type { SportsPredictionTransportEnvelope } from './sports-intelligence-ingress.js'

export type SportsArenaSourceClass='REAL_AS_OF'|'SYNTHETIC_TEST'

export type SportsArenaObservation=Readonly<{
  observationId:string
  predictionId:string
  eventId:string
  sport:string
  marketFamily:string
  modelId:string
  modelVersion:string
  issuedAt:string
  resolvedAt:string
  probabilities:Readonly<Record<string,number>>
  actualOutcomeId:string
  topOutcomeId:string
  topConfidence:number
  topCorrect:boolean
  brierScore:number
  logLoss:number
  shadowReturnBps?:number
  closingLineValueBps?:number
  sourceClass:SportsArenaSourceClass
  evidenceIds:readonly string[]
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
}>

export type SportsArenaAssessment=Readonly<{
  assessmentId:string
  sport:string
  marketFamily:string
  modelId:string
  modelVersion:string
  sampleSize:number
  realSampleSize:number
  meanBrierScore:number
  meanLogLoss:number
  accuracyBps:number
  expectedCalibrationError:number
  meanShadowReturnBps:number|null
  meanClosingLineValueBps:number|null
  status:'INSUFFICIENT_EVIDENCE'|'CALIBRATED_FOR_ENSEMBLE'
  observationIds:readonly string[]
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
}>

export type SportsEnsembleWeight=Readonly<{
  modelId:string
  modelVersion:string
  sport:string
  marketFamily:string
  weightBps:number
  sampleSize:number
  meanBrierScore:number
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
}>

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const clamp=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))
const unique=(xs:readonly string[])=>Object.freeze([...new Set(xs)].sort())

function multiclassBrier(probabilities:Readonly<Record<string,number>>,actual:string):number{
  const entries=Object.entries(probabilities)
  if(entries.length<2||!Object.hasOwn(probabilities,actual))throw new Error('SPORT_PRED_ARENA_OUTCOME_INVALID')
  return entries.reduce((sum,[id,p])=>sum+(p-(id===actual?1:0))**2,0)/entries.length
}
function ece(xs:readonly SportsArenaObservation[]):number{
  if(!xs.length)return 0
  const buckets=Array.from({length:10},()=>[] as SportsArenaObservation[])
  for(const x of xs)buckets[Math.min(9,Math.floor(x.topConfidence*10))]!.push(x)
  let total=0
  for(const b of buckets){
    if(!b.length)continue
    const confidence=b.reduce((s,x)=>s+x.topConfidence,0)/b.length
    const accuracy=b.filter(x=>x.topCorrect).length/b.length
    total+=b.length/xs.length*Math.abs(confidence-accuracy)
  }
  return total
}

export function createSportsArenaObservation(input:{
  envelope:SportsPredictionTransportEnvelope
  marketFamily:string
  actualOutcomeId:string
  resolvedAt:string
  sourceClass:SportsArenaSourceClass
  evidenceIds:readonly string[]
  shadowReturnBps?:number
  closingLineValueBps?:number
}):SportsArenaObservation{
  if(!input.marketFamily.trim()||!input.actualOutcomeId.trim()||!input.evidenceIds.length)throw new Error('SPORT_PRED_ARENA_LINEAGE_REQUIRED')
  if(Date.parse(input.resolvedAt)<=Date.parse(input.envelope.issuedAt))throw new Error('SPORT_PRED_ARENA_RESOLUTION_NOT_AFTER_PREDICTION')
  const probabilities:Record<string,number>={}
  for(const o of input.envelope.distribution.outcomes){
    if(!Number.isFinite(o.probability)||o.probability<0||o.probability>1)throw new Error('SPORT_PRED_ARENA_PROBABILITY_INVALID')
    probabilities[o.outcomeId]=o.probability
  }
  if(!Object.hasOwn(probabilities,input.actualOutcomeId))throw new Error('SPORT_PRED_ARENA_ACTUAL_OUTCOME_UNKNOWN')
  const sorted=Object.entries(probabilities).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))
  const [topOutcomeId,topConfidence]=sorted[0]!
  const actualProbability=Math.max(1e-12,probabilities[input.actualOutcomeId]!)
  const brier=multiclassBrier(probabilities,input.actualOutcomeId)
  return Object.freeze({
    observationId:'sport-arena:'+hash({prediction:input.envelope.envelopeId,marketFamily:input.marketFamily,actual:input.actualOutcomeId,resolvedAt:input.resolvedAt}),
    predictionId:input.envelope.envelopeId,
    eventId:input.envelope.subject.gameId??input.envelope.subject.subjectId,
    sport:input.envelope.sport,
    marketFamily:input.marketFamily,
    modelId:input.envelope.model.modelId,
    modelVersion:input.envelope.model.modelVersion,
    issuedAt:input.envelope.issuedAt,
    resolvedAt:input.resolvedAt,
    probabilities:Object.freeze(probabilities),
    actualOutcomeId:input.actualOutcomeId,
    topOutcomeId,
    topConfidence,
    topCorrect:topOutcomeId===input.actualOutcomeId,
    brierScore:brier,
    logLoss:-Math.log(actualProbability),
    shadowReturnBps:input.shadowReturnBps,
    closingLineValueBps:input.closingLineValueBps,
    sourceClass:input.sourceClass,
    evidenceIds:unique(input.evidenceIds),
    authority:'LEARNING_ONLY',
    canAuthorizeLive:false,
  })
}

export function assessSportsModelArena(input:{
  observations:readonly SportsArenaObservation[]
  minimumRealSamples:number
}):readonly SportsArenaAssessment[]{
  if(!Number.isInteger(input.minimumRealSamples)||input.minimumRealSamples<2)throw new Error('SPORT_PRED_ARENA_MIN_SAMPLE_INVALID')
  const groups=new Map<string,SportsArenaObservation[]>()
  for(const o of input.observations){
    if(o.authority!=='LEARNING_ONLY'||o.canAuthorizeLive!==false)throw new Error('SPORT_PRED_ARENA_AUTHORITY_INVALID')
    const key=[o.sport,o.marketFamily,o.modelId,o.modelVersion].join('|')
    const g=groups.get(key)??[]
    g.push(o)
    groups.set(key,g)
  }
  const assessments:SportsArenaAssessment[]=[]
  for(const xs of groups.values()){
    const first=xs[0]!
    const real=xs.filter(x=>x.sourceClass==='REAL_AS_OF')
    const mean=(values:readonly number[])=>values.length?values.reduce((a,b)=>a+b,0)/values.length:0
    const returns=real.flatMap(x=>x.shadowReturnBps===undefined?[]:[x.shadowReturnBps])
    const clv=real.flatMap(x=>x.closingLineValueBps===undefined?[]:[x.closingLineValueBps])
    const observationIds=unique(xs.map(x=>x.observationId))
    assessments.push(Object.freeze({
      assessmentId:'sport-arena-assessment:'+hash({key:[first.sport,first.marketFamily,first.modelId,first.modelVersion],observationIds}),
      sport:first.sport,
      marketFamily:first.marketFamily,
      modelId:first.modelId,
      modelVersion:first.modelVersion,
      sampleSize:xs.length,
      realSampleSize:real.length,
      meanBrierScore:mean(real.map(x=>x.brierScore)),
      meanLogLoss:mean(real.map(x=>x.logLoss)),
      accuracyBps:real.length?Math.round(real.filter(x=>x.topCorrect).length*10000/real.length):0,
      expectedCalibrationError:ece(real),
      meanShadowReturnBps:returns.length?Math.round(mean(returns)):null,
      meanClosingLineValueBps:clv.length?Math.round(mean(clv)):null,
      status:real.length>=input.minimumRealSamples?'CALIBRATED_FOR_ENSEMBLE':'INSUFFICIENT_EVIDENCE',
      observationIds,
      authority:'LEARNING_ONLY',
      canAuthorizeLive:false,
    }))
  }
  return Object.freeze(assessments.sort((a,b)=>[a.sport,a.marketFamily,a.modelId,a.modelVersion].join('|').localeCompare([b.sport,b.marketFamily,b.modelId,b.modelVersion].join('|'))))
}

export function deriveSportsEnsembleWeights(input:{
  assessments:readonly SportsArenaAssessment[]
  sport:string
  marketFamily:string
  minimumSamples:number
}):readonly SportsEnsembleWeight[]{
  const eligible=input.assessments.filter(a=>
    a.sport===input.sport&&
    a.marketFamily===input.marketFamily&&
    a.status==='CALIBRATED_FOR_ENSEMBLE'&&
    a.realSampleSize>=input.minimumSamples
  )
  if(!eligible.length)return Object.freeze([])
  const raw=eligible.map(a=>1/Math.max(.0001,a.meanBrierScore))
  const total=raw.reduce((a,b)=>a+b,0)
  const provisional=eligible.map((a,i)=>Math.floor(raw[i]!/total*10000))
  let remainder=10000-provisional.reduce((a,b)=>a+b,0)
  const ordered=eligible.map((a,i)=>({a,i,score:raw[i]!})).sort((x,y)=>y.score-x.score||x.a.modelId.localeCompare(y.a.modelId))
  for(const x of ordered){
    if(remainder<=0)break
    provisional[x.i]!+=1
    remainder--
  }
  return Object.freeze(eligible.map((a,i)=>Object.freeze({
    modelId:a.modelId,
    modelVersion:a.modelVersion,
    sport:a.sport,
    marketFamily:a.marketFamily,
    weightBps:clamp(provisional[i]!,0,10000),
    sampleSize:a.realSampleSize,
    meanBrierScore:a.meanBrierScore,
    authority:'LEARNING_ONLY' as const,
    canAuthorizeLive:false as const,
  })))
}
