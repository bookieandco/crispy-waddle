import {createHash} from 'node:crypto'
import {
  decideSportsAutomaticPaperWager,
  settleSportsAutomaticPaperWager,
  type SportsAutoPaperDecision,
  type SportsAutoPaperPolicy,
  type SportsAutoPaperReview,
} from './sports-auto-paper-league.js'
import {
  calibrateSportsLearningMemory,
  createSportsLearningEpisode,
  type SportsLearningEpisode,
  type SportsLearningMemoryStore,
} from './sports-learning-memory.js'
import {
  createSportsBetShadowDecision,
  type SportsBetShadowDecision,
} from './sports-bet-shadow-runtime.js'
import {
  reviewSportsPredictionProcess,
  type SportsPredictionProcessReview,
} from './sports-prediction-process-review.js'
import {
  resolveSportsForwardShadowPrediction,
  type SportsForwardShadowPrediction,
  type SportsForwardShadowRecord,
  type SportsForwardShadowResolutionStatus,
} from './sports-prediction-forward-shadow.js'
import type {SportsMarketQuote,SportsPaperSettlement} from './sports-paper-betting.js'
import {
  buildSportsThesisLearningRecord,
  projectSportsThesisToReusableAlpha,
  type SportsReusableLearningSignal,
  type SportsThesisLearningRecord,
} from './sports-shark-learning-bridge.js'
import type {StrategyCalibration} from './autonomous-strategy-learning.js'
import type {SportsContinuousShadowPolicy,SportsShadowPhase} from './sports-continuous-shadow-league.js'

export type SportsAutoDiscoveredOpportunity=Readonly<{
  opportunityId:string
  eventId:string
  phase:SportsShadowPhase
  discoveredAt:string
  evidenceIds:readonly string[]
  authority:'EVIDENCE_ONLY'
  canExecute:false
}>

export type SportsAutoRuntimeCandidate=Readonly<{
  candidateId:string
  opportunityId:string
  prediction:SportsForwardShadowPrediction
  phase:SportsShadowPhase
  discoveredAt:string
  evidenceIds:readonly string[]
  authority:'INTELLIGENCE_ONLY'
  canExecute:false
}>

export type SportsAutoResolvedOutcome=Readonly<{
  predictionId:string
  status:SportsForwardShadowResolutionStatus
  actualOutcomeId?:string
  resolvedAt:string
  closingQuote?:SportsMarketQuote
  evidenceIds:readonly string[]
}>

export type SportsAutoPaperResolution=Readonly<{
  predictionId:string
  settlement:SportsPaperSettlement
  review:SportsAutoPaperReview
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
  canExecute:false
}>

export type SportsAutoShadowResolution=Readonly<{
  predictionId:string
  record:SportsForwardShadowRecord
  review:SportsPredictionProcessReview
  authority:'LEARNING_ONLY'
  canAuthorizeLive:false
  canExecute:false
}>

export type SportsModelFeedbackReceipt=Readonly<{
  feedbackId:string
  predictionId:string
  strategyId:string
  calibrationId:string
  revisionId:string
  evidenceIds:readonly string[]
  appliedAt:string
  authority:'MODEL_FEEDBACK_ONLY'
  canAuthorizeLive:false
  canExecute:false
}>

export interface SportsAutoOpportunitySource{
  discover(now:string):Promise<readonly SportsAutoDiscoveredOpportunity[]>
}

export interface SportsAutoPredictionEngine{
  predict(opportunity:SportsAutoDiscoveredOpportunity,now:string):Promise<SportsAutoRuntimeCandidate>
}

export interface SportsAutoResultSource{
  resolve(candidates:readonly SportsAutoRuntimeCandidate[],now:string):Promise<readonly SportsAutoResolvedOutcome[]>
}

export interface SportsModelFeedbackSink{
  apply(input:{
    candidate:SportsAutoRuntimeCandidate
    episode:SportsLearningEpisode
    calibration:StrategyCalibration
    thesis:SportsThesisLearningRecord
    reusableSignal:SportsReusableLearningSignal
    now:string
  }):Promise<SportsModelFeedbackReceipt>
}

