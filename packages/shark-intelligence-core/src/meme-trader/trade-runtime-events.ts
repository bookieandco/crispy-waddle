import type { MemeTradeAssessment } from './assessment'
import type { ClosedMemeTradeLearningRecord } from './live-trade-learning'
import type { MemePositionReview, MemePositionReviewState } from './position-review'

export type SharkTradeStageEmission=Readonly<{
 type:'TOKEN_DISCOVERED'|'SHARK_ANALYZED'|'THESIS_CREATED'|'POSITION_MONITORED'|'TRADE_REVIEWED'
 tradeId:string
 runLineageId:string
 strategyId:string
 instrumentId:string
 tokenAddress?:string
 leg:'NONE'
 occurredAt:string
 evidenceIds:readonly string[]
 details:Readonly<Record<string,unknown>>
 domain:'SHARK'
 authority:'TRADE_STAGE_EVENT_ONLY'
}>

export interface SharkTradeStageEventSink{
 publish(event:SharkTradeStageEmission):Promise<void>|void
}

const unique=(values:readonly string[])=>Object.freeze([...new Set(values)])

async function emit(sink:SharkTradeStageEventSink,event:SharkTradeStageEmission):Promise<void>{
 if(event.domain!=='SHARK'||event.authority!=='TRADE_STAGE_EVENT_ONLY')throw new Error('SHARK_TRADE_EVENT_AUTHORITY_INVALID')
 if(!event.tradeId.trim()||!event.runLineageId.trim()||!event.strategyId.trim()||!event.instrumentId.trim())throw new Error('SHARK_TRADE_EVENT_LINEAGE_REQUIRED')
 if(!event.evidenceIds.length)throw new Error('SHARK_TRADE_EVENT_EVIDENCE_REQUIRED')
 await sink.publish(Object.freeze({...event,evidenceIds:unique(event.evidenceIds),details:Object.freeze({...event.details})}))
}

export async function publishTokenDiscovered(input:{
 sink:SharkTradeStageEventSink
 tradeId:string
 runLineageId:string
 strategyId:string
 instrumentId:string
 tokenAddress:string
 discoveredAt:string
 source:string
 evidenceIds:readonly string[]
}):Promise<void>{
 await emit(input.sink,Object.freeze({
  type:'TOKEN_DISCOVERED',
  tradeId:input.tradeId,
  runLineageId:input.runLineageId,
  strategyId:input.strategyId,
  instrumentId:input.instrumentId,
  tokenAddress:input.tokenAddress,
  leg:'NONE',
  occurredAt:input.discoveredAt,
  evidenceIds:input.evidenceIds,
  details:Object.freeze({source:input.source,tokenAddress:input.tokenAddress}),
  domain:'SHARK',
  authority:'TRADE_STAGE_EVENT_ONLY',
 }))
}

export async function publishSharkAnalyzed(input:{
 sink:SharkTradeStageEventSink
 tradeId:string
 runLineageId:string
 strategyId:string
 assessment:MemeTradeAssessment
}):Promise<void>{
 const assessment=input.assessment
 await emit(input.sink,Object.freeze({
  type:'SHARK_ANALYZED',
  tradeId:input.tradeId,
  runLineageId:input.runLineageId,
  strategyId:input.strategyId,
  instrumentId:assessment.token.chainId+':'+assessment.token.tokenAddress,
  tokenAddress:assessment.token.tokenAddress,
  leg:'NONE',
  occurredAt:assessment.assessedAt,
  evidenceIds:assessment.evidenceIds,
  details:Object.freeze({
   assessmentId:assessment.assessmentId,
   assessmentVersion:assessment.assessmentVersion,
   confidence:assessment.confidence,
   riskBand:assessment.riskAssessment.band,
   overallRisk:assessment.riskAssessment.overallRisk,
   holderCohortScore:assessment.holderCohort.score,
   attentionScore:assessment.attention.score,
   liquidityScore:assessment.marketActivityQuality.liquidityScore,
  }),
  domain:'SHARK',
  authority:'TRADE_STAGE_EVENT_ONLY',
 }))
}

