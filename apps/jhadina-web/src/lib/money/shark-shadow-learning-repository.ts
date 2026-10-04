import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {
  SharkShadowCounterfactualLesson,
  SharkShadowDecisionTwin,
  SharkShadowExecutionSimulation,
  SharkShadowMemoryCard,
  SharkShadowOutcomeObservation,
  SharkShadowPerformanceCalibration,
  SharkShadowReplayManifest,
} from '@jhadina/money-core'

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const encode=(v:unknown)=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x))
const strings=(v:unknown)=>Array.isArray(v)?v.map(String):[]
const big=(v:unknown,code:string)=>{try{return BigInt(String(v))}catch{throw new Error(code)}}
const iso=(v:string,code:string)=>{if(!v||Number.isNaN(Date.parse(v)))throw new Error(code)}

export type ShadowRuntimeCandidate=Readonly<{
  runId:string
  envelopeId:string
  charterId:string
  userId:string
  cofferId:string
  disposition:SharkShadowDecisionTwin['runtimeDisposition']
  opportunityId?:string
  rebalancePlanId?:string
  runJson:unknown
  informationCutoff:string
  completedAt:string
  evidenceIds:readonly string[]
}>

export type ShadowIngressContext=Readonly<{
  chainId:string
  tokenAddress:string
  envelope:any
  market:any
}>

export type ShadowExecutionHint=Readonly<{
  proposedNotionalMinor:bigint
  side?:'BUY'|'SELL'
  routeSource:'EXECUTION_PACKAGE'|'LIQUIDITY_MODEL'
  evidenceIds:readonly string[]
}>

export type HistoricalLaunchObservation=Readonly<{
  observationId:string
  observedAt:string
  priceReturnFromLaunchPct?:number
  peakReturnPct?:number
  maxDrawdownPct?:number
  initialLiquidityUsd?:number
  currentLiquidityUsd?:number
  liquidityRemoved?:boolean
  tradingHalted?:boolean
  evidenceIds:readonly string[]
}>

async function insertReplaySafe(client:SupabaseClient,input:{
  table:string
  idColumn:string
  id:string
  row:Record<string,unknown>
  compareColumns:readonly string[]
  code:string
}):Promise<'INSERTED'|'REPLAY'>{
  const {data,error}=await client.from(input.table).insert(input.row).select(input.idColumn).maybeSingle()
  if(!error&&data)return 'INSERTED'
  if(error?.code!=='23505')throw new Error(input.code+'_WRITE_FAILED:'+(error?.message??'unknown'))
  const {data:prior,error:readError}=await client.from(input.table).select(input.compareColumns.join(',')).eq(input.idColumn,input.id).maybeSingle()
  if(readError||!prior)throw new Error(input.code+'_REPLAY_READ_FAILED:'+(readError?.message??'missing'))
  for(const col of input.compareColumns){
    if(hash((prior as any)[col])!==hash((input.row as any)[col]))throw new Error(input.code+'_CONFLICT')
  }
  return 'REPLAY'
}

export async function listShadowRuntimeCandidates(client:SupabaseClient,input:{since:string;now:string;limit:number}):Promise<readonly ShadowRuntimeCandidate[]>{
  iso(input.since,'SHADOW_RUNTIME_SINCE_INVALID');iso(input.now,'SHADOW_RUNTIME_NOW_INVALID')
  const limit=Math.max(1,Math.min(1000,Math.trunc(input.limit)))
  const {data,error}=await client.from('money_shark_coffer_runtime_runs')
    .select('run_id,envelope_id,charter_id,user_id,coffer_id,disposition,opportunity_id,rebalance_plan_id,run_json,information_cutoff,completed_at,evidence_ids')
    .in('disposition',['BLOCKED','PURSE_REJECTED','ALLOCATED','AUTONOMOUS_INTENT_READY'])
    .gte('completed_at',input.since).lte('completed_at',input.now)
    .order('completed_at',{ascending:true}).limit(limit)
  if(error)throw new Error('SHADOW_RUNTIME_CANDIDATE_READ_FAILED:'+error.message)
  return Object.freeze((data??[]).map((r:any)=>Object.freeze({
    runId:String(r.run_id),envelopeId:String(r.envelope_id),charterId:String(r.charter_id),userId:String(r.user_id),cofferId:String(r.coffer_id),
    disposition:r.disposition,opportunityId:r.opportunity_id?String(r.opportunity_id):undefined,rebalancePlanId:r.rebalance_plan_id?String(r.rebalance_plan_id):undefined,
    runJson:r.run_json,informationCutoff:String(r.information_cutoff),completedAt:String(r.completed_at),evidenceIds:Object.freeze(strings(r.evidence_ids)),
  })))
}