export interface SportsAutoRuntimeStore{
  getCandidate(predictionId:string):Promise<SportsAutoRuntimeCandidate|undefined>|SportsAutoRuntimeCandidate|undefined
  putCandidate(candidate:SportsAutoRuntimeCandidate):Promise<void>|void
  listOpenCandidates():Promise<readonly SportsAutoRuntimeCandidate[]>|readonly SportsAutoRuntimeCandidate[]
  markCandidateResolved(predictionId:string,resolvedAt:string):Promise<void>|void

  getPaperDecision(predictionId:string):Promise<SportsAutoPaperDecision|undefined>|SportsAutoPaperDecision|undefined
  putPaperDecision(decision:SportsAutoPaperDecision):Promise<void>|void
  getPaperResolution(predictionId:string):Promise<SportsAutoPaperResolution|undefined>|SportsAutoPaperResolution|undefined
  putPaperResolution(resolution:SportsAutoPaperResolution):Promise<void>|void

  getShadowDecision(predictionId:string):Promise<SportsBetShadowDecision|undefined>|SportsBetShadowDecision|undefined
  putShadowDecision(decision:SportsBetShadowDecision):Promise<void>|void
  getShadowResolution(predictionId:string):Promise<SportsAutoShadowResolution|undefined>|SportsAutoShadowResolution|undefined
  putShadowResolution(resolution:SportsAutoShadowResolution):Promise<void>|void
}

type CandidateState={candidate:SportsAutoRuntimeCandidate;resolvedAt?:string}

export class InMemorySportsAutoRuntimeStore implements SportsAutoRuntimeStore{
  private readonly candidates=new Map<string,CandidateState>()
  private readonly paperDecisions=new Map<string,SportsAutoPaperDecision>()
  private readonly paperResolutions=new Map<string,SportsAutoPaperResolution>()
  private readonly shadowDecisions=new Map<string,SportsBetShadowDecision>()
  private readonly shadowResolutions=new Map<string,SportsAutoShadowResolution>()

  getCandidate(predictionId:string):SportsAutoRuntimeCandidate|undefined{return this.candidates.get(predictionId)?.candidate}
  putCandidate(candidate:SportsAutoRuntimeCandidate):void{
    const key=candidate.prediction.predictionId
    const existing=this.candidates.get(key)
    if(existing&&existing.candidate.candidateId!==candidate.candidateId)throw new Error('SPORT_AUTO_RUNTIME_CANDIDATE_CONFLICT')
    if(!existing)this.candidates.set(key,{candidate})
  }
  listOpenCandidates():readonly SportsAutoRuntimeCandidate[]{
    return Object.freeze([...this.candidates.values()].filter(value=>!value.resolvedAt).map(value=>value.candidate))
  }
  markCandidateResolved(predictionId:string,resolvedAt:string):void{
    const existing=this.candidates.get(predictionId)
    if(!existing)throw new Error('SPORT_AUTO_RUNTIME_CANDIDATE_NOT_FOUND')
    this.candidates.set(predictionId,{candidate:existing.candidate,resolvedAt})
  }

  getPaperDecision(predictionId:string):SportsAutoPaperDecision|undefined{return this.paperDecisions.get(predictionId)}
  putPaperDecision(decision:SportsAutoPaperDecision):void{
    const existing=this.paperDecisions.get(decision.predictionId)
    if(existing&&existing.decisionId!==decision.decisionId)throw new Error('SPORT_AUTO_RUNTIME_PAPER_DECISION_CONFLICT')
    this.paperDecisions.set(decision.predictionId,decision)
  }
  getPaperResolution(predictionId:string):SportsAutoPaperResolution|undefined{return this.paperResolutions.get(predictionId)}
  putPaperResolution(resolution:SportsAutoPaperResolution):void{
    const existing=this.paperResolutions.get(resolution.predictionId)
    if(existing&&existing.settlement.settlementId!==resolution.settlement.settlementId)throw new Error('SPORT_AUTO_RUNTIME_PAPER_RESOLUTION_CONFLICT')
    this.paperResolutions.set(resolution.predictionId,resolution)
  }

  getShadowDecision(predictionId:string):SportsBetShadowDecision|undefined{return this.shadowDecisions.get(predictionId)}
  putShadowDecision(decision:SportsBetShadowDecision):void{
    const existing=this.shadowDecisions.get(decision.predictionId)
    if(existing&&existing.decisionId!==decision.decisionId)throw new Error('SPORT_AUTO_RUNTIME_SHADOW_DECISION_CONFLICT')
    this.shadowDecisions.set(decision.predictionId,decision)
  }
  getShadowResolution(predictionId:string):SportsAutoShadowResolution|undefined{return this.shadowResolutions.get(predictionId)}
  putShadowResolution(resolution:SportsAutoShadowResolution):void{
    const existing=this.shadowResolutions.get(resolution.predictionId)
    if(existing&&existing.record.recordId!==resolution.record.recordId)throw new Error('SPORT_AUTO_RUNTIME_SHADOW_RESOLUTION_CONFLICT')
    this.shadowResolutions.set(resolution.predictionId,resolution)
  }
}

