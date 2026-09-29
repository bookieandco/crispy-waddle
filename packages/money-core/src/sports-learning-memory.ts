import {createHash} from 'node:crypto'
import {calibrateAutonomousStrategy,type StrategyCalibration,type StrategyLearningRecord} from './autonomous-strategy-learning.js'
import type {SportsAutoPaperDecision,SportsAutoPaperReview} from './sports-auto-paper-league.js'
import type {SportsPaperSettlement,SportsPaperWager} from './sports-paper-betting.js'
import type {SportsForwardShadowPrediction} from './sports-prediction-forward-shadow.js'

export type SportsLearningEpisode=Readonly<{
  episodeId:string
  predictionId:string
  eventId:string
  sport:string
  marketFamily:string
  marketId:string
  selectionId:string
  strategyId:string
  modelId:string
  modelVersion:string
  informationCutoff:string
  decisionId:string
  wagerId:string
  settlementId:string
  processReviewId:string
  returnBps:number
  closingLineValue:number|null
  processClass:SportsAutoPaperReview['processClass']
  learningRecord:StrategyLearningRecord
  evidenceIds:readonly string[]
  resolvedAt:string
  authority:'SPORTS_LEARNING_MEMORY'
  canAuthorizeLive:false
  canExecute:false
}>

export interface SportsLearningMemoryStore{
  get(episodeId:string):Promise<SportsLearningEpisode|undefined>|SportsLearningEpisode|undefined
  put(episode:SportsLearningEpisode):Promise<void>|void
  list():Promise<readonly SportsLearningEpisode[]>|readonly SportsLearningEpisode[]
}

export class InMemorySportsLearningMemoryStore implements SportsLearningMemoryStore{
  private readonly episodes=new Map<string,SportsLearningEpisode>()
  get(episodeId:string):SportsLearningEpisode|undefined{return this.episodes.get(episodeId)}
  put(episode:SportsLearningEpisode):void{
    const existing=this.episodes.get(episode.episodeId)
    if(existing&&JSON.stringify(existing,(_,value)=>typeof value==='bigint'?value.toString():value)!==JSON.stringify(episode,(_,value)=>typeof value==='bigint'?value.toString():value))throw new Error('SPORT_AUTO_MEMORY_EPISODE_CONFLICT')
    this.episodes.set(episode.episodeId,episode)
  }
  list():readonly SportsLearningEpisode[]{return Object.freeze([...this.episodes.values()].sort((a,b)=>a.resolvedAt.localeCompare(b.resolvedAt)||a.episodeId.localeCompare(b.episodeId)))}
}

const stable=(value:unknown):string=>JSON.stringify(value,(_,item)=>typeof item==='bigint'?item.toString():item)
const hash=(value:unknown):string=>createHash('sha256').update(stable(value)).digest('hex')
const clamp=(value:number,min:number,max:number):number=>Math.max(min,Math.min(max,value))
const unique=(values:readonly string[]):readonly string[]=>Object.freeze([...new Set(values.map(value=>value.trim()).filter(Boolean))].sort())