export async function loadShadowCharterMode(client:SupabaseClient,charterId:string):Promise<string|undefined>{
  const {data,error}=await client.from('money_purse_charters').select('autonomy_mode').eq('charter_id',charterId).maybeSingle()
  if(error)throw new Error('SHADOW_CHARTER_READ_FAILED:'+error.message)
  return data?String((data as any).autonomy_mode):undefined
}

export async function loadShadowIngressContext(client:SupabaseClient,envelopeId:string):Promise<ShadowIngressContext>{
  const {data,error}=await client.from('money_shark_runtime_ingress')
    .select('chain_id,token_address,envelope_json,market_evidence_json').eq('envelope_id',envelopeId).maybeSingle()
  if(error||!data)throw new Error('SHADOW_INGRESS_READ_FAILED:'+(error?.message??'missing'))
  const r=data as any
  return Object.freeze({chainId:String(r.chain_id),tokenAddress:String(r.token_address),envelope:r.envelope_json,market:r.market_evidence_json})
}

export async function loadShadowInstrumentId(client:SupabaseClient,opportunityId:string|undefined,chainId:string,tokenAddress:string):Promise<string>{
  if(opportunityId){
    const {data,error}=await client.from('money_opportunities_v2').select('instrument_id').eq('opportunity_id',opportunityId).maybeSingle()
    if(error)throw new Error('SHADOW_OPPORTUNITY_READ_FAILED:'+error.message)
    const id=(data as any)?.instrument_id
    if(typeof id==='string'&&id.trim())return id
  }
  return 'meme:'+chainId+':'+tokenAddress
}

export async function loadShadowExecutionHint(client:SupabaseClient,input:{
  envelopeId:string
  charterId:string
  opportunityId?:string
  defaultNotionalMinor:bigint
}):Promise<ShadowExecutionHint>{
  if(input.opportunityId){
    const {data,error}=await client.from('money_shark_execution_packages')
      .select('canonical_intent_json,execution_plan_json,evidence_ids')
      .eq('envelope_id',input.envelopeId).eq('charter_id',input.charterId).eq('opportunity_id',input.opportunityId)
      .order('observed_at',{ascending:false}).limit(1).maybeSingle()
    if(error)throw new Error('SHADOW_EXECUTION_HINT_READ_FAILED:'+error.message)
    if(data){
      const r=data as any
      const raw=r.canonical_intent_json?.notional?.minor
      const side=r.execution_plan_json?.side
      const n=raw===undefined?input.defaultNotionalMinor:big(raw,'SHADOW_EXECUTION_HINT_NOTIONAL_INVALID')
      return Object.freeze({
        proposedNotionalMinor:n>0n?n:input.defaultNotionalMinor,
        side:side==='SELL'?'SELL':'BUY',
        routeSource:'EXECUTION_PACKAGE',
        evidenceIds:Object.freeze(strings(r.evidence_ids)),
      })
    }
  }
  return Object.freeze({proposedNotionalMinor:input.defaultNotionalMinor,side:'BUY',routeSource:'LIQUIDITY_MODEL',evidenceIds:Object.freeze([])})
}