export type SportsAutoDiscoveryCycleReceipt=Readonly<{
  cycleId:string
  cycleAt:string
  opportunityCount:number
  candidateCount:number
  newCandidateCount:number
  paperDecisionCount:number
  shadowDecisionCount:number
  duplicateCandidateCount:number
  evidenceIds:readonly string[]
  authority:'AUTOMATION_COORDINATION_ONLY'
  canAuthorizeLive:false
  canExecute:false
}>

export type SportsAutoResolutionCycleReceipt=Readonly<{
  cycleId:string
  cycleAt:string
  openCandidateCount:number
  resolvedOutcomeCount:number
  paperResolutionCount:number
  shadowResolutionCount:number
  learningEpisodeCount:number
  feedbackReceiptIds:readonly string[]
  evidenceIds:readonly string[]
  authority:'AUTOMATION_COORDINATION_ONLY'
  canAuthorizeLive:false
  canExecute:false
}>

const hash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const instant=(value:string,code:string):number=>{const parsed=Date.parse(value);if(Number.isNaN(parsed))throw new Error(code);return parsed}
const unique=(values:readonly string[]):readonly string[]=>Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))].sort())

function assertOpportunity(opportunity:SportsAutoDiscoveredOpportunity,now:string):void{
  if(!opportunity.opportunityId.trim()||!opportunity.eventId.trim())throw new Error('SPORT_AUTO_RUNTIME_OPPORTUNITY_IDENTITY_REQUIRED')
  if(opportunity.authority!=='EVIDENCE_ONLY'||opportunity.canExecute!==false)throw new Error('SPORT_AUTO_RUNTIME_OPPORTUNITY_AUTHORITY_INVALID')
  if(instant(opportunity.discoveredAt,'SPORT_AUTO_RUNTIME_DISCOVERED_AT_INVALID')>instant(now,'SPORT_AUTO_RUNTIME_NOW_INVALID'))throw new Error('SPORT_AUTO_RUNTIME_FUTURE_OPPORTUNITY')
  if(!opportunity.evidenceIds.length)throw new Error('SPORT_AUTO_RUNTIME_OPPORTUNITY_EVIDENCE_REQUIRED')
}

function assertCandidate(candidate:SportsAutoRuntimeCandidate,opportunity:SportsAutoDiscoveredOpportunity):void{
  if(candidate.opportunityId!==opportunity.opportunityId||candidate.prediction.eventId!==opportunity.eventId||candidate.phase!==opportunity.phase)throw new Error('SPORT_AUTO_RUNTIME_CANDIDATE_BINDING_MISMATCH')
  if(candidate.authority!=='INTELLIGENCE_ONLY'||candidate.canExecute!==false)throw new Error('SPORT_AUTO_RUNTIME_CANDIDATE_AUTHORITY_INVALID')
  if(candidate.prediction.canExecute!==false||candidate.prediction.bettingAuthority!=='NONE'||candidate.prediction.financialAuthority!=='NONE')throw new Error('SPORT_AUTO_RUNTIME_PREDICTION_AUTHORITY_INVALID')
  if(!candidate.evidenceIds.length)throw new Error('SPORT_AUTO_RUNTIME_CANDIDATE_EVIDENCE_REQUIRED')
}

function shadowThresholds(policy:SportsContinuousShadowPolicy,phase:SportsShadowPhase):Readonly<{minimumEdgeBps:number;maxQuoteAgeSeconds:number}>{
  return phase==='LIVE'
    ?Object.freeze({minimumEdgeBps:policy.liveMinimumEdgeBps,maxQuoteAgeSeconds:policy.liveMaximumQuoteAgeSeconds})
    :Object.freeze({minimumEdgeBps:policy.pregameMinimumEdgeBps,maxQuoteAgeSeconds:policy.pregameMaximumQuoteAgeSeconds})
}

