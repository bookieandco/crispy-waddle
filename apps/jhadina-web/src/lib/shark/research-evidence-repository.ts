import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertMeteoraDlmmCashFlowEvidence,
  assertMeteoraDlmmPositionStateEvidence,
  assertWalletClusterCalibrationObservation,
  evaluateWalletClusterThresholdSensitivity,
  reconcileMeteoraDlmmCashFlowProfitabilityFromState,
  type MeteoraDlmmCashFlowEvidence,
  type MeteoraDlmmPositionStateEvidence,
  type MeteoraDlmmProfitabilityEvidence,
  type WalletClusterCalibrationObservation,
  type WalletClusterCalibrationReport,
  type WalletClusterThresholdSpec,
  createExternalSignalOutcome,
  summarizeExternalSignalSource,
  type ExternalSignalOutcome,
  type ExternalSignalPlatform,
  type ExternalSignalSourceSummary,
  type MemeTradeAssessment,
} from '@jhadina/shark-intelligence-core/meme-trader'

export type SharkResearchAppendDisposition='INSERTED'|'REPLAY'

export const SHARK_RESEARCH_CLUSTER_THRESHOLD_GRID:readonly WalletClusterThresholdSpec[]=Object.freeze(
  [2,3,4].flatMap(minWallets=>
    [300,900,1800].flatMap(maxWindowSeconds=>
      [4,6,9].map(minAggregateWalletScore=>Object.freeze({
        thresholdId:`w${minWallets}-t${maxWindowSeconds}-s${minAggregateWalletScore}`,
        minWallets,
        maxWindowSeconds,
        minAggregateWalletScore,
      }))
    )
  )
)

const nonEmpty=(value:string,code:string)=>{if(!value.trim())throw new Error(code)}
const limitValue=(value:number|undefined,code:string)=>{
  const limit=value??5000
  if(!Number.isInteger(limit)||limit<1||limit>20000)throw new Error(code)
  return limit
}
const sortedUnique=(values:readonly string[])=>[...new Set(values)].sort()

function appendResult(value:unknown,code:string):SharkResearchAppendDisposition{
  if(value==='INSERTED'||value==='REPLAY')return value
  throw new Error(code)
}

export async function appendWalletClusterCalibrationObservation(
  client:SupabaseClient,
  input:{observation:WalletClusterCalibrationObservation;source:string},
):Promise<SharkResearchAppendDisposition>{
  assertWalletClusterCalibrationObservation(input.observation)
  nonEmpty(input.source,'SHARK_CLUSTER_RUNTIME_SOURCE_REQUIRED')
  const payload={
    observationId:input.observation.observationId,
    tokenId:input.observation.tokenId,
    distinctWallets:input.observation.distinctWallets,
    windowSeconds:input.observation.windowSeconds,
    aggregateWalletScore:input.observation.aggregateWalletScore,
    ...(input.observation.totalUsd===undefined?{}:{totalUsd:input.observation.totalUsd}),
    observedAt:input.observation.observedAt,
    availableAt:input.observation.availableAt,
    outcome:input.observation.outcome,
    evidenceIds:sortedUnique(input.observation.evidenceIds),
    source:input.source.trim(),
  }
  const {data,error}=await client.rpc('jhadina_shark_append_cluster_calibration_observation',{p_payload:payload})
  if(error)throw new Error(`SHARK cluster calibration append failed: ${error.message}`)
  return appendResult(data,'SHARK_CLUSTER_RUNTIME_APPEND_RESULT_INVALID')
}

export async function evaluatePersistedWalletClusterCalibration(
  client:SupabaseClient,
  input:{informationCutoff:string;thresholds?:readonly WalletClusterThresholdSpec[];limit?:number},
):Promise<WalletClusterCalibrationReport>{
  const limit=limitValue(input.limit,'SHARK_CLUSTER_RUNTIME_LIMIT_INVALID')
  const {data,error}=await client
    .from('jhadina_shark_wallet_cluster_calibration_observations')
    .select('payload')
    .order('available_at',{ascending:true})
    .limit(limit+1)
  if(error)throw new Error(`SHARK cluster calibration load failed: ${error.message}`)
  const rows=data??[]
  if(rows.length>limit)throw new Error('SHARK_CLUSTER_RUNTIME_WINDOW_TRUNCATED')
  const observations=rows.map((row:any)=>row.payload as WalletClusterCalibrationObservation)
  return evaluateWalletClusterThresholdSensitivity({
    observations,
    thresholds:input.thresholds??SHARK_RESEARCH_CLUSTER_THRESHOLD_GRID,
    informationCutoff:input.informationCutoff,
  })
}