function decodeDecision(raw:any):SharkShadowDecisionTwin{
  return Object.freeze({
    ...raw,
    proposedNotionalMinor:big(raw.proposedNotionalMinor,'SHADOW_DECISION_NOTIONAL_DECODE'),
    sourceGroups:Object.freeze(strings(raw.sourceGroups)),
    market:Object.freeze({...raw.market,evidenceIds:Object.freeze(strings(raw.market?.evidenceIds))}),
    reasonCodes:Object.freeze(strings(raw.reasonCodes)),
    evidenceIds:Object.freeze(strings(raw.evidenceIds)),
    canExecute:false,
  }) as SharkShadowDecisionTwin
}
function decodeExecution(raw:any):SharkShadowExecutionSimulation{
  return Object.freeze({
    ...raw,
    requestedNotionalMinor:big(raw.requestedNotionalMinor,'SHADOW_EXECUTION_REQUESTED_DECODE'),
    estimatedFilledMinor:big(raw.estimatedFilledMinor,'SHADOW_EXECUTION_FILLED_DECODE'),
    evidenceIds:Object.freeze(strings(raw.evidenceIds)),
    canSign:false,canBroadcast:false,canExecute:false,
  }) as SharkShadowExecutionSimulation
}

export async function appendShadowDecision(client:SupabaseClient,d:SharkShadowDecisionTwin):Promise<'INSERTED'|'REPLAY'>{
  if(d.canExecute!==false||d.authority!=='SHADOW_DECISION_ONLY')throw new Error('SHADOW_DECISION_AUTHORITY_INVALID')
  return insertReplaySafe(client,{table:'money_shark_shadow_decisions',idColumn:'decision_id',id:d.decisionId,row:{
    decision_id:d.decisionId,runtime_run_id:d.runtimeRunId,envelope_id:d.envelopeId,charter_id:d.charterId,user_id:d.userId,coffer_id:d.cofferId,
    opportunity_id:d.opportunityId??null,chain_id:d.chainId,token_address:d.tokenAddress,instrument_id:d.instrumentId,strategy_id:d.strategyId,
    action:d.action,side:d.side??null,runtime_disposition:d.runtimeDisposition,confidence_bps:d.confidenceBps,source_risk_bps:d.sourceRiskBps,
    market_regime:d.marketRegime,decision_json:encode(d),information_cutoff:d.informationCutoff,decided_at:d.decidedAt,evidence_ids:[...d.evidenceIds],
    authority:'SHADOW_DECISION_ONLY',can_execute:false,
  },compareColumns:['runtime_run_id','decision_json'],code:'SHADOW_DECISION'})
}

export async function findShadowDecisionByRuntimeRun(client:SupabaseClient,runId:string):Promise<SharkShadowDecisionTwin|undefined>{
  const {data,error}=await client.from('money_shark_shadow_decisions').select('decision_json').eq('runtime_run_id',runId).maybeSingle()
  if(error)throw new Error('SHADOW_DECISION_LOOKUP_FAILED:'+error.message)
  return data?decodeDecision((data as any).decision_json):undefined
}

export async function appendShadowExecution(client:SupabaseClient,s:SharkShadowExecutionSimulation):Promise<'INSERTED'|'REPLAY'>{
  if(s.canSign!==false||s.canBroadcast!==false||s.canExecute!==false)throw new Error('SHADOW_EXECUTION_AUTHORITY_INVALID')
  return insertReplaySafe(client,{table:'money_shark_shadow_executions',idColumn:'simulation_id',id:s.simulationId,row:{
    simulation_id:s.simulationId,decision_id:s.decisionId,requested_notional_minor:s.requestedNotionalMinor.toString(),estimated_filled_minor:s.estimatedFilledMinor.toString(),
    fill_ratio_bps:s.fillRatioBps,total_estimated_cost_bps:s.totalEstimatedCostBps,execution_json:encode(s),simulated_at:s.simulatedAt,evidence_ids:[...s.evidenceIds],
    authority:'SHADOW_EXECUTION_SIMULATION_ONLY',can_sign:false,can_broadcast:false,can_execute:false,
  },compareColumns:['decision_id','execution_json'],code:'SHADOW_EXECUTION'})
}

export async function loadShadowExecution(client:SupabaseClient,decisionId:string):Promise<SharkShadowExecutionSimulation|undefined>{
  const {data,error}=await client.from('money_shark_shadow_executions').select('execution_json').eq('decision_id',decisionId).maybeSingle()
  if(error)throw new Error('SHADOW_EXECUTION_READ_FAILED:'+error.message)
  return data?decodeExecution((data as any).execution_json):undefined
}