export class SportsAutoLearningRuntime{
  constructor(private readonly deps:{
    opportunitySource:SportsAutoOpportunitySource
    predictionEngine:SportsAutoPredictionEngine
    resultSource:SportsAutoResultSource
    store:SportsAutoRuntimeStore
    learningMemory:SportsLearningMemoryStore
    feedbackSink:SportsModelFeedbackSink
    paperPolicy:SportsAutoPaperPolicy
    shadowPolicy:SportsContinuousShadowPolicy
    learningMinimumSamples?:number
  }){}

  async runDiscoveryCycle(now:string):Promise<SportsAutoDiscoveryCycleReceipt>{
    instant(now,'SPORT_AUTO_RUNTIME_NOW_INVALID')
    const opportunities=await this.deps.opportunitySource.discover(now)
    const evidence:string[]=[]
    let candidateCount=0,newCandidateCount=0,paperDecisionCount=0,shadowDecisionCount=0,duplicateCandidateCount=0

    for(const opportunity of opportunities){
      assertOpportunity(opportunity,now)
      evidence.push(...opportunity.evidenceIds)
      const predicted=await this.deps.predictionEngine.predict(opportunity,now)
      assertCandidate(predicted,opportunity)
      candidateCount++
      evidence.push(...predicted.evidenceIds)

      const predictionId=predicted.prediction.predictionId
      const existingCandidate=await this.deps.store.getCandidate(predictionId)
      if(existingCandidate){
        duplicateCandidateCount++
      }else{
        await this.deps.store.putCandidate(predicted)
        newCandidateCount++
      }

      if(!await this.deps.store.getPaperDecision(predictionId)){
        const paper=decideSportsAutomaticPaperWager({
          prediction:predicted.prediction,
          policy:this.deps.paperPolicy,
          decisionAt:now,
          evidenceIds:predicted.evidenceIds,
        })
        await this.deps.store.putPaperDecision(paper)
        paperDecisionCount++
        evidence.push(...paper.evidenceIds)
      }

      if(!await this.deps.store.getShadowDecision(predictionId)){
        if(predicted.prediction.sourceClass!==this.deps.shadowPolicy.sourceClass)throw new Error('SPORT_AUTO_RUNTIME_SHADOW_SOURCE_CLASS_MISMATCH')
        const thresholds=shadowThresholds(this.deps.shadowPolicy,predicted.phase)
        const shadow=createSportsBetShadowDecision({
          prediction:predicted.prediction,
          decisionAt:now,
          minimumEdgeBps:thresholds.minimumEdgeBps,
          maxQuoteAgeSeconds:thresholds.maxQuoteAgeSeconds,
          sourceClass:this.deps.shadowPolicy.sourceClass,
          evidenceIds:predicted.evidenceIds,
        })
        await this.deps.store.putShadowDecision(shadow)
        shadowDecisionCount++
        evidence.push(...shadow.evidenceIds)
      }
    }

    return Object.freeze({
      cycleId:'sport-auto-discovery:'+hash({now,opportunities:opportunities.map(item=>item.opportunityId).sort()}),
      cycleAt:now,
      opportunityCount:opportunities.length,
      candidateCount,
      newCandidateCount,
      paperDecisionCount,
      shadowDecisionCount,
      duplicateCandidateCount,
      evidenceIds:unique(evidence),
      authority:'AUTOMATION_COORDINATION_ONLY',
      canAuthorizeLive:false,
      canExecute:false,
    })
  }