export async function appendMeteoraCashFlowEvidence(
  client:SupabaseClient,
  input:{flow:MeteoraDlmmCashFlowEvidence;source:string},
):Promise<SharkResearchAppendDisposition>{
  assertMeteoraDlmmCashFlowEvidence(input.flow)
  nonEmpty(input.source,'SHARK_METEORA_RUNTIME_SOURCE_REQUIRED')
  const payload={
    evidenceId:input.flow.evidenceId,
    transactionId:input.flow.transactionId,
    position:input.flow.position,
    kind:input.flow.kind,
    amountMinor:input.flow.amountMinor.toString(),
    currency:input.flow.currency,
    amountSemantics:input.flow.amountSemantics,
    valuationEvidenceIds:sortedUnique(input.flow.valuationEvidenceIds),
    observedAt:input.flow.observedAt,
    availableAt:input.flow.availableAt,
    source:input.source.trim(),
  }
  const {data,error}=await client.rpc('jhadina_shark_append_meteora_cash_flow',{p_payload:payload})
  if(error)throw new Error(`SHARK Meteora cash-flow append failed: ${error.message}`)
  return appendResult(data,'SHARK_METEORA_RUNTIME_APPEND_RESULT_INVALID')
}

export async function appendMeteoraPositionStateEvidence(
  client:SupabaseClient,
  input:{state:MeteoraDlmmPositionStateEvidence;source:string},
):Promise<SharkResearchAppendDisposition>{
  assertMeteoraDlmmPositionStateEvidence(input.state)
  nonEmpty(input.source,'SHARK_METEORA_RUNTIME_SOURCE_REQUIRED')
  const payload={
    stateId:input.state.stateId,
    position:input.state.position,
    currency:input.state.currency,
    positionClosed:input.state.positionClosed,
    transactionHistoryComplete:input.state.transactionHistoryComplete,
    observedAt:input.state.observedAt,
    availableAt:input.state.availableAt,
    evidenceIds:sortedUnique(input.state.evidenceIds),
    source:input.source.trim(),
  }
  const {data,error}=await client.rpc('jhadina_shark_append_meteora_position_state',{p_payload:payload})
  if(error)throw new Error(`SHARK Meteora position-state append failed: ${error.message}`)
  return appendResult(data,'SHARK_METEORA_RUNTIME_APPEND_RESULT_INVALID')
}

function flowFromPayload(payload:any):MeteoraDlmmCashFlowEvidence{
  return {
    evidenceId:String(payload.evidenceId),
    transactionId:String(payload.transactionId),
    position:String(payload.position),
    kind:payload.kind,
    amountMinor:BigInt(String(payload.amountMinor)),
    currency:String(payload.currency),
    amountSemantics:payload.amountSemantics,
    valuationEvidenceIds:Array.isArray(payload.valuationEvidenceIds)?payload.valuationEvidenceIds.map(String):[],
    observedAt:String(payload.observedAt),
    availableAt:String(payload.availableAt),
  }
}

function stateFromPayload(payload:any):MeteoraDlmmPositionStateEvidence{
  return {
    stateId:String(payload.stateId),
    position:String(payload.position),
    currency:String(payload.currency),
    positionClosed:payload.positionClosed===true,
    transactionHistoryComplete:payload.transactionHistoryComplete===true,
    observedAt:String(payload.observedAt),
    availableAt:String(payload.availableAt),
    evidenceIds:Array.isArray(payload.evidenceIds)?payload.evidenceIds.map(String):[],
  }
}