export function sportsPaperSettlementToLearningRecord(input:{
  prediction:SportsForwardShadowPrediction
  wager:SportsPaperWager
  settlement:SportsPaperSettlement
  review:SportsAutoPaperReview
}):StrategyLearningRecord{
  if(input.settlement.wagerId!==input.wager.wagerId)throw new Error('SPORT_AUTO_LEARNING_WAGER_SETTLEMENT_MISMATCH')
  if(input.review.settlementId!==input.settlement.settlementId)throw new Error('SPORT_AUTO_LEARNING_REVIEW_SETTLEMENT_MISMATCH')
  if(input.prediction.eventId!==input.wager.eventId)throw new Error('SPORT_AUTO_LEARNING_EVENT_MISMATCH')
  if(input.settlement.authority!=='LEARNING_ONLY'||input.review.authority!=='LEARNING_ONLY')throw new Error('SPORT_AUTO_LEARNING_AUTHORITY_INVALID')
  const strategyId=input.wager.strategyId
  const returnBps=Number(input.settlement.profitLossMinor*10000n/input.wager.stakeMinor)
  const outcomeScore=clamp(returnBps/10000,-1,1)
  const processQuality=input.review.processClass.startsWith('GOOD_PROCESS')?1:input.review.processClass==='NON_DECISION_RESULT'?0.5:0.25
  const evidenceIds=unique([...input.prediction.evidenceIds,...input.settlement.evidenceIds,...input.review.evidenceIds])
  return Object.freeze({
    learningRecordId:'sports-learning:'+hash({predictionId:input.prediction.predictionId,settlementId:input.settlement.settlementId,reviewId:input.review.reviewId}),
    domain:'SPORTS_BETTING',
    strategyId,
    scenarioId:input.prediction.envelope.provenance.inputSnapshotHash,
    paperRunId:'sports-paper-run:'+input.wager.wagerId,
    strategyResultId:'sports-paper-result:'+input.settlement.settlementId,
    returnBps,
    fillRateBps:10000,
    slippageBps:0,
    feesPaidMinor:'0',
    outcomeScore,
    executionQuality:processQuality,
    evidenceIds,
    evaluatedAt:input.settlement.resolvedAt,
    authority:'LEARNING_ONLY',
    canAuthorizeLive:false,
  })
}

export function createSportsLearningEpisode(input:{
  prediction:SportsForwardShadowPrediction
  decision:SportsAutoPaperDecision
  wager:SportsPaperWager
  settlement:SportsPaperSettlement
  review:SportsAutoPaperReview
}):SportsLearningEpisode{
  if(input.decision.predictionId!==input.prediction.predictionId)throw new Error('SPORT_AUTO_MEMORY_DECISION_PREDICTION_MISMATCH')
  if(input.decision.paperWager?.wagerId!==input.wager.wagerId)throw new Error('SPORT_AUTO_MEMORY_WAGER_DECISION_MISMATCH')
  const learningRecord=sportsPaperSettlementToLearningRecord(input)
  const evidenceIds=unique([...learningRecord.evidenceIds,...input.decision.evidenceIds])
  return Object.freeze({
    episodeId:'sports-episode:'+hash({predictionId:input.prediction.predictionId,settlementId:input.settlement.settlementId}),
    predictionId:input.prediction.predictionId,
    eventId:input.prediction.eventId,
    sport:input.prediction.envelope.sport,
    marketFamily:input.prediction.marketFamily,
    marketId:input.wager.marketId,
    selectionId:input.wager.selectionId,
    strategyId:input.wager.strategyId,
    modelId:input.prediction.envelope.model.modelId,
    modelVersion:input.prediction.envelope.model.modelVersion,
    informationCutoff:input.prediction.envelope.informationCutoff,
    decisionId:input.decision.decisionId,
    wagerId:input.wager.wagerId,
    settlementId:input.settlement.settlementId,
    processReviewId:input.review.reviewId,
    returnBps:learningRecord.returnBps,
    closingLineValue:input.settlement.closingLineValue??null,
    processClass:input.review.processClass,
    learningRecord,
    evidenceIds,
    resolvedAt:input.settlement.resolvedAt,
    authority:'SPORTS_LEARNING_MEMORY',
    canAuthorizeLive:false,
    canExecute:false,
  })
}

export function calibrateSportsLearningMemory(input:{
  episodes:readonly SportsLearningEpisode[]
  strategyId:string
  calibratedAt:string
  minimumSamples?:number
}):StrategyCalibration{
  const records=input.episodes
    .filter(episode=>episode.strategyId===input.strategyId)
    .map(episode=>episode.learningRecord)
  return calibrateAutonomousStrategy({
    domain:'SPORTS_BETTING',
    strategyId:input.strategyId,
    records,
    calibratedAt:input.calibratedAt,
    minimumSamples:input.minimumSamples,
  })
}