export async function appendShadowPosition(client:SupabaseClient,d:SharkShadowDecisionTwin,s:SharkShadowExecutionSimulation):Promise<'INSERTED'|'REPLAY'>{
  const id='shark-shadow-position:'+hash({decisionId:d.decisionId,simulationId:s.simulationId})
  const status=d.action==='PAPER_TRADE'?'SIMULATED_OPEN':'NO_POSITION'
  return insertReplaySafe(client,{table:'money_shark_shadow_positions',idColumn:'position_id',id,row:{
    position_id:id,decision_id:d.decisionId,status,notional_minor:s.estimatedFilledMinor.toString(),
    position_json:encode({positionId:id,decisionId:d.decisionId,status,side:d.side,notionalMinor:s.estimatedFilledMinor,openedAt:s.simulatedAt,authority:'SHADOW_POSITION_ONLY',canExecute:false}),
    observed_at:s.simulatedAt,authority:'SHADOW_POSITION_ONLY',can_execute:false,
  },compareColumns:['decision_id','position_json'],code:'SHADOW_POSITION'})
}

export async function listShadowDecisions(client:SupabaseClient,input:{since:string;now:string;limit:number}):Promise<readonly SharkShadowDecisionTwin[]>{
  const limit=Math.max(1,Math.min(2000,Math.trunc(input.limit)))
  const {data,error}=await client.from('money_shark_shadow_decisions').select('decision_json')
    .gte('decided_at',input.since).lte('decided_at',input.now).order('decided_at',{ascending:true}).limit(limit)
  if(error)throw new Error('SHADOW_DECISION_READ_FAILED:'+error.message)
  return Object.freeze((data??[]).map((x:any)=>decodeDecision(x.decision_json)))
}

export async function existingShadowHorizons(client:SupabaseClient,decisionId:string):Promise<ReadonlySet<string>>{
  const {data,error}=await client.from('money_shark_shadow_observations').select('horizon').eq('decision_id',decisionId)
  if(error)throw new Error('SHADOW_HORIZON_READ_FAILED:'+error.message)
  return new Set((data??[]).map((x:any)=>String(x.horizon)))
}

export async function loadLaunchId(client:SupabaseClient,input:{chainId:string;tokenAddress:string}):Promise<string|undefined>{
  const {data,error}=await client.from('jhadina_token_launches').select('launch_id').eq('chain_id',input.chainId).eq('token_address',input.tokenAddress).limit(1).maybeSingle()
  if(error)throw new Error('SHADOW_LAUNCH_READ_FAILED:'+error.message)
  const id=(data as any)?.launch_id
  return typeof id==='string'&&id.trim()?id:undefined
}

function historical(row:any):HistoricalLaunchObservation{
  const num=(v:unknown)=>v===null||v===undefined?undefined:Number(v)
  return Object.freeze({
    observationId:String(row.observation_id),observedAt:String(row.observed_at),
    priceReturnFromLaunchPct:num(row.price_return_from_launch_pct),peakReturnPct:num(row.peak_return_pct),maxDrawdownPct:num(row.max_drawdown_pct),
    initialLiquidityUsd:num(row.initial_liquidity_usd),currentLiquidityUsd:num(row.current_liquidity_usd),
    liquidityRemoved:row.liquidity_removed===null||row.liquidity_removed===undefined?undefined:Boolean(row.liquidity_removed),
    tradingHalted:row.trading_halted===null||row.trading_halted===undefined?undefined:Boolean(row.trading_halted),
    evidenceIds:Object.freeze(strings(row.evidence_ids)),
  })
}

export async function loadHistoricalObservationAtOrBefore(client:SupabaseClient,launchId:string,at:string):Promise<HistoricalLaunchObservation|undefined>{
  const {data,error}=await client.from('jhadina_launch_outcome_observations').select('*').eq('launch_id',launchId).lte('observed_at',at).order('observed_at',{ascending:false}).limit(1).maybeSingle()
  if(error)throw new Error('SHADOW_HISTORICAL_BASELINE_READ_FAILED:'+error.message)
  return data?historical(data):undefined
}