export async function evaluatePersistedMeteoraProfitability(
  client:SupabaseClient,
  input:{position:string;currency:string;informationCutoff:string;limit?:number},
):Promise<MeteoraDlmmProfitabilityEvidence>{
  nonEmpty(input.position,'SHARK_METEORA_RUNTIME_POSITION_REQUIRED')
  nonEmpty(input.currency,'SHARK_METEORA_RUNTIME_CURRENCY_REQUIRED')
  const limit=limitValue(input.limit,'SHARK_METEORA_RUNTIME_LIMIT_INVALID')

  const {data:flowRows,error:flowError}=await client
    .from('jhadina_shark_meteora_cash_flow_evidence')
    .select('payload')
    .eq('position',input.position)
    .eq('currency',input.currency)
    .order('available_at',{ascending:true})
    .limit(limit+1)
  if(flowError)throw new Error(`SHARK Meteora cash-flow load failed: ${flowError.message}`)
  const flowData=flowRows??[]
  if(flowData.length>limit)throw new Error('SHARK_METEORA_RUNTIME_WINDOW_TRUNCATED')

  const {data:stateRows,error:stateError}=await client
    .from('jhadina_shark_meteora_position_state_evidence')
    .select('payload')
    .eq('position',input.position)
    .eq('currency',input.currency)
    .lte('available_at',input.informationCutoff)
    .order('available_at',{ascending:false})
    .limit(1)
  if(stateError)throw new Error(`SHARK Meteora position-state load failed: ${stateError.message}`)
  const statePayload=stateRows?.[0]?.payload
  if(!statePayload)throw new Error('SHARK_METEORA_POSITION_STATE_REQUIRED')

  return reconcileMeteoraDlmmCashFlowProfitabilityFromState({
    position:input.position,
    currency:input.currency,
    informationCutoff:input.informationCutoff,
    flows:flowData.map((row:any)=>flowFromPayload(row.payload)),
    state:stateFromPayload(statePayload),
  })
}


export async function appendMemeTradeAssessmentEvidence(
  client:SupabaseClient,
  input:{assessment:MemeTradeAssessment;informationCutoff:string;source:string},
):Promise<SharkResearchAppendDisposition>{
  nonEmpty(input.source,'SHARK_MEME_ASSESSMENT_SOURCE_REQUIRED')
  if(!input.assessment.assessmentId.trim()||!input.assessment.token.chainId.trim()||!input.assessment.token.tokenAddress.trim())throw new Error('SHARK_MEME_ASSESSMENT_IDENTITY_REQUIRED')
  if(!input.assessment.evidenceIds.length)throw new Error('SHARK_MEME_ASSESSMENT_EVIDENCE_REQUIRED')
  if(Number.isNaN(Date.parse(input.informationCutoff)))throw new Error('SHARK_MEME_ASSESSMENT_CUTOFF_INVALID')
  if(Number.isNaN(Date.parse(input.assessment.assessedAt))||Date.parse(input.informationCutoff)>Date.parse(input.assessment.assessedAt))throw new Error('SHARK_MEME_ASSESSMENT_CLOCK_INVALID')
  const payload={
    assessmentId:input.assessment.assessmentId,
    chainId:input.assessment.token.chainId,
    tokenAddress:input.assessment.token.tokenAddress,
    assessedAt:input.assessment.assessedAt,
    informationCutoff:input.informationCutoff,
    riskBand:input.assessment.riskAssessment.band,
    confidence:input.assessment.confidence,
    evidenceIds:sortedUnique(input.assessment.evidenceIds),
    source:input.source.trim(),
    assessment:input.assessment,
  }
  const {data,error}=await client.rpc('jhadina_shark_append_meme_trade_assessment',{p_payload:payload})
  if(error)throw new Error(`SHARK meme assessment append failed: ${error.message}`)
  return appendResult(data,'SHARK_MEME_ASSESSMENT_APPEND_RESULT_INVALID')
}

export async function appendExternalSignalOutcomeEvidence(
  client:SupabaseClient,
  input:{outcome:ExternalSignalOutcome;source:string},
):Promise<SharkResearchAppendDisposition>{
  nonEmpty(input.source,'SHARK_EXTERNAL_SIGNAL_OUTCOME_SOURCE_REQUIRED')
  if(input.outcome.authority!=='LEARNING_ONLY'||input.outcome.canAuthorizeTrade!==false||input.outcome.canAutoCopy!==false)throw new Error('SHARK_EXTERNAL_SIGNAL_OUTCOME_AUTHORITY_INVALID')
  const payload={
    outcomeId:input.outcome.outcomeId,
    platform:input.outcome.platform,
    sourceHandle:input.outcome.sourceHandle,
    channelId:input.outcome.channelId??null,
    signalObservationId:input.outcome.signalObservationId,
    tokenCandidate:input.outcome.tokenCandidate,
    observedAt:input.outcome.observedAt,
    resolvedAt:input.outcome.resolvedAt,
    leadTimeMs:input.outcome.leadTimeMs,
    executionLatencyMs:input.outcome.executionLatencyMs,
    callMarketCapUsd:input.outcome.callMarketCapUsd,
    maxFavorableExcursionBps:input.outcome.maxFavorableExcursionBps,
    maxAdverseExcursionBps:input.outcome.maxAdverseExcursionBps,
    firstIndependentCaller:input.outcome.firstIndependentCaller,
    migrated:input.outcome.migrated,
    rug:input.outcome.rug,
    executableReturnBps:input.outcome.executableReturnBps,
    independentDiscovery:input.outcome.independentDiscovery,
    evidenceIds:sortedUnique(input.outcome.evidenceIds),
    source:input.source.trim(),
  }
  const {data,error}=await client.rpc('jhadina_shark_append_external_signal_outcome',{p_payload:payload})
  if(error)throw new Error(`SHARK external signal outcome append failed: ${error.message}`)
  return appendResult(data,'SHARK_EXTERNAL_SIGNAL_OUTCOME_APPEND_RESULT_INVALID')
}

