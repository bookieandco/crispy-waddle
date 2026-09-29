import {createHash} from 'node:crypto'
import {buildSportsBetShadowSoakEvidence,createSportsBetShadowDecision,type SportsBetShadowDecision,type SportsBetShadowSourceClass,type SportsBetShadowSoakEvidence} from './sports-bet-shadow-runtime.js'
import {reviewSportsPredictionProcess,type SportsPredictionProcessReview} from './sports-prediction-process-review.js'
import {resolveSportsForwardShadowPrediction,type SportsForwardShadowPrediction,type SportsForwardShadowRecord,type SportsForwardShadowResolutionStatus} from './sports-prediction-forward-shadow.js'
import type {SportsMarketQuote} from './sports-paper-betting.js'

export type SportsShadowPhase='PREGAME'|'LIVE'

export type SportsContinuousShadowPolicy=Readonly<{
  policyId:string
  sourceClass:SportsBetShadowSourceClass
  pregameMinimumEdgeBps:number
  liveMinimumEdgeBps:number
  pregameMaximumQuoteAgeSeconds:number
  liveMaximumQuoteAgeSeconds:number
  authority:'SHADOW_POLICY_ONLY'
  canAuthorizeLive:false
}>

export type SportsContinuousShadowCandidate=Readonly<{
  prediction:SportsForwardShadowPrediction
  phase:SportsShadowPhase
  evidenceIds:readonly string[]
}>

export type SportsContinuousShadowTick=Readonly<{
  tickId:string
  policyId:string
  tickAt:string
  candidatePredictionIds:readonly string[]
  decisionIds:readonly string[]
  newDecisionCount:number
  duplicatePredictionCount:number
  liveDecisionCount:number
  pregameDecisionCount:number
  authority:'SHADOW_AUTOMATION_ONLY'
  bettingAuthority:'NONE'
  canExecute:false
}>

export type SportsContinuousShadowResolution=Readonly<{
  record:SportsForwardShadowRecord
  review:SportsPredictionProcessReview
  phase:SportsShadowPhase
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
  canExecute:false
}>

const hash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const instant=(value:string,code:string):number=>{const parsed=Date.parse(value);if(Number.isNaN(parsed))throw new Error(code);return parsed}
const unique=(values:readonly string[]):readonly string[]=>Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))].sort())

export function assertSportsContinuousShadowPolicy(policy:SportsContinuousShadowPolicy):void{
  if(!policy.policyId.trim())throw new Error('SPORT_AUTO_SHADOW_POLICY_ID_REQUIRED')
  for(const value of [policy.pregameMinimumEdgeBps,policy.liveMinimumEdgeBps]){
    if(!Number.isInteger(value))throw new Error('SPORT_AUTO_SHADOW_EDGE_THRESHOLD_INVALID')
  }
  for(const value of [policy.pregameMaximumQuoteAgeSeconds,policy.liveMaximumQuoteAgeSeconds]){
    if(!Number.isInteger(value)||value<1)throw new Error('SPORT_AUTO_SHADOW_QUOTE_AGE_INVALID')
  }
  if(policy.authority!=='SHADOW_POLICY_ONLY'||policy.canAuthorizeLive!==false)throw new Error('SPORT_AUTO_SHADOW_POLICY_AUTHORITY_INVALID')
}

export class SportsContinuousShadowLeague{
  private readonly decisions=new Map<string,SportsBetShadowDecision>()
  private readonly predictions=new Map<string,SportsForwardShadowPrediction>()
  private readonly phases=new Map<string,SportsShadowPhase>()
  private readonly records=new Map<string,SportsForwardShadowRecord>()
  private readonly reviews=new Map<string,SportsPredictionProcessReview>()

  constructor(private readonly policy:SportsContinuousShadowPolicy){
    assertSportsContinuousShadowPolicy(policy)
  }

