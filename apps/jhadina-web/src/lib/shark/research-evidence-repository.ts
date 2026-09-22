import type { SupabaseClient } from '@supabase/supabase-js'
import {
  assertMeteoraDlmmCashFlowEvidence,
  assertMeteoraDlmmPositionStateEvidence,
  assertWalletBuyEvidence,
  assertWalletClusterCalibrationObservation,
  assertWalletResearchScoreEvidence,
  deriveWalletClusterCalibrationObservations,
  evaluateWalletClusterThresholdSensitivity,
  normalizeChainAddress,
  reconcileMeteoraDlmmCashFlowProfitabilityFromState,
  type LaunchOutcome,
  type MeteoraDlmmCashFlowEvidence,
  type MeteoraDlmmPositionStateEvidence,
  type MeteoraDlmmProfitabilityEvidence,
  type WalletBuyEvidence,
  type WalletClusterCalibrationObservation,
  type WalletClusterCalibrationReport,
  type WalletClusterOutcomeEvidence,
  type WalletClusterThresholdSpec,
  type WalletResearchScoreEvidence,
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

export async function appendWalletResearchScoreEvidence(
  client:SupabaseClient,
  input:{score:WalletResearchScoreEvidence;source:string},
):Promise<SharkResearchAppendDisposition>{
  assertWalletResearchScoreEvidence(input.score)
  nonEmpty(input.source,'SHARK_WALLET_SCORE_RUNTIME_SOURCE_REQUIRED')
  const chainId=input.score.chainId.trim()
  const payload={
    scoreId:input.score.scoreId,
    chainId,
    walletId:normalizeChainAddress(chainId,input.score.walletId),
    scoreModelId:input.score.scoreModelId,
    score:input.score.score,
    informationCutoff:input.score.informationCutoff,
    observedAt:input.score.observedAt,
    availableAt:input.score.availableAt,
    evidenceIds:sortedUnique(input.score.evidenceIds),
    authority:'RESEARCH_ONLY' as const,
    source:input.source.trim(),
  }
  const {data,error}=await client.rpc('jhadina_shark_append_wallet_score_evidence',{p_payload:payload})
  if(error)throw new Error(`SHARK wallet score append failed: ${error.message}`)
  return appendResult(data,'SHARK_WALLET_SCORE_RUNTIME_APPEND_RESULT_INVALID')
}

export async function appendWalletBuyEvidence(
  client:SupabaseClient,
  input:{buy:WalletBuyEvidence;source?:string},
):Promise<SharkResearchAppendDisposition>{
  assertWalletBuyEvidence(input.buy)
  const chainId=input.buy.chainId.trim()
  const source=(input.source??input.buy.source).trim()
  nonEmpty(source,'SHARK_WALLET_BUY_RUNTIME_SOURCE_REQUIRED')
  const payload={
    evidenceId:input.buy.evidenceId,
    signature:input.buy.signature,
    chainId,
    tokenAddress:normalizeChainAddress(chainId,input.buy.tokenAddress),
    walletId:normalizeChainAddress(chainId,input.buy.walletId),
    ...(input.buy.amountUsd===undefined?{}:{amountUsd:input.buy.amountUsd}),
    observedAt:input.buy.observedAt,
    availableAt:input.buy.availableAt,
    evidenceIds:sortedUnique(input.buy.evidenceIds),
    source,
  }
  const {data,error}=await client.rpc('jhadina_shark_append_wallet_buy_evidence',{p_payload:payload})
  if(error)throw new Error(`SHARK wallet buy append failed: ${error.message}`)
  return appendResult(data,'SHARK_WALLET_BUY_RUNTIME_APPEND_RESULT_INVALID')
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
    scoreModelId:input.observation.scoreModelId,
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
  input:{informationCutoff:string;scoreModelId:string;thresholds?:readonly WalletClusterThresholdSpec[];limit?:number},
):Promise<WalletClusterCalibrationReport>{
  nonEmpty(input.scoreModelId,'SHARK_CLUSTER_RUNTIME_SCORE_MODEL_REQUIRED')
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
    scoreModelId:input.scoreModelId,
    informationCutoff:input.informationCutoff,
  })
}

function scoreFromPayload(payload:any):WalletResearchScoreEvidence{
  return {
    scoreId:String(payload.scoreId),
    chainId:String(payload.chainId),
    walletId:String(payload.walletId),
    scoreModelId:String(payload.scoreModelId),
    score:Number(payload.score),
    informationCutoff:String(payload.informationCutoff),
    observedAt:String(payload.observedAt),
    availableAt:String(payload.availableAt),
    evidenceIds:Array.isArray(payload.evidenceIds)?payload.evidenceIds.map(String):[],
    authority:'RESEARCH_ONLY',
  }
}