const optionalNumber=(value:unknown):number|undefined=>{
  if(value===undefined||value===null||value==='')return undefined
  const n=Number(value)
  if(!Number.isFinite(n))throw new Error('SHARK_EXTERNAL_SIGNAL_OUTCOME_NUMBER_INVALID')
  return n
}
const optionalBoolean=(value:unknown):boolean|undefined=>value===true?true:value===false?false:undefined

function externalSignalOutcomeFromPayload(payload:any):ExternalSignalOutcome{
  return createExternalSignalOutcome({
    outcomeId:String(payload.outcomeId??''),
    platform:String(payload.platform??'') as ExternalSignalPlatform,
    sourceHandle:String(payload.sourceHandle??''),
    channelId:payload.channelId===undefined||payload.channelId===null?undefined:String(payload.channelId),
    signalObservationId:String(payload.signalObservationId??''),
    tokenCandidate:String(payload.tokenCandidate??''),
    observedAt:String(payload.observedAt??''),
    resolvedAt:String(payload.resolvedAt??''),
    leadTimeMs:optionalNumber(payload.leadTimeMs),
    executionLatencyMs:optionalNumber(payload.executionLatencyMs),
    callMarketCapUsd:optionalNumber(payload.callMarketCapUsd),
    maxFavorableExcursionBps:optionalNumber(payload.maxFavorableExcursionBps),
    maxAdverseExcursionBps:optionalNumber(payload.maxAdverseExcursionBps),
    firstIndependentCaller:optionalBoolean(payload.firstIndependentCaller),
    migrated:optionalBoolean(payload.migrated),
    rug:optionalBoolean(payload.rug),
    executableReturnBps:optionalNumber(payload.executableReturnBps),
    independentDiscovery:optionalBoolean(payload.independentDiscovery),
    evidenceIds:Array.isArray(payload.evidenceIds)?payload.evidenceIds.map(String):[],
  })
}

export async function summarizePersistedExternalSignalSource(
  client:SupabaseClient,
  input:{platform:ExternalSignalPlatform;sourceHandle:string;channelId?:string;limit?:number},
):Promise<ExternalSignalSourceSummary>{
  nonEmpty(input.sourceHandle,'SHARK_EXTERNAL_SIGNAL_SOURCE_HANDLE_REQUIRED')
  const limit=limitValue(input.limit,'SHARK_EXTERNAL_SIGNAL_SOURCE_LIMIT_INVALID')
  let query=client
    .from('jhadina_shark_external_signal_outcomes')
    .select('payload')
    .eq('platform',input.platform)
    .eq('source_handle',input.sourceHandle)
    .order('resolved_at',{ascending:true})
    .limit(limit+1)
  query=input.channelId===undefined?query.is('channel_id',null):query.eq('channel_id',input.channelId)
  const {data,error}=await query
  if(error)throw new Error(`SHARK external signal source load failed: ${error.message}`)
  const rows=data??[]
  if(rows.length>limit)throw new Error('SHARK_EXTERNAL_SIGNAL_SOURCE_WINDOW_TRUNCATED')
  if(!rows.length)throw new Error('SHARK_EXTERNAL_SIGNAL_SOURCE_OUTCOMES_REQUIRED')
  return summarizeExternalSignalSource(rows.map((row:any)=>externalSignalOutcomeFromPayload(row.payload)))
}