  runTick(input:{
    candidates:readonly SportsContinuousShadowCandidate[]
    tickAt:string
  }):SportsContinuousShadowTick{
    instant(input.tickAt,'SPORT_AUTO_SHADOW_TICK_TIME_INVALID')
    const candidatePredictionIds:string[]=[]
    const decisionIds:string[]=[]
    let newDecisionCount=0
    let duplicatePredictionCount=0
    let liveDecisionCount=0
    let pregameDecisionCount=0

    for(const candidate of input.candidates){
      const prediction=candidate.prediction
      candidatePredictionIds.push(prediction.predictionId)
      if(prediction.sourceClass!==this.policy.sourceClass)throw new Error('SPORT_AUTO_SHADOW_SOURCE_CLASS_MISMATCH')
      const existing=this.decisions.get(prediction.predictionId)
      if(existing){
        duplicatePredictionCount++
        decisionIds.push(existing.decisionId)
        continue
      }
      const live=candidate.phase==='LIVE'
      const decision=createSportsBetShadowDecision({
        prediction,
        decisionAt:input.tickAt,
        minimumEdgeBps:live?this.policy.liveMinimumEdgeBps:this.policy.pregameMinimumEdgeBps,
        maxQuoteAgeSeconds:live?this.policy.liveMaximumQuoteAgeSeconds:this.policy.pregameMaximumQuoteAgeSeconds,
        sourceClass:this.policy.sourceClass,
        evidenceIds:candidate.evidenceIds,
      })
      this.decisions.set(prediction.predictionId,decision)
      this.predictions.set(prediction.predictionId,prediction)
      this.phases.set(prediction.predictionId,candidate.phase)
      decisionIds.push(decision.decisionId)
      newDecisionCount++
      if(live)liveDecisionCount++
      else pregameDecisionCount++
    }

    return Object.freeze({
      tickId:'sports-shadow-tick:'+hash({policyId:this.policy.policyId,tickAt:input.tickAt,candidates:unique(candidatePredictionIds),decisions:unique(decisionIds)}),
      policyId:this.policy.policyId,
      tickAt:input.tickAt,
      candidatePredictionIds:unique(candidatePredictionIds),
      decisionIds:unique(decisionIds),
      newDecisionCount,
      duplicatePredictionCount,
      liveDecisionCount,
      pregameDecisionCount,
      authority:'SHADOW_AUTOMATION_ONLY',
      bettingAuthority:'NONE',
      canExecute:false,
    })
  }

  resolve(input:{
    predictionId:string
    status:SportsForwardShadowResolutionStatus
    actualOutcomeId?:string
    resolvedAt:string
    closingQuote?:SportsMarketQuote
    evidenceIds:readonly string[]
  }):SportsContinuousShadowResolution{
    const decision=this.decisions.get(input.predictionId)
    const prediction=this.predictions.get(input.predictionId)
    const phase=this.phases.get(input.predictionId)
    if(!decision||!prediction||!phase)throw new Error('SPORT_AUTO_SHADOW_PREDICTION_NOT_FOUND')
    if(decision.action!=='SHADOW_WAGER')throw new Error('SPORT_AUTO_SHADOW_NO_WAGER_TO_RESOLVE')
    const existingRecord=this.records.get(input.predictionId)
    const existingReview=this.reviews.get(input.predictionId)
    if(existingRecord&&existingReview)return Object.freeze({record:existingRecord,review:existingReview,phase,authority:'LEARNING_ONLY',canAuthorizeLive:false,canExecute:false})
    const record=resolveSportsForwardShadowPrediction({
      prediction,
      status:input.status,
      actualOutcomeId:input.actualOutcomeId,
      resolvedAt:input.resolvedAt,
      closingQuote:input.closingQuote,
      evidenceIds:input.evidenceIds,
    })
    const review=reviewSportsPredictionProcess({record})
    this.records.set(input.predictionId,record)
    this.reviews.set(input.predictionId,review)
    return Object.freeze({record,review,phase,authority:'LEARNING_ONLY',canAuthorizeLive:false,canExecute:false})
  }

  buildSoakEvidence(input:{
    startedAt:string
    endedAt:string
    evidenceIds:readonly string[]
  }):SportsBetShadowSoakEvidence{
    return buildSportsBetShadowSoakEvidence({
      sourceClass:this.policy.sourceClass,
      decisions:[...this.decisions.values()],
      records:[...this.records.values()],
      unresolvedPredictionIds:[...this.decisions.entries()].filter(([predictionId,decision])=>decision.action==='SHADOW_WAGER'&&!this.records.has(predictionId)).map(([predictionId])=>predictionId),
      startedAt:input.startedAt,
      endedAt:input.endedAt,
      evidenceIds:input.evidenceIds,
    })
  }

  listDecisions():readonly SportsBetShadowDecision[]{return Object.freeze([...this.decisions.values()])}
  listRecords():readonly SportsForwardShadowRecord[]{return Object.freeze([...this.records.values()])}
  listReviews():readonly SportsPredictionProcessReview[]{return Object.freeze([...this.reviews.values()])}
}