export async function loadHistoricalObservationAtOrAfter(client:SupabaseClient,launchId:string,at:string,now:string):Promise<HistoricalLaunchObservation|undefined>{
  const {data,error}=await client.from('jhadina_launch_outcome_observations').select('*').eq('launch_id',launchId).gte('observed_at',at).lte('observed_at',now).order('observed_at',{ascending:true}).limit(1).maybeSingle()
  if(error)throw new Error('SHADOW_HISTORICAL_TARGET_READ_FAILED:'+error.message)
  return data?historical(data):undefined
}

export async function appendShadowObservation(client:SupabaseClient,o:SharkShadowOutcomeObservation):Promise<'INSERTED'|'REPLAY'>{
  return insertReplaySafe(client,{table:'money_shark_shadow_observations',idColumn:'observation_id',id:o.observationId,row:{
    observation_id:o.observationId,decision_id:o.decisionId,horizon:o.horizon,observation_json:encode(o),observed_at:o.observedAt,evidence_ids:[...o.evidenceIds],
    authority:'SHADOW_OUTCOME_ONLY',can_execute:false,
  },compareColumns:['decision_id','horizon','observation_json'],code:'SHADOW_OBSERVATION'})
}

export async function appendShadowLesson(client:SupabaseClient,l:SharkShadowCounterfactualLesson):Promise<'INSERTED'|'REPLAY'>{
  if(l.authority!=='LEARNING_ONLY'||l.financialAuthority!=='NONE'||l.canExecute!==false||l.canAuthorizeLive!==false)throw new Error('SHADOW_LESSON_AUTHORITY_INVALID')
  return insertReplaySafe(client,{table:'money_shark_shadow_lessons',idColumn:'lesson_id',id:l.lessonId,row:{
    lesson_id:l.lessonId,decision_id:l.decisionId,horizon:l.horizon,user_id:l.userId,strategy_id:l.strategyId,instrument_id:l.instrumentId,
    decision_quality_bps:l.decisionQualityBps,execution_cost_bps:l.executionCostBps,confidence_error_bps:l.confidenceErrorBps,
    lesson_json:encode(l),evaluated_at:l.evaluatedAt,evidence_ids:[...l.evidenceIds],authority:'LEARNING_ONLY',can_authorize_live:false,
  },compareColumns:['decision_id','horizon','lesson_json'],code:'SHADOW_LESSON'})
}

export async function listShadowLessons(client:SupabaseClient,input:{userId:string;strategyId:string;through:string;limit?:number}):Promise<readonly SharkShadowCounterfactualLesson[]>{
  const limit=Math.max(1,Math.min(5000,Math.trunc(input.limit??2000)))
  const {data,error}=await client.from('money_shark_shadow_lessons').select('lesson_json').eq('user_id',input.userId).eq('strategy_id',input.strategyId)
    .lte('evaluated_at',input.through).order('evaluated_at',{ascending:false}).limit(limit)
  if(error)throw new Error('SHADOW_LESSON_READ_FAILED:'+error.message)
  return Object.freeze((data??[]).map((x:any)=>Object.freeze({...x.lesson_json,sourceGroups:Object.freeze(strings(x.lesson_json?.sourceGroups)),lessonTags:Object.freeze(strings(x.lesson_json?.lessonTags)),evidenceIds:Object.freeze(strings(x.lesson_json?.evidenceIds))}) as SharkShadowCounterfactualLesson))
}

export async function appendShadowCalibration(client:SupabaseClient,c:SharkShadowPerformanceCalibration):Promise<'INSERTED'|'REPLAY'>{
  if(c.canMutateMandate!==false||c.canAuthorizeLive!==false)throw new Error('SHADOW_CALIBRATION_AUTHORITY_INVALID')
  return insertReplaySafe(client,{table:'money_shark_shadow_calibrations',idColumn:'calibration_id',id:c.calibrationId,row:{
    calibration_id:c.calibrationId,user_id:c.userId,strategy_id:c.strategyId,sample_size:c.sampleSize,calibration_json:encode(c),calibrated_at:c.calibratedAt,
    evidence_ids:[...c.lessonIds],authority:'LEARNING_ONLY',can_mutate_mandate:false,can_authorize_live:false,
  },compareColumns:['calibration_json'],code:'SHADOW_CALIBRATION'})
}