  async runResolutionCycle(now:string):Promise<SportsAutoResolutionCycleReceipt>{
    instant(now,'SPORT_AUTO_RUNTIME_NOW_INVALID')
    const openCandidates=await this.deps.store.listOpenCandidates()
    const outcomes=await this.deps.resultSource.resolve(openCandidates,now)
    const byPrediction=new Map(openCandidates.map(candidate=>[candidate.prediction.predictionId,candidate] as const))
    const evidence:string[]=[]
    const feedbackReceiptIds:string[]=[]
    let paperResolutionCount=0,shadowResolutionCount=0,learningEpisodeCount=0

    for(const outcome of outcomes){
      const candidate=byPrediction.get(outcome.predictionId)
      if(!candidate)throw new Error('SPORT_AUTO_RUNTIME_RESULT_WITHOUT_OPEN_CANDIDATE')
      if(instant(outcome.resolvedAt,'SPORT_AUTO_RUNTIME_RESOLVED_AT_INVALID')>instant(now,'SPORT_AUTO_RUNTIME_NOW_INVALID'))throw new Error('SPORT_AUTO_RUNTIME_FUTURE_RESULT')
      if(!outcome.evidenceIds.length)throw new Error('SPORT_AUTO_RUNTIME_RESULT_EVIDENCE_REQUIRED')
      evidence.push(...outcome.evidenceIds)

      const paperDecision=await this.deps.store.getPaperDecision(outcome.predictionId)
      if(paperDecision?.action==='PAPER_WAGER'&&paperDecision.paperWager&&!await this.deps.store.getPaperResolution(outcome.predictionId)){
        const settled=settleSportsAutomaticPaperWager({
          decision:paperDecision,
          status:outcome.status,
          resolvedAt:outcome.resolvedAt,
          evidenceIds:outcome.evidenceIds,
          closingQuote:outcome.closingQuote,
        })
        const paperResolution:SportsAutoPaperResolution=Object.freeze({
          predictionId:outcome.predictionId,
          settlement:settled.settlement,
          review:settled.review,
          authority:'LEARNING_ONLY',
          canAuthorizeLive:false,
          canExecute:false,
        })
        await this.deps.store.putPaperResolution(paperResolution)
        paperResolutionCount++

        const episode=createSportsLearningEpisode({
          prediction:candidate.prediction,
          decision:paperDecision,
          wager:paperDecision.paperWager,
          settlement:settled.settlement,
          review:settled.review,
        })
        await this.deps.learningMemory.put(episode)
        learningEpisodeCount++
        const episodes=await this.deps.learningMemory.list()
        const calibration=calibrateSportsLearningMemory({
          episodes,
          strategyId:episode.strategyId,
          calibratedAt:now,
          minimumSamples:this.deps.learningMinimumSamples,
        })
        const thesis=buildSportsThesisLearningRecord({prediction:candidate.prediction,episode,calibration})
        const reusableSignal=projectSportsThesisToReusableAlpha({
          thesis,
          availableAt:now,
          expiresAt:new Date(instant(now,'SPORT_AUTO_RUNTIME_NOW_INVALID')+24*60*60*1000).toISOString(),
        })
        const feedback=await this.deps.feedbackSink.apply({candidate,episode,calibration,thesis,reusableSignal,now})
        if(feedback.authority!=='MODEL_FEEDBACK_ONLY'||feedback.canAuthorizeLive!==false||feedback.canExecute!==false)throw new Error('SPORT_AUTO_RUNTIME_FEEDBACK_AUTHORITY_INVALID')
        feedbackReceiptIds.push(feedback.feedbackId)
        evidence.push(...episode.evidenceIds,...feedback.evidenceIds)
      }

      const shadowDecision=await this.deps.store.getShadowDecision(outcome.predictionId)
      if(shadowDecision?.action==='SHADOW_WAGER'&&!await this.deps.store.getShadowResolution(outcome.predictionId)){
        const record=resolveSportsForwardShadowPrediction({
          prediction:candidate.prediction,
          status:outcome.status,
          actualOutcomeId:outcome.actualOutcomeId,
          resolvedAt:outcome.resolvedAt,
          closingQuote:outcome.closingQuote,
          evidenceIds:outcome.evidenceIds,
        })
        const review=reviewSportsPredictionProcess({record})
        await this.deps.store.putShadowResolution(Object.freeze({
          predictionId:outcome.predictionId,
          record,
          review,
          authority:'LEARNING_ONLY',
          canAuthorizeLive:false,
          canExecute:false,
        }))
        shadowResolutionCount++
        evidence.push(...record.evidenceIds)
      }

      await this.deps.store.markCandidateResolved(outcome.predictionId,outcome.resolvedAt)
    }

    return Object.freeze({
      cycleId:'sport-auto-resolution:'+hash({now,predictions:outcomes.map(item=>item.predictionId).sort()}),
      cycleAt:now,
      openCandidateCount:openCandidates.length,
      resolvedOutcomeCount:outcomes.length,
      paperResolutionCount,
      shadowResolutionCount,
      learningEpisodeCount,
      feedbackReceiptIds:unique(feedbackReceiptIds),
      evidenceIds:unique(evidence),
      authority:'AUTOMATION_COORDINATION_ONLY',
      canAuthorizeLive:false,
      canExecute:false,
    })
  }
}