function buyFromPayload(payload:any):WalletBuyEvidence{
  return {
    evidenceId:String(payload.evidenceId),
    signature:String(payload.signature),
    chainId:String(payload.chainId),
    tokenAddress:String(payload.tokenAddress),
    walletId:String(payload.walletId),
    ...(payload.amountUsd===undefined?{}:{amountUsd:Number(payload.amountUsd)}),
    observedAt:String(payload.observedAt),
    availableAt:String(payload.availableAt),
    evidenceIds:Array.isArray(payload.evidenceIds)?payload.evidenceIds.map(String):[],
    source:String(payload.source),
  }
}

export async function runPersistedWalletClusterCalibrationProducer(
  client:SupabaseClient,
  input:{scoreModelId:string;limit?:number},
):Promise<Readonly<{tokens:number;emitted:number;inserted:number;replayed:number;skippedUnlabeled:number}>>{
  nonEmpty(input.scoreModelId,'SHARK_CLUSTER_PRODUCER_SCORE_MODEL_REQUIRED')
  const limit=limitValue(input.limit,'SHARK_CLUSTER_PRODUCER_LIMIT_INVALID')

  const {data:buyRows,error:buyError}=await client
    .from('jhadina_shark_wallet_buy_evidence')
    .select('payload')
    .order('available_at',{ascending:true})
    .limit(limit+1)
  if(buyError)throw new Error(`SHARK wallet buy load failed: ${buyError.message}`)
  if((buyRows??[]).length>limit)throw new Error('SHARK_CLUSTER_PRODUCER_BUY_WINDOW_TRUNCATED')
  const buys=(buyRows??[]).map((row:any)=>buyFromPayload(row.payload))

  const {data:scoreRows,error:scoreError}=await client
    .from('jhadina_shark_wallet_score_evidence')
    .select('payload')
    .eq('score_model_id',input.scoreModelId)
    .order('available_at',{ascending:true})
    .limit(limit+1)
  if(scoreError)throw new Error(`SHARK wallet score load failed: ${scoreError.message}`)
  if((scoreRows??[]).length>limit)throw new Error('SHARK_CLUSTER_PRODUCER_SCORE_WINDOW_TRUNCATED')
  const scores=(scoreRows??[]).map((row:any)=>scoreFromPayload(row.payload))

  const tokenAddresses=[...new Set(buys.map(b=>b.tokenAddress))]
  if(!tokenAddresses.length)return Object.freeze({tokens:0,emitted:0,inserted:0,replayed:0,skippedUnlabeled:0})

  const {data:launchRows,error:launchError}=await client
    .from('jhadina_token_launches')
    .select('launch_id,chain_id,token_address,outcome,outcome_observed_at,evidence_ids,updated_at')
    .in('token_address',tokenAddresses)
    .limit(limit+1)
  if(launchError)throw new Error(`SHARK cluster producer launch load failed: ${launchError.message}`)
  if((launchRows??[]).length>limit)throw new Error('SHARK_CLUSTER_PRODUCER_LAUNCH_WINDOW_TRUNCATED')

  const groups=new Map<string,{chainId:string;tokenAddress:string;buys:WalletBuyEvidence[]}>()
  for(const buy of buys){
    const key=JSON.stringify([buy.chainId,buy.tokenAddress])
    const existing=groups.get(key)??{chainId:buy.chainId,tokenAddress:buy.tokenAddress,buys:[]}
    existing.buys.push(buy)
    groups.set(key,existing)
  }

  let emitted=0,inserted=0,replayed=0,skippedUnlabeled=0
  for(const {chainId,tokenAddress,buys:groupBuys} of groups.values()){
    const launch=(launchRows??[]).find((row:any)=>row.chain_id===chainId&&row.token_address===tokenAddress)
    if(!launch||launch.outcome==='UNKNOWN'||!launch.outcome_observed_at){
      skippedUnlabeled+=1
      continue
    }
    const outcome:WalletClusterOutcomeEvidence={
      tokenId:String(launch.launch_id),
      outcome:String(launch.outcome) as LaunchOutcome,
      observedAt:String(launch.outcome_observed_at),
      availableAt:String(launch.updated_at??launch.outcome_observed_at),
      evidenceIds:Array.isArray(launch.evidence_ids)?launch.evidence_ids.map(String):[],
    }
    const observations=deriveWalletClusterCalibrationObservations({
      chainId,
      tokenAddress,
      tokenId:String(launch.launch_id),
      scoreModelId:input.scoreModelId,
      buys:groupBuys,
      scores,
      outcome,
    })
    for(const observation of observations){
      emitted+=1
      const disposition=await appendWalletClusterCalibrationObservation(client,{
        observation,
        source:`wallet-cluster-evidence-producer:${input.scoreModelId}`,
      })
      if(disposition==='INSERTED')inserted+=1
      else replayed+=1
    }
  }
  return Object.freeze({tokens:groups.size,emitted,inserted,replayed,skippedUnlabeled})
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