export async function publishThesisCreated(input:{
 sink:SharkTradeStageEventSink
 tradeId:string
 runLineageId:string
 strategyId:string
 thesisId:string
 assessment:MemeTradeAssessment
 createdAt:string
}):Promise<void>{
 await emit(input.sink,Object.freeze({
  type:'THESIS_CREATED',
  tradeId:input.tradeId,
  runLineageId:input.runLineageId,
  strategyId:input.strategyId,
  instrumentId:input.assessment.token.chainId+':'+input.assessment.token.tokenAddress,
  tokenAddress:input.assessment.token.tokenAddress,
  leg:'NONE',
  occurredAt:input.createdAt,
  evidenceIds:input.assessment.evidenceIds,
  details:Object.freeze({
   thesisId:input.thesisId,
   assessmentId:input.assessment.assessmentId,
   thesis:input.assessment.thesis,
   invalidationConditions:input.assessment.invalidation.conditions,
   invalidationSeverity:input.assessment.invalidation.severity,
  }),
  domain:'SHARK',
  authority:'TRADE_STAGE_EVENT_ONLY',
 }))
}

export async function publishPositionMonitored(input:{
 sink:SharkTradeStageEventSink
 tradeId:string
 runLineageId:string
 strategyId:string
 instrumentId:string
 tokenAddress:string
 reviewId:string
 review:MemePositionReview
 state:MemePositionReviewState
 observedAt:string
 evidenceIds:readonly string[]
}):Promise<void>{
 await emit(input.sink,Object.freeze({
  type:'POSITION_MONITORED',
  tradeId:input.tradeId,
  runLineageId:input.runLineageId,
  strategyId:input.strategyId,
  instrumentId:input.instrumentId,
  tokenAddress:input.tokenAddress,
  leg:'NONE',
  occurredAt:input.observedAt,
  evidenceIds:input.evidenceIds,
  details:Object.freeze({
   positionDecisionId:input.reviewId,
   action:input.review.action,
   winning:input.review.winning,
   reasonCodes:input.review.reasonCodes,
   costBasisUsd:input.state.costBasisUsd,
   currentValueUsd:input.state.currentValueUsd,
   currentPrice:input.state.currentPrice,
   liquidityUsd:input.state.liquidityUsd,
   smartWalletExitScore:input.state.smartWalletExitScore??0,
   smartWalletNetFlowUsd:input.state.smartWalletNetFlowUsd??0,
   narrativeDegradationScore:input.state.narrativeDegradationScore??0,
   whaleDistributionScore:input.state.whaleDistributionScore??0,
   whaleNetFlowUsd:input.state.whaleNetFlowUsd??0,
   thesisInvalidated:input.state.thesisInvalidated??false,
   thesisInvalidationReasons:input.state.thesisInvalidationReasons??[],
  }),
  domain:'SHARK',
  authority:'TRADE_STAGE_EVENT_ONLY',
 }))
}

export async function publishTradeReviewed(input:{
 sink:SharkTradeStageEventSink
 learning:ClosedMemeTradeLearningRecord
 tokenAddress?:string
}):Promise<void>{
 const learning=input.learning
 await emit(input.sink,Object.freeze({
  type:'TRADE_REVIEWED',
  tradeId:learning.tradeId,
  runLineageId:learning.runLineageId,
  strategyId:learning.strategyId,
  instrumentId:learning.instrumentId,
  tokenAddress:input.tokenAddress,
  leg:'NONE',
  occurredAt:learning.createdAt,
  evidenceIds:learning.evidenceIds,
  details:Object.freeze({
   reviewId:learning.learningRecordId,
   sourceAssessmentId:learning.sourceAssessmentId,
   sourceThesisId:learning.sourceThesisId,
   signalsWorked:learning.signalsWorked,
   signalsFailed:learning.signalsFailed,
   signalAttribution:learning.signalAttribution,
   exitReasonCodes:learning.exitReasonCodes,
   sizing:learning.sizing,
   execution:learning.execution,
   narrative:learning.narrative,
   realized:learning.realized,
   lessonTags:learning.lessonTags,
  }),
  domain:'SHARK',
  authority:'TRADE_STAGE_EVENT_ONLY',
 }))
}