export async function appendShadowMemory(client:SupabaseClient,m:SharkShadowMemoryCard):Promise<'INSERTED'|'REPLAY'>{
  return insertReplaySafe(client,{table:'money_shark_shadow_memory',idColumn:'memory_id',id:m.memoryId,row:{
    memory_id:m.memoryId,user_id:m.userId,strategy_id:m.strategyId,pattern_key:m.patternKey,market_regime:m.marketRegime,sample_size:m.sampleSize,
    memory_json:encode(m),created_at_evidence:m.createdAt,evidence_ids:[...m.evidenceIds],authority:'LEARNING_MEMORY_ONLY',can_authorize_live:false,
  },compareColumns:['memory_json'],code:'SHADOW_MEMORY'})
}

export async function appendShadowReplay(client:SupabaseClient,r:SharkShadowReplayManifest):Promise<'INSERTED'|'REPLAY'>{
  return insertReplaySafe(client,{table:'money_shark_shadow_replays',idColumn:'replay_id',id:r.replayId,row:{
    replay_id:r.replayId,user_id:r.userId,replay_from:r.from,replay_to:r.to,decision_count:r.decisionIds.length,observation_count:r.observationIds.length,
    lesson_count:r.lessonIds.length,future_evidence_rejected:r.futureEvidenceRejected,manifest_json:encode(r),generated_at:r.generatedAt,
    evidence_ids:[...r.observationIds,...r.lessonIds],authority:'RESEARCH_REPLAY_ONLY',can_execute:false,can_authorize_live:false,
  },compareColumns:['manifest_json'],code:'SHADOW_REPLAY'})
}

export async function appendShadowPurseMemory(client:SupabaseClient,input:{
  eventId:string
  userId:string
  cofferId:string
  strategyId:string
  instrumentId:string
  payload:unknown
  observedAt:string
  evidenceIds:readonly string[]
}):Promise<'INSERTED'|'REPLAY'>{
  return insertReplaySafe(client,{table:'money_purse_learning_events',idColumn:'learning_event_id',id:input.eventId,row:{
    learning_event_id:input.eventId,user_id:input.userId,coffer_id:input.cofferId,source:'PURSE_OUTCOME',lane:'MEME',strategy_id:input.strategyId,instrument_id:input.instrumentId,
    payload_json:encode(input.payload),observed_at:input.observedAt,evidence_ids:[...input.evidenceIds],authority:'LEARNING_ONLY',can_authorize_live:false,
  },compareColumns:['payload_json'],code:'SHADOW_PURSE_MEMORY'})
}

export async function listShadowPurseMemories(client:SupabaseClient,input:{userId:string;strategyId:string;through:string;limit?:number}):Promise<readonly any[]>{
  const {data,error}=await client.from('money_purse_learning_events').select('payload_json').eq('user_id',input.userId).eq('strategy_id',input.strategyId)
    .eq('source','PURSE_OUTCOME').lte('observed_at',input.through).order('observed_at',{ascending:false}).limit(Math.max(1,Math.min(5000,input.limit??2000)))
  if(error)throw new Error('SHADOW_PURSE_MEMORY_READ_FAILED:'+error.message)
  return Object.freeze((data??[]).map((x:any)=>x.payload_json))
}

export async function appendShadowStrategyProfile(client:SupabaseClient,input:{
  eventId:string
  userId:string
  cofferId:string
  strategyId:string
  payload:unknown
  observedAt:string
  evidenceIds:readonly string[]
}):Promise<'INSERTED'|'REPLAY'>{
  return insertReplaySafe(client,{table:'money_purse_learning_events',idColumn:'learning_event_id',id:input.eventId,row:{
    learning_event_id:input.eventId,user_id:input.userId,coffer_id:input.cofferId,source:'STRATEGY_PROFILE',lane:'MEME',strategy_id:input.strategyId,instrument_id:null,
    payload_json:encode(input.payload),observed_at:input.observedAt,evidence_ids:[...input.evidenceIds],authority:'LEARNING_ONLY',can_authorize_live:false,
  },compareColumns:['payload_json'],code:'SHADOW_STRATEGY_PROFILE'})
}
