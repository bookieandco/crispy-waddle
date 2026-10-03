import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {PersistedActorAwareAssessmentInput} from '@/lib/shark/actor-aware-assessment-service'
import {
  buildCofferTreasurySnapshot,
  type CofferAssetBalanceEvidence,
  type CofferTreasurySnapshot,
  type ExecutionPlan,
  type AutonomousTradeIntent,
  type AutonomousTradingMandate,
  type JhadinaPurseCharter,
  type LiveExecutionPreflight,
  type PurseAllocationPlan,
  type PurseAllocatorCapitalEvidence,
  type PurseDecisionSet,
  type PurseExposureEvidence,
  type PurseOpportunity,
  type PurseOpportunityEnvelope,
  type PurseStrategyLearningProfile,
  type PurseDecisionStyle,
  type PursePortfolioSnapshot,
  type PurseRebalanceIntent,
  type PurseRebalancePlan,
  type RebalanceIntent,
  type SharkCofferRuntimeResearch,
  type SharkCofferExecutionEvidence,
  type SharkMoneyRuntimeMarketEvidence,
  type SharkMoneyTransportEnvelope,
} from '@jhadina/money-core'

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x)).digest('hex')
const encode=(v:unknown)=>JSON.parse(JSON.stringify(v,(_,x)=>typeof x==='bigint'?x.toString():x))
const big=(v:unknown,code:string)=>{try{return BigInt(String(v))}catch{throw new Error(code)}}
const strings=(v:unknown)=>Array.isArray(v)?v.map(String):[]
const iso=(v:string,code:string)=>{if(!v||Number.isNaN(Date.parse(v)))throw new Error(code)}
const unique=(xs:readonly string[])=>[...new Set(xs)].sort()

export type SharkRuntimeIngressRecord=Readonly<{
  userId:string
  envelope:SharkMoneyTransportEnvelope
  market:SharkMoneyRuntimeMarketEvidence
  source:string
  createdAt:string
}>

export type SharkRuntimeLeaseRecord=SharkRuntimeIngressRecord & Readonly<{
  leaseOwner:string
  leaseToken:string
  leaseExpiresAt:string
  attemptCount:number
}>

export type SharkExecutionPlanningPackage=Readonly<{
  packageId:string
  envelopeId:string
  charterId:string
  opportunityId:string
  rebalancePlanId:string
  purseIntentId:string
  canonicalIntent:RebalanceIntent
  executionPlan:ExecutionPlan
  preflight:LiveExecutionPreflight
  observedAt:string
  expiresAt:string
  evidenceIds:readonly string[]
  authority:'EXECUTION_PLANNING_EVIDENCE_ONLY'
  canExecute:false
}>

export type PurseExecutionResumeState=Readonly<{
  opportunityEnvelope:PurseOpportunityEnvelope
  decisions:PurseDecisionSet
  rebalance:PurseRebalancePlan
  purseIntent:PurseRebalanceIntent
}>

export type SharkCofferRuntimeRunReceipt=Readonly<{
  runId:string
  envelopeId:string
  charterId:string
  userId:string
  cofferId:string
  disposition:'BLOCKED'|'RESEARCH_ONLY'|'PURSE_REJECTED'|'PURSE_ADMITTED'|'PURSE_NOT_ALLOCATED'|'ALLOCATED'|'PREFLIGHT_BLOCKED'|'AUTONOMOUS_INTENT_READY'
  opportunityId?:string
  purseBusEventId?:string
  allocationPlanId?:string
  decisionSetId?:string
  rebalancePlanId?:string
  autonomousIntentId?:string
  runJson:unknown
  informationCutoff:string
  completedAt:string
  evidenceIds:readonly string[]
  authority:'RUNTIME_EVIDENCE_ONLY'
  canExecute:false
}>

function marketEvidenceFromAssessment(input:{
  envelope:SharkMoneyTransportEnvelope
  assessment:PersistedActorAwareAssessmentInput
}):SharkMoneyRuntimeMarketEvidence{
  const m=input.assessment.market
  const p=m.payload
  if(input.envelope.assessment.assessmentId!==input.assessment.assessmentId)throw new Error('SHARK_COFFER_RUNTIME_INGRESS_ASSESSMENT_MISMATCH')
  if(input.envelope.assessment.chainId!==m.chainId||input.envelope.assessment.tokenAddress!==m.subjectId)throw new Error('SHARK_COFFER_RUNTIME_INGRESS_MARKET_IDENTITY_MISMATCH')
  const evidenceId='money-raw-market:'+m.observationId
  const payloadHash=hash({observationId:m.observationId,source:m.source,chainId:m.chainId,subjectId:m.subjectId,payload:p,observedAt:m.observedAt,receivedAt:m.receivedAt})
  return Object.freeze({
    evidenceId,
    assessmentId:input.envelope.assessment.assessmentId,
    chainId:m.chainId,
    tokenAddress:m.subjectId,
    source:m.source,
    liquidityUsd:Number(p.liquidityUsd??0),
    volume24hUsd:Number(p.volume24hUsd??0),
    buys24h:Number(p.buys24h??0),
    sells24h:Number(p.sells24h??0),
    anomalyScore:Number(p.anomalyScore??0),
    observedAt:m.observedAt,
    availableAt:m.receivedAt,
    evidenceIds:Object.freeze(unique([m.observationId,...input.envelope.assessment.evidenceRefs.map(x=>x.evidenceId)])),
    payloadHash,
    authority:'EVIDENCE_ONLY',
    canExecute:false,
  })
}

export async function appendSharkMoneyRuntimeIngress(
  client:SupabaseClient,
  input:Readonly<{
    userId:string
    envelope:SharkMoneyTransportEnvelope
    assessment:PersistedActorAwareAssessmentInput
    source:string
    createdAt:string
  }>,
):Promise<'INSERTED'|'REPLAY'>{
  if(!input.userId.trim())throw new Error('SHARK_COFFER_RUNTIME_INGRESS_USER_REQUIRED')
  if(!input.source.trim())throw new Error('SHARK_COFFER_RUNTIME_INGRESS_SOURCE_REQUIRED')
  iso(input.createdAt,'SHARK_COFFER_RUNTIME_INGRESS_TIME_INVALID')
  const market=marketEvidenceFromAssessment({envelope:input.envelope,assessment:input.assessment})
  const row={
    envelope_id:input.envelope.envelopeId,
    user_id:input.userId,
    assessment_id:input.envelope.assessment.assessmentId,
    chain_id:input.envelope.assessment.chainId,
    token_address:input.envelope.assessment.tokenAddress,
    information_cutoff:input.envelope.assessment.informationCutoff,
    envelope_json:encode(input.envelope),
    market_evidence_json:encode(market),
    source:input.source,
    created_at:input.createdAt,
    authority:'RESEARCH_INGRESS_ONLY',
    can_execute:false,
  }
  const {data,error}=await client.from('money_shark_runtime_ingress').insert(row).select('envelope_id').maybeSingle()
  if(!error&&data)return 'INSERTED'
  if(error?.code!=='23505')throw new Error('SHARK_COFFER_RUNTIME_INGRESS_WRITE_FAILED:'+(error?.message??'unknown'))
  const {data:existing,error:readError}=await client.from('money_shark_runtime_ingress').select('user_id,envelope_json,market_evidence_json,source').eq('envelope_id',input.envelope.envelopeId).maybeSingle()
  if(readError||!existing)throw new Error('SHARK_COFFER_RUNTIME_INGRESS_REPLAY_READ_FAILED:'+(readError?.message??'missing'))
  if(String((existing as any).user_id)!==input.userId||hash((existing as any).envelope_json)!==hash(row.envelope_json)||hash((existing as any).market_evidence_json)!==hash(row.market_evidence_json)||String((existing as any).source)!==input.source)throw new Error('SHARK_COFFER_RUNTIME_INGRESS_CONFLICT')
  return 'REPLAY'
}

function decodeIngressRow(row:any):SharkRuntimeIngressRecord{
  return Object.freeze({
    userId:String(row.user_id),
    envelope:row.envelope_json as SharkMoneyTransportEnvelope,
    market:row.market_evidence_json as SharkMoneyRuntimeMarketEvidence,
    source:String(row.source),
    createdAt:String(row.created_at),
  })
}

export async function listSharkRuntimeIngress(client:SupabaseClient,input:Readonly<{userId?:string;limit?:number}>={}):Promise<readonly SharkRuntimeIngressRecord[]>{
  const bounded=Math.max(1,Math.min(500,Math.trunc(input.limit??100)))
  let query=client.from('money_shark_runtime_ingress').select('user_id,envelope_json,market_evidence_json,source,created_at').order('created_at',{ascending:true})
  if(input.userId)query=query.eq('user_id',input.userId)
  const {data,error}=await query.limit(bounded)
  if(error)throw new Error('SHARK_COFFER_RUNTIME_INGRESS_READ_FAILED:'+error.message)
  return Object.freeze((data??[]).map((row:any)=>decodeIngressRow(row)))
}

export async function claimSharkRuntimeIngress(client:SupabaseClient,input:Readonly<{
  workerId:string
  limit?:number
  leaseSeconds?:number
}>):Promise<readonly SharkRuntimeLeaseRecord[]>{
  if(!input.workerId.trim())throw new Error('SHARK_COFFER_RUNTIME_WORKER_REQUIRED')
  const limit=Math.max(1,Math.min(500,Math.trunc(input.limit??100)))
  const leaseSeconds=Math.max(1,Math.min(900,Math.trunc(input.leaseSeconds??120)))
  const {data,error}=await client.rpc('money_claim_shark_coffer_runtime',{
    p_worker_id:input.workerId,
    p_limit:limit,
    p_lease_seconds:leaseSeconds,
  })
  if(error)throw new Error('SHARK_COFFER_RUNTIME_CLAIM_FAILED:'+error.message)
  return Object.freeze((data??[]).map((row:any)=>{
    const base=decodeIngressRow(row)
    const leaseOwner=String(row.lease_owner??'')
    const leaseToken=String(row.lease_token??'')
    const leaseExpiresAt=String(row.lease_expires_at??'')
    if(!leaseOwner||!leaseToken)throw new Error('SHARK_COFFER_RUNTIME_LEASE_INVALID')
    iso(leaseExpiresAt,'SHARK_COFFER_RUNTIME_LEASE_TIME_INVALID')
    return Object.freeze({...base,leaseOwner,leaseToken,leaseExpiresAt,attemptCount:Number(row.attempt_count??0)})
  }))
}

export async function completeSharkRuntimeIngress(client:SupabaseClient,input:Readonly<{
  envelopeId:string
  workerId:string
  leaseToken:string
  runId:string
}>):Promise<void>{
  const {data,error}=await client.rpc('money_complete_shark_coffer_runtime',{
    p_envelope_id:input.envelopeId,
    p_worker_id:input.workerId,
    p_lease_token:input.leaseToken,
    p_run_id:input.runId,
  })
  if(error)throw new Error('SHARK_COFFER_RUNTIME_COMPLETE_FAILED:'+error.message)
  if(data!==true)throw new Error('SHARK_COFFER_RUNTIME_COMPLETE_FENCE_REJECTED')
}

export async function releaseSharkRuntimeIngress(client:SupabaseClient,input:Readonly<{
  envelopeId:string
  workerId:string
  leaseToken:string
}>):Promise<void>{
  const {data,error}=await client.rpc('money_release_shark_coffer_runtime',{
    p_envelope_id:input.envelopeId,
    p_worker_id:input.workerId,
    p_lease_token:input.leaseToken,
  })
  if(error)throw new Error('SHARK_COFFER_RUNTIME_RELEASE_FAILED:'+error.message)
  if(data!==true)throw new Error('SHARK_COFFER_RUNTIME_RELEASE_FENCE_REJECTED')
}

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
  const {data:existing,error:readError}=await client.from(input.table).select(input.compareColumns.join(',')).eq(input.idColumn,input.id).maybeSingle()
  if(readError||!existing)throw new Error(input.code+'_REPLAY_READ_FAILED:'+(readError?.message??'missing'))
  for(const col of input.compareColumns){
    if(hash((existing as any)[col])!==hash((input.row as any)[col]))throw new Error(input.code+'_CONFLICT')
  }
  return 'REPLAY'
}

export async function persistSharkCofferRuntimeResearch(
  client:SupabaseClient,
  input:{runtime:SharkCofferRuntimeResearch;createdAt:string},
):Promise<void>{
  for(const e of input.runtime.fusionEvidence){
    await insertReplaySafe(client,{
      table:'money_fusion_evidence_events',idColumn:'evidence_id',id:e.evidenceId,
      row:{evidence_id:e.evidenceId,envelope_id:input.runtime.sourceEnvelopeId,subject_id:e.subjectId,instrument_id:e.instrumentId??input.runtime.instrumentId,available_at:e.availableAt,evidence_json:encode(e),created_at:input.createdAt,authority:'FUSION_EVIDENCE_ONLY',can_execute:false},
      compareColumns:['evidence_json'],code:'SHARK_COFFER_RUNTIME_FUSION',
    })
  }
  await insertReplaySafe(client,{
    table:'money_financial_theses_v2',idColumn:'thesis_id',id:input.runtime.thesis.thesisId,
    row:{thesis_id:input.runtime.thesis.thesisId,envelope_id:input.runtime.sourceEnvelopeId,subject_id:input.runtime.thesis.subjectId,information_cutoff:input.runtime.thesis.informationCutoff,expires_at:input.runtime.thesis.expiresAt,thesis_json:encode(input.runtime.thesis),created_at:input.runtime.thesis.createdAt,authority:'INTELLIGENCE_ONLY',can_execute:false},
    compareColumns:['thesis_json'],code:'SHARK_COFFER_RUNTIME_THESIS',
  })
  await insertReplaySafe(client,{
    table:'money_dialectical_assessments',idColumn:'assessment_id',id:input.runtime.dialectic.assessmentId,
    row:{assessment_id:input.runtime.dialectic.assessmentId,envelope_id:input.runtime.sourceEnvelopeId,thesis_id:input.runtime.thesis.thesisId,status:input.runtime.dialectic.status,assessment_json:encode(input.runtime.dialectic),authority:'ANALYSIS_ONLY',can_execute:false},
    compareColumns:['assessment_json'],code:'SHARK_COFFER_RUNTIME_DIALECTIC',
  })
  if(input.runtime.opportunity){
    await insertReplaySafe(client,{
      table:'money_opportunities_v2',idColumn:'opportunity_id',id:input.runtime.opportunity.opportunityId,
      row:{opportunity_id:input.runtime.opportunity.opportunityId,envelope_id:input.runtime.sourceEnvelopeId,thesis_id:input.runtime.thesis.thesisId,subject_id:input.runtime.opportunity.subjectId,instrument_id:input.runtime.instrumentId,information_cutoff:input.runtime.opportunity.informationCutoff,expires_at:input.runtime.opportunity.expiresAt,opportunity_json:encode(input.runtime.opportunity),trade_mims_json:input.runtime.tradeMims?encode(input.runtime.tradeMims):null,validation_json:input.runtime.validation?encode(input.runtime.validation):null,authority:'OPPORTUNITY_EVIDENCE_ONLY',can_execute:false},
      compareColumns:['opportunity_json','trade_mims_json','validation_json'],code:'SHARK_COFFER_RUNTIME_OPPORTUNITY',
    })
  }
}

function decodeOpportunity(raw:any):PurseOpportunity{
  return Object.freeze({
    ...raw,
    minimumCapitalMinor:big(raw.minimumCapitalMinor,'SHARK_COFFER_RUNTIME_MIN_CAPITAL_DECODE'),
    maximumCapitalMinor:big(raw.maximumCapitalMinor,'SHARK_COFFER_RUNTIME_MAX_CAPITAL_DECODE'),
    correlationGroupIds:Object.freeze(strings(raw.correlationGroupIds)),
    evidenceIds:Object.freeze(strings(raw.evidenceIds)),
    governance:raw.governance?Object.freeze({...raw.governance,mimsReasonCodes:Object.freeze(strings(raw.governance.mimsReasonCodes)),evidenceIds:Object.freeze(strings(raw.governance.evidenceIds))}):undefined,
  }) as PurseOpportunity
}

export async function loadActivePurseCharters(client:SupabaseClient,now:string):Promise<readonly JhadinaPurseCharter[]>{
  const {data,error}=await client.from('money_purse_charters').select('*').lte('effective_at',now).order('effective_at',{ascending:false})
  if(error)throw new Error('SHARK_COFFER_RUNTIME_CHARTER_READ_FAILED:'+error.message)
  const seen=new Set<string>(),rows:JhadinaPurseCharter[]=[]
  for(const raw of data??[]){
    const r=raw as any
    if(seen.has(String(r.user_id)))continue
    if(r.expires_at&&String(r.expires_at)<=now)continue
    const cfg=r.config_json??{}
    if(
      cfg.ownerProfitSweepProtected!==true||
      cfg.charterMutationRequiresOwnerApproval!==true||
      cfg.ownerDestinationMutationRequiresOwnerApproval!==true||
      cfg.jhadinaMayAllocate!==true||
      cfg.jhadinaMayRebalance!==true
    )throw new Error('SHARK_COFFER_RUNTIME_CHARTER_PROTECTION_INVALID')
    const lanePolicies=Array.isArray(cfg.lanePolicies)?cfg.lanePolicies:[]
    const charter:JhadinaPurseCharter=Object.freeze({
      charterId:String(r.charter_id),charterVersion:String(r.charter_version),userId:String(r.user_id),cofferId:String(r.coffer_id),reportingCurrency:String(r.reporting_currency),autonomyMode:r.autonomy_mode,
      maxTotalDeployableBps:Number(cfg.maxTotalDeployableBps),minLiquidReserveMinor:big(cfg.minLiquidReserveMinor,'SHARK_COFFER_RUNTIME_CHARTER_LIQUID_RESERVE_DECODE'),minEmergencyReserveMinor:big(cfg.minEmergencyReserveMinor,'SHARK_COFFER_RUNTIME_CHARTER_EMERGENCY_RESERVE_DECODE'),
      maxSingleOpportunityBps:Number(cfg.maxSingleOpportunityBps),maxCorrelatedExposureBps:Number(cfg.maxCorrelatedExposureBps),maxRebalanceTurnoverBps:Number(cfg.maxRebalanceTurnoverBps),
      lanePolicies:Object.freeze(lanePolicies.map((x:any)=>Object.freeze({...x,maxAllocationBps:Number(x.maxAllocationBps),maxSinglePositionBps:Number(x.maxSinglePositionBps),minConfidenceBps:Number(x.minConfidenceBps)}))),
      verifiedOwnerPayoutDestinationId:String(r.verified_owner_payout_destination_id),ownerProfitSweepProtected:true,charterMutationRequiresOwnerApproval:true,ownerDestinationMutationRequiresOwnerApproval:true,
      jhadinaMayAllocate:true,jhadinaMayRebalance:true,effectiveAt:String(r.effective_at),expiresAt:r.expires_at?String(r.expires_at):undefined,
      evidenceIds:Object.freeze(strings(r.evidence_ids)),authority:'OWNER_TREASURY_CHARTER',canExecute:false,
    })
    rows.push(charter);seen.add(charter.userId)
  }
  return Object.freeze(rows)
}

export async function hasRuntimeDisposition(client:SupabaseClient,input:{
  envelopeId:string
  charterId:string
  dispositions:readonly SharkCofferRuntimeRunReceipt['disposition'][]
}):Promise<boolean>{
  if(!input.dispositions.length)return false
  const {data,error}=await client.from('money_shark_coffer_runtime_runs').select('run_id').eq('envelope_id',input.envelopeId).eq('charter_id',input.charterId).in('disposition',[...input.dispositions]).limit(1)
  if(error)throw new Error('SHARK_COFFER_RUNTIME_RUN_LOOKUP_FAILED:'+error.message)
  return Boolean((data??[]).length)
}

export async function findTerminalRuntimeRunId(client:SupabaseClient,envelopeId:string,charterId:string,input?:Readonly<{includeAllocated?:boolean}>):Promise<string|undefined>{
  // Research-only, non-allocation and preflight-blocked states stay retryable as fresh evidence arrives.
  const dispositions:SharkCofferRuntimeRunReceipt['disposition'][]=['BLOCKED','PURSE_REJECTED','AUTONOMOUS_INTENT_READY']
  if(input?.includeAllocated)dispositions.push('ALLOCATED')
  const {data,error}=await client.from('money_shark_coffer_runtime_runs')
    .select('run_id,completed_at')
    .eq('envelope_id',envelopeId)
    .eq('charter_id',charterId)
    .in('disposition',dispositions)
    .order('completed_at',{ascending:false})
    .limit(1)
    .maybeSingle()
  if(error)throw new Error('SHARK_COFFER_RUNTIME_RUN_LOOKUP_FAILED:'+error.message)
  const id=(data as any)?.run_id
  return typeof id==='string'&&id.trim()?id:undefined
}

export async function hasTerminalRuntimeRun(client:SupabaseClient,envelopeId:string,charterId:string,input?:Readonly<{includeAllocated?:boolean}>):Promise<boolean>{
  return Boolean(await findTerminalRuntimeRunId(client,envelopeId,charterId,input))
}

export async function countStrategyCalibrationSamples(client:SupabaseClient,input:{strategyId:string;informationCutoff:string;userId?:string}):Promise<number>{
  iso(input.informationCutoff,'SHARK_COFFER_RUNTIME_CALIBRATION_CUTOFF_INVALID')
  let query=client.from('money_purse_learning_events').select('learning_event_id',{count:'exact',head:true}).eq('strategy_id',input.strategyId).in('source',['SHARK_CLOSED_TRADE','PURSE_OUTCOME','PAPER_STRATEGY']).lte('observed_at',input.informationCutoff)
  if(input.userId)query=query.eq('user_id',input.userId)
  const {count,error}=await query
  if(error)throw new Error('SHARK_COFFER_RUNTIME_CALIBRATION_READ_FAILED:'+error.message)
  return count??0
}

export async function loadPurseLearningProfiles(client:SupabaseClient,userId:string,now:string):Promise<readonly PurseStrategyLearningProfile[]>{
  const {data,error}=await client.from('money_purse_learning_events').select('payload_json,observed_at').eq('user_id',userId).eq('source','STRATEGY_PROFILE').lte('observed_at',now).order('observed_at',{ascending:false}).limit(500)
  if(error)throw new Error('SHARK_COFFER_RUNTIME_LEARNING_PROFILE_READ_FAILED:'+error.message)
  const latest=new Map<string,PurseStrategyLearningProfile>()
  for(const row of data??[]){
    const p=(row as any).payload_json as any
    if(!p||!p.lane||!p.strategyId||latest.has(String(p.lane)+':'+String(p.strategyId)))continue
    latest.set(String(p.lane)+':'+String(p.strategyId),Object.freeze({
      ...p,
      sampleWeight:Number(p.sampleWeight),meanReturnBps:Number(p.meanReturnBps),meanDownsideRateBps:Number(p.meanDownsideRateBps),meanExecutionQualityBps:Number(p.meanExecutionQualityBps),confidenceAdjustmentBps:Number(p.confidenceAdjustmentBps),sizeMultiplierBps:Number(p.sizeMultiplierBps),
      sourceMemoryIds:Object.freeze(strings(p.sourceMemoryIds)),evidenceIds:Object.freeze(strings(p.evidenceIds)),authority:'LEARNING_ONLY',canAuthorizeLive:false,
    }) as PurseStrategyLearningProfile)
  }
  return Object.freeze([...latest.values()])
}

export async function loadPurseDecisionStyle(client:SupabaseClient,userId:string,now:string):Promise<PurseDecisionStyle|undefined>{
  const {data,error}=await client.from('money_purse_learning_events').select('payload_json').eq('user_id',userId).eq('source','PERSONALITY_STYLE').lte('observed_at',now).order('observed_at',{ascending:false}).limit(1).maybeSingle()
  if(error)throw new Error('SHARK_COFFER_RUNTIME_DECISION_STYLE_READ_FAILED:'+error.message)
  if(!data)return undefined
  const p=(data as any).payload_json as any
  if(!p)return undefined
  return Object.freeze({
    ...p,
    personalityVersion:Number(p.personalityVersion),patienceBiasBps:Number(p.patienceBiasBps),cashOptionalityBiasBps:Number(p.cashOptionalityBiasBps),concentrationDisciplineBps:Number(p.concentrationDisciplineBps),contradictionSensitivityBps:Number(p.contradictionSensitivityBps),
    evidenceIds:Object.freeze(strings(p.evidenceIds)),authority:'PERSONALITY_INFLUENCE_ONLY',canRelaxCharter:false,canAuthorizeLive:false,
  }) as PurseDecisionStyle
}

export async function loadCofferTreasurySnapshot(client:SupabaseClient,charter:JhadinaPurseCharter,now:string):Promise<CofferTreasurySnapshot>{
  const {data,error}=await client.from('money_coffer_asset_balance_snapshots').select('*').eq('coffer_id',charter.cofferId).eq('user_id',charter.userId).lte('observed_at',now).order('observed_at',{ascending:false}).limit(1000)
  if(error)throw new Error('SHARK_COFFER_RUNTIME_TREASURY_READ_FAILED:'+error.message)
  const seen=new Set<string>(),balances:CofferAssetBalanceEvidence[]=[]
  for(const raw of data??[]){
    const r=raw as any,key=String(r.custody_id)+':'+String(r.asset_id)
    if(seen.has(key))continue
    seen.add(key)
    balances.push(Object.freeze({
      balanceId:String(r.balance_snapshot_id),cofferId:String(r.coffer_id),userId:String(r.user_id),custodyId:String(r.custody_id),custodyKind:r.custody_kind,provider:String(r.provider),assetId:String(r.asset_id),assetKind:r.asset_kind,
      amountAtomic:big(r.amount_atomic,'SHARK_COFFER_RUNTIME_BALANCE_AMOUNT_DECODE'),decimals:Number(r.decimals),reportingCurrency:String(r.reporting_currency),reportingValueMinor:big(r.reporting_value_minor,'SHARK_COFFER_RUNTIME_BALANCE_VALUE_DECODE'),reservedReportingValueMinor:big(r.reserved_reporting_value_minor,'SHARK_COFFER_RUNTIME_BALANCE_RESERVED_DECODE'),
      observedAt:String(r.observed_at),evidenceIds:Object.freeze(strings(r.evidence_ids)),authority:'TREASURY_BALANCE_EVIDENCE',canMoveMoney:false,
    }))
  }
  if(!balances.length)throw new Error('SHARK_COFFER_RUNTIME_TREASURY_EVIDENCE_REQUIRED')
  const observedAt=balances.map(x=>x.observedAt).sort().at(-1)!
  return buildCofferTreasurySnapshot({cofferId:charter.cofferId,userId:charter.userId,reportingCurrency:charter.reportingCurrency,balances,observedAt})
}

export async function loadPurseCapitalEvidence(client:SupabaseClient,charter:JhadinaPurseCharter,now:string):Promise<PurseAllocatorCapitalEvidence>{
  const {data,error}=await client.from('money_purse_liquidity_snapshots').select('*').eq('charter_id',charter.charterId).lte('observed_at',now).order('observed_at',{ascending:false}).limit(1).maybeSingle()
  if(error)throw new Error('SHARK_COFFER_RUNTIME_LIQUIDITY_READ_FAILED:'+error.message)
  if(!data)throw new Error('SHARK_COFFER_RUNTIME_LIQUIDITY_EVIDENCE_REQUIRED')
  const r=data as any
  return Object.freeze({capitalSnapshotId:String(r.liquidity_snapshot_id),cofferId:String(r.coffer_id),userId:String(r.user_id),reportingCurrency:String(r.reporting_currency),availableLiquidityMinor:big(r.available_to_allocate_minor,'SHARK_COFFER_RUNTIME_LIQUIDITY_DECODE'),observedAt:String(r.observed_at),evidenceIds:Object.freeze(strings(r.evidence_ids).concat(String(r.liquidity_snapshot_id))),authority:'CAPITAL_EVIDENCE'})
}

export async function loadLatestPursePortfolio(client:SupabaseClient,charter:JhadinaPurseCharter,now:string):Promise<PursePortfolioSnapshot>{
  const {data,error}=await client.from('money_purse_portfolio_snapshots').select('*').eq('coffer_id',charter.cofferId).eq('user_id',charter.userId).lte('observed_at',now).order('observed_at',{ascending:false}).limit(1).maybeSingle()
  if(error)throw new Error('SHARK_COFFER_RUNTIME_PORTFOLIO_READ_FAILED:'+error.message)
  if(!data)throw new Error('SHARK_COFFER_RUNTIME_PORTFOLIO_REQUIRED')
  const r=data as any
  const accounts=(Array.isArray(r.accounts_json)?r.accounts_json:[]).map((x:any)=>Object.freeze({...x,nativeBalanceMinor:big(x.nativeBalanceMinor,'PORTFOLIO_ACCOUNT_NATIVE_DECODE'),reportingValueMinor:big(x.reportingValueMinor,'PORTFOLIO_ACCOUNT_VALUE_DECODE'),liquidReportingValueMinor:big(x.liquidReportingValueMinor,'PORTFOLIO_ACCOUNT_LIQUID_DECODE'),unsettledReportingValueMinor:big(x.unsettledReportingValueMinor,'PORTFOLIO_ACCOUNT_UNSETTLED_DECODE'),reservedReportingValueMinor:big(x.reservedReportingValueMinor,'PORTFOLIO_ACCOUNT_RESERVED_DECODE'),evidenceIds:Object.freeze(strings(x.evidenceIds))}))
  const positions=(Array.isArray(r.positions_json)?r.positions_json:[]).map((x:any)=>Object.freeze({...x,marketValueMinor:big(x.marketValueMinor,'PORTFOLIO_POSITION_VALUE_DECODE'),executableExitValueMinor:big(x.executableExitValueMinor,'PORTFOLIO_POSITION_EXIT_DECODE'),costBasisMinor:big(x.costBasisMinor,'PORTFOLIO_POSITION_COST_DECODE'),unrealizedPnlMinor:big(x.unrealizedPnlMinor,'PORTFOLIO_POSITION_PNL_DECODE'),correlationGroupIds:Object.freeze(strings(x.correlationGroupIds)),evidenceIds:Object.freeze(strings(x.evidenceIds))}))
  return Object.freeze({
    snapshotId:String(r.snapshot_id),userId:String(r.user_id),cofferId:String(r.coffer_id),reportingCurrency:String(r.reporting_currency),
    totalAccountValueMinor:big(r.total_account_value_minor,'PORTFOLIO_TOTAL_ACCOUNT_DECODE'),totalPositionValueMinor:big(r.total_position_value_minor,'PORTFOLIO_TOTAL_POSITION_DECODE'),grossPortfolioValueMinor:big(r.gross_portfolio_value_minor,'PORTFOLIO_GROSS_DECODE'),liquidAccountValueMinor:big(r.liquid_account_value_minor,'PORTFOLIO_LIQUID_DECODE'),executablePositionValueMinor:big(r.executable_position_value_minor,'PORTFOLIO_EXECUTABLE_DECODE'),unsettledMinor:big(r.unsettled_minor,'PORTFOLIO_UNSETTLED_DECODE'),reservedMinor:big(r.reserved_minor,'PORTFOLIO_RESERVED_DECODE'),realizedPnlMinor:big(r.realized_pnl_minor,'PORTFOLIO_REALIZED_DECODE'),unrealizedPnlMinor:big(r.unrealized_pnl_minor,'PORTFOLIO_UNREALIZED_DECODE'),
    accounts:Object.freeze(accounts),positions:Object.freeze(positions),observedAt:String(r.observed_at),evidenceIds:Object.freeze(strings(r.evidence_ids)),authority:'PORTFOLIO_EVIDENCE',canExecute:false,
  })
}

export function portfolioExposures(portfolio:PursePortfolioSnapshot):readonly PurseExposureEvidence[]{
  return Object.freeze(portfolio.positions.map(p=>Object.freeze({exposureId:'exposure:'+p.positionId,lane:p.lane,strategyId:p.strategyId,instrumentId:p.instrumentId,reportingValueMinor:p.marketValueMinor,correlationGroupIds:p.correlationGroupIds,observedAt:p.observedAt,evidenceIds:p.evidenceIds,authority:'EXPOSURE_EVIDENCE' as const})))
}

export async function loadAdmittedPurseOpportunities(client:SupabaseClient,charter:JhadinaPurseCharter,now:string):Promise<readonly PurseOpportunityEnvelope[]>{
  const {data,error}=await client.from('money_purse_opportunity_events').select('*').eq('charter_id',charter.charterId).eq('admitted',true).lte('ingested_at',now).order('ingested_at',{ascending:false}).limit(500)
  if(error)throw new Error('SHARK_COFFER_RUNTIME_OPPORTUNITY_READ_FAILED:'+error.message)
  const latest=new Map<string,PurseOpportunityEnvelope>()
  for(const r of data??[]){
    const row=r as any
    const o=decodeOpportunity(row.opportunity_json)
    if(o.expiresAt<=now||latest.has(o.opportunityId))continue
    latest.set(o.opportunityId,Object.freeze({busEventId:String(row.bus_event_id),charterId:String(row.charter_id),opportunity:o,admitted:Boolean(row.admitted),reasonCodes:Object.freeze(strings(row.reason_codes)),ingestedAt:String(row.ingested_at),authority:'OPPORTUNITY_BUS_ONLY',canExecute:false}))
  }
  return Object.freeze([...latest.values()])
}

export async function persistPurseCycle(client:SupabaseClient,input:{
  charter:JhadinaPurseCharter
  plan:PurseAllocationPlan
  decisions:PurseDecisionSet
  rebalance:PurseRebalancePlan
  portfolio:PursePortfolioSnapshot
}):Promise<void>{
  await insertReplaySafe(client,{table:'money_purse_allocation_plans',idColumn:'plan_id',id:input.plan.planId,row:{plan_id:input.plan.planId,charter_id:input.charter.charterId,user_id:input.charter.userId,coffer_id:input.charter.cofferId,reporting_currency:input.plan.reportingCurrency,total_portfolio_value_minor:input.plan.totalPortfolioValueMinor.toString(),protected_reserve_minor:input.plan.protectedReserveMinor.toString(),maximum_deployable_minor:input.plan.maximumDeployableMinor.toString(),current_exposure_minor:input.plan.currentExposureMinor.toString(),incremental_capacity_minor:input.plan.incrementalCapacityMinor.toString(),allocated_increment_minor:input.plan.allocatedIncrementMinor.toString(),unallocated_liquidity_minor:input.plan.unallocatedLiquidityMinor.toString(),targets_json:encode(input.plan.targets),learning_profile_ids:[...input.plan.learningProfileIds],decision_style_id:input.plan.decisionStyleId??null,rejected_opportunity_ids:[...input.plan.rejectedOpportunityIds],information_cutoff:input.plan.informationCutoff,expires_at:input.plan.expiresAt,evidence_ids:[...input.plan.evidenceIds],authority:'PURSE_ALLOCATION_ONLY',can_execute:false,requires_downstream_risk_and_authority:true},compareColumns:['targets_json','evidence_ids'],code:'SHARK_COFFER_RUNTIME_ALLOCATION_PLAN'})
  await insertReplaySafe(client,{table:'money_purse_decision_sets',idColumn:'decision_set_id',id:input.decisions.decisionSetId,row:{decision_set_id:input.decisions.decisionSetId,plan_id:input.plan.planId,charter_id:input.charter.charterId,user_id:input.charter.userId,coffer_id:input.charter.cofferId,allocations_json:encode(input.decisions.allocations),cash_decision_json:encode(input.decisions.cash),decided_at:input.decisions.decidedAt,authority:'PURSE_DECISION_SET_ONLY',can_execute:false},compareColumns:['allocations_json','cash_decision_json'],code:'SHARK_COFFER_RUNTIME_DECISION_SET'})
  await insertReplaySafe(client,{table:'money_purse_rebalance_plans',idColumn:'rebalance_plan_id',id:input.rebalance.rebalancePlanId,row:{rebalance_plan_id:input.rebalance.rebalancePlanId,charter_id:input.charter.charterId,decision_set_id:input.decisions.decisionSetId,portfolio_snapshot_id:input.portfolio.snapshotId,user_id:input.charter.userId,coffer_id:input.charter.cofferId,reporting_currency:input.rebalance.reportingCurrency,turnover_minor:input.rebalance.turnoverMinor.toString(),turnover_bps:input.rebalance.turnoverBps,cash_target_minor:input.rebalance.cashTargetMinor.toString(),intents_json:encode(input.rebalance.intents),created_at_evidence:input.rebalance.createdAt,expires_at:input.rebalance.expiresAt,evidence_ids:[...input.rebalance.evidenceIds],authority:'PURSE_REBALANCE_PLAN_ONLY',can_execute:false,requires_downstream_risk_and_authority:true},compareColumns:['intents_json','evidence_ids'],code:'SHARK_COFFER_RUNTIME_REBALANCE_PLAN'})
}

export async function appendExecutionPackage(client:SupabaseClient,pkg:SharkExecutionPlanningPackage):Promise<'INSERTED'|'REPLAY'>{
  if(pkg.authority!=='EXECUTION_PLANNING_EVIDENCE_ONLY'||pkg.canExecute!==false)throw new Error('SHARK_COFFER_RUNTIME_EXECUTION_PACKAGE_AUTHORITY_INVALID')
  if(pkg.canonicalIntent.authority!=='NONE')throw new Error('SHARK_COFFER_RUNTIME_CANONICAL_INTENT_AUTHORITY_INVALID')
  if(pkg.executionPlan.authority!=='ANALYSIS_ONLY'||pkg.executionPlan.requiresHumanApproval!==true)throw new Error('SHARK_COFFER_RUNTIME_EXECUTION_PLAN_AUTHORITY_INVALID')
  if(pkg.preflight.authority!=='PREFLIGHT_ONLY'||pkg.preflight.canSubmitOrders!==false||pkg.preflight.canAuthorizeLive!==false)throw new Error('SHARK_COFFER_RUNTIME_PREFLIGHT_AUTHORITY_INVALID')
  if(pkg.executionPlan.rebalanceIntentId!==pkg.canonicalIntent.intentId||pkg.executionPlan.portfolioPlanId!==pkg.rebalancePlanId)throw new Error('SHARK_COFFER_RUNTIME_EXECUTION_PACKAGE_PLAN_BINDING_MISMATCH')
  if(pkg.preflight.executionPlanId!==pkg.executionPlan.executionPlanId)throw new Error('SHARK_COFFER_RUNTIME_EXECUTION_PACKAGE_PREFLIGHT_BINDING_MISMATCH')
  if(pkg.executionPlan.instrumentId!==pkg.canonicalIntent.instrumentId||pkg.executionPlan.notional.minor!==pkg.canonicalIntent.notional.minor||pkg.executionPlan.notional.currency!==pkg.canonicalIntent.notional.currency)throw new Error('SHARK_COFFER_RUNTIME_EXECUTION_PACKAGE_ECONOMICS_MISMATCH')
  iso(pkg.observedAt,'SHARK_COFFER_RUNTIME_EXECUTION_PACKAGE_OBSERVED_AT_INVALID')
  iso(pkg.expiresAt,'SHARK_COFFER_RUNTIME_EXECUTION_PACKAGE_EXPIRES_AT_INVALID')
  if(pkg.expiresAt<=pkg.observedAt||!pkg.evidenceIds.length)throw new Error('SHARK_COFFER_RUNTIME_EXECUTION_PACKAGE_WINDOW_INVALID')
  return insertReplaySafe(client,{
    table:'money_shark_execution_packages',idColumn:'package_id',id:pkg.packageId,
    row:{package_id:pkg.packageId,envelope_id:pkg.envelopeId,charter_id:pkg.charterId,opportunity_id:pkg.opportunityId,rebalance_plan_id:pkg.rebalancePlanId,purse_intent_id:pkg.purseIntentId,canonical_intent_json:encode(pkg.canonicalIntent),execution_plan_json:encode(pkg.executionPlan),preflight_json:encode(pkg.preflight),observed_at:pkg.observedAt,expires_at:pkg.expiresAt,evidence_ids:[...pkg.evidenceIds],authority:'EXECUTION_PLANNING_EVIDENCE_ONLY',can_execute:false},
    compareColumns:['canonical_intent_json','execution_plan_json','preflight_json','evidence_ids'],code:'SHARK_COFFER_RUNTIME_EXECUTION_PACKAGE',
  })
}

export async function loadExecutionPackage(client:SupabaseClient,input:{envelopeId:string;charterId:string;opportunityId:string;rebalancePlanId?:string;now:string}):Promise<SharkExecutionPlanningPackage|undefined>{
  let query=client.from('money_shark_execution_packages').select('*').eq('envelope_id',input.envelopeId).eq('charter_id',input.charterId).eq('opportunity_id',input.opportunityId).lte('observed_at',input.now).gt('expires_at',input.now)
  if(input.rebalancePlanId)query=query.eq('rebalance_plan_id',input.rebalancePlanId)
  const {data,error}=await query.order('observed_at',{ascending:false}).limit(1).maybeSingle()
  if(error)throw new Error('SHARK_COFFER_RUNTIME_EXECUTION_PACKAGE_READ_FAILED:'+error.message)
  if(!data)return undefined
  const r=data as any
  const canonical={...r.canonical_intent_json,notional:{...r.canonical_intent_json.notional,minor:big(r.canonical_intent_json.notional.minor,'EXECUTION_CANONICAL_NOTIONAL_DECODE')}} as RebalanceIntent
  const plan={...r.execution_plan_json,notional:{...r.execution_plan_json.notional,minor:big(r.execution_plan_json.notional.minor,'EXECUTION_PLAN_NOTIONAL_DECODE')},slices:(r.execution_plan_json.slices??[]).map((s:any)=>({...s,notional:{...s.notional,minor:big(s.notional.minor,'EXECUTION_SLICE_NOTIONAL_DECODE')},limitPriceMinor:big(s.limitPriceMinor,'EXECUTION_SLICE_PRICE_DECODE')}))} as ExecutionPlan
  return Object.freeze({packageId:String(r.package_id),envelopeId:String(r.envelope_id),charterId:String(r.charter_id),opportunityId:String(r.opportunity_id),rebalancePlanId:String(r.rebalance_plan_id),purseIntentId:String(r.purse_intent_id),canonicalIntent:Object.freeze(canonical),executionPlan:Object.freeze(plan),preflight:Object.freeze(r.preflight_json) as LiveExecutionPreflight,observedAt:String(r.observed_at),expiresAt:String(r.expires_at),evidenceIds:Object.freeze(strings(r.evidence_ids)),authority:'EXECUTION_PLANNING_EVIDENCE_ONLY',canExecute:false})
}

export async function loadPurseExecutionResumeState(
  client:SupabaseClient,
  pkg:SharkExecutionPlanningPackage,
):Promise<PurseExecutionResumeState>{
  const {data:rebalanceRow,error:rebalanceError}=await client.from('money_purse_rebalance_plans').select('*').eq('rebalance_plan_id',pkg.rebalancePlanId).maybeSingle()
  if(rebalanceError||!rebalanceRow)throw new Error('SHARK_COFFER_RUNTIME_REBALANCE_RESUME_FAILED:'+(rebalanceError?.message??'missing'))
  const rr=rebalanceRow as any
  if(String(rr.charter_id)!==pkg.charterId)throw new Error('SHARK_COFFER_RUNTIME_REBALANCE_RESUME_CHARTER_MISMATCH')

  const {data:decisionRow,error:decisionError}=await client.from('money_purse_decision_sets').select('*').eq('decision_set_id',String(rr.decision_set_id)).maybeSingle()
  if(decisionError||!decisionRow)throw new Error('SHARK_COFFER_RUNTIME_DECISION_RESUME_FAILED:'+(decisionError?.message??'missing'))
  const dr=decisionRow as any
  const allocations=(Array.isArray(dr.allocations_json)?dr.allocations_json:[]).map((x:any)=>Object.freeze({
    ...x,
    amountMinor:big(x.amountMinor,'SHARK_COFFER_RUNTIME_DECISION_AMOUNT_DECODE'),
    reasonCodes:Object.freeze(strings(x.reasonCodes)),
    evidenceIds:Object.freeze(strings(x.evidenceIds)),
  }))
  const cashRaw=dr.cash_decision_json??{}
  const decisions:PurseDecisionSet=Object.freeze({
    decisionSetId:String(dr.decision_set_id),planId:String(dr.plan_id),charterId:String(dr.charter_id),
    allocations:Object.freeze(allocations),
    cash:Object.freeze({...cashRaw,amountMinor:big(cashRaw.amountMinor,'SHARK_COFFER_RUNTIME_CASH_AMOUNT_DECODE'),reasonCodes:Object.freeze(strings(cashRaw.reasonCodes))}),
    decidedAt:String(dr.decided_at),authority:'PURSE_DECISION_SET_ONLY',canExecute:false,
  }) as PurseDecisionSet

  const intents=(Array.isArray(rr.intents_json)?rr.intents_json:[]).map((x:any)=>Object.freeze({
    ...x,
    currentValueMinor:big(x.currentValueMinor,'SHARK_COFFER_RUNTIME_INTENT_CURRENT_DECODE'),
    targetValueMinor:big(x.targetValueMinor,'SHARK_COFFER_RUNTIME_INTENT_TARGET_DECODE'),
    notionalMinor:big(x.notionalMinor,'SHARK_COFFER_RUNTIME_INTENT_NOTIONAL_DECODE'),
    reasonCodes:Object.freeze(strings(x.reasonCodes)),
    evidenceIds:Object.freeze(strings(x.evidenceIds)),
  }))
  const rebalance:PurseRebalancePlan=Object.freeze({
    rebalancePlanId:String(rr.rebalance_plan_id),charterId:String(rr.charter_id),decisionSetId:String(rr.decision_set_id),portfolioSnapshotId:String(rr.portfolio_snapshot_id),reportingCurrency:String(rr.reporting_currency),
    intents:Object.freeze(intents),turnoverMinor:big(rr.turnover_minor,'SHARK_COFFER_RUNTIME_TURNOVER_DECODE'),turnoverBps:Number(rr.turnover_bps),cashTargetMinor:big(rr.cash_target_minor,'SHARK_COFFER_RUNTIME_CASH_TARGET_DECODE'),
    createdAt:String(rr.created_at_evidence),expiresAt:String(rr.expires_at),evidenceIds:Object.freeze(strings(rr.evidence_ids)),authority:'PURSE_REBALANCE_PLAN_ONLY',canExecute:false,requiresDownstreamRiskAndAuthority:true,
  })
  const purseIntent=rebalance.intents.find(x=>x.intentId===pkg.purseIntentId)
  if(!purseIntent)throw new Error('SHARK_COFFER_RUNTIME_PURSE_INTENT_RESUME_MISSING')

  const {data:opRows,error:opError}=await client.from('money_purse_opportunity_events').select('*').eq('charter_id',pkg.charterId).eq('opportunity_id',pkg.opportunityId).eq('admitted',true).order('ingested_at',{ascending:false}).limit(1)
  if(opError)throw new Error('SHARK_COFFER_RUNTIME_OPPORTUNITY_RESUME_FAILED:'+opError.message)
  const orow=(opRows??[])[0] as any
  if(!orow)throw new Error('SHARK_COFFER_RUNTIME_OPPORTUNITY_RESUME_MISSING')
  const opportunityEnvelope:PurseOpportunityEnvelope=Object.freeze({
    busEventId:String(orow.bus_event_id),charterId:String(orow.charter_id),opportunity:decodeOpportunity(orow.opportunity_json),admitted:true,
    reasonCodes:Object.freeze(strings(orow.reason_codes)),ingestedAt:String(orow.ingested_at),authority:'OPPORTUNITY_BUS_ONLY',canExecute:false,
  })
  return Object.freeze({opportunityEnvelope,decisions,rebalance,purseIntent})
}

export async function loadActiveAutonomousMandate(
  client:SupabaseClient,
  input:{userId:string;provider:string;accountId:string;now:string},
):Promise<AutonomousTradingMandate|undefined>{
  const {data,error}=await client.from('money_autonomous_trading_mandates').select('*').eq('user_id',input.userId).eq('provider',input.provider).eq('account_id',input.accountId).eq('status','ACTIVE').lte('starts_at',input.now).gt('expires_at',input.now).order('activated_at',{ascending:false}).limit(1).maybeSingle()
  if(error)throw new Error('SHARK_COFFER_RUNTIME_MANDATE_READ_FAILED:'+error.message)
  if(!data)return undefined
  const r=data as any
  return Object.freeze({
    mandateId:String(r.mandate_id),userId:String(r.user_id),provider:String(r.provider),accountId:String(r.account_id),currency:String(r.currency),mode:'LIVE_AUTONOMOUS',
    allowedInstrumentPrefixes:Object.freeze(strings(r.allowed_instrument_prefixes)),allowedStrategyIds:Object.freeze(strings(r.allowed_strategy_ids)),allowOpeningShorts:Boolean(r.allow_opening_shorts),
    limits:Object.freeze({
      maxOrderNotionalMinor:big(r.max_order_notional_minor,'SHARK_COFFER_RUNTIME_MANDATE_ORDER_DECODE'),
      maxDailySubmittedNotionalMinor:big(r.max_daily_submitted_notional_minor,'SHARK_COFFER_RUNTIME_MANDATE_DAILY_DECODE'),
      maxDailyOrders:Number(r.max_daily_orders),
      maxDailyRealizedLossMinor:big(r.max_daily_realized_loss_minor,'SHARK_COFFER_RUNTIME_MANDATE_LOSS_DECODE'),
      maxGrossExposureMinor:big(r.max_gross_exposure_minor,'SHARK_COFFER_RUNTIME_MANDATE_EXPOSURE_DECODE'),
      maxDrawdownBps:Number(r.max_drawdown_bps),maxLeverageBps:Number(r.max_leverage_bps),minModelConfidenceBps:Number(r.min_model_confidence_bps),
    }),
    startsAt:String(r.starts_at),expiresAt:String(r.expires_at),approvalReceiptId:String(r.approval_receipt_id),actionCoreAuthorityId:String(r.action_core_authority_id),policyVersion:String(r.policy_version),policyHash:String(r.policy_hash),evidenceIds:Object.freeze(strings(r.evidence_ids)),status:'ACTIVE',activatedAt:String(r.activated_at),authority:'USER_APPROVED_MANDATE',canAuthorizeTrade:false,
  })
}

export async function appendAutonomousIntent(client:SupabaseClient,input:{
  envelopeId:string
  charterId:string
  opportunityId:string
  intent:AutonomousTradeIntent
}):Promise<'INSERTED'|'REPLAY'>{
  const i=input.intent
  if(i.authority!=='INTELLIGENCE_ONLY'||i.canExecute!==false)throw new Error('SHARK_COFFER_RUNTIME_AUTONOMOUS_INTENT_AUTHORITY_INVALID')
  if(i.opportunityId!==input.opportunityId)throw new Error('SHARK_COFFER_RUNTIME_AUTONOMOUS_INTENT_OPPORTUNITY_MISMATCH')
  return insertReplaySafe(client,{
    table:'money_shark_autonomous_intents',idColumn:'intent_id',id:i.intentId,
    row:{intent_id:i.intentId,envelope_id:input.envelopeId,charter_id:input.charterId,opportunity_id:input.opportunityId,mandate_id:i.mandateId,intent_json:encode(i),created_at:i.decidedAt,evidence_ids:[...i.evidenceIds],authority:'INTELLIGENCE_ONLY',can_execute:false},
    compareColumns:['intent_json','evidence_ids'],code:'SHARK_COFFER_RUNTIME_AUTONOMOUS_INTENT',
  })
}

export async function appendRuntimeRun(client:SupabaseClient,receipt:SharkCofferRuntimeRunReceipt):Promise<'INSERTED'|'REPLAY'>{
  return insertReplaySafe(client,{table:'money_shark_coffer_runtime_runs',idColumn:'run_id',id:receipt.runId,row:{run_id:receipt.runId,envelope_id:receipt.envelopeId,charter_id:receipt.charterId,user_id:receipt.userId,coffer_id:receipt.cofferId,disposition:receipt.disposition,opportunity_id:receipt.opportunityId??null,purse_bus_event_id:receipt.purseBusEventId??null,allocation_plan_id:receipt.allocationPlanId??null,decision_set_id:receipt.decisionSetId??null,rebalance_plan_id:receipt.rebalancePlanId??null,autonomous_intent_id:receipt.autonomousIntentId??null,run_json:encode(receipt.runJson),information_cutoff:receipt.informationCutoff,completed_at:receipt.completedAt,evidence_ids:[...receipt.evidenceIds],authority:'RUNTIME_EVIDENCE_ONLY',can_execute:false},compareColumns:['run_json','evidence_ids'],code:'SHARK_COFFER_RUNTIME_RUN'})
}

export function runtimeRunId(
  envelopeId:string,
  charterId:string,
  disposition:SharkCofferRuntimeRunReceipt['disposition'],
  stateFingerprint='initial',
):string{
  if(!stateFingerprint.trim())throw new Error('SHARK_COFFER_RUNTIME_STATE_FINGERPRINT_REQUIRED')
  return 'shark-coffer-runtime:'+hash({envelopeId,charterId,disposition,stateFingerprint})
}

export function findPurseIntentForOpportunity(input:{
  rebalance:PurseRebalancePlan
  decisions:PurseDecisionSet
  opportunityId:string
}):PurseRebalanceIntent|undefined{
  const decision=input.decisions.allocations.find(x=>x.opportunityId===input.opportunityId)
  if(!decision)return undefined
  return input.rebalance.intents.find(x=>x.strategyId===decision.strategyId&&x.instrumentId===decision.instrumentId&&x.action==='INCREASE')
}


function decodeExecutionEvidence(raw:any):SharkCofferExecutionEvidence{
  const market=raw.market??{}
  const account=raw.account??{}
  const mandate=raw.mandate??{}
  return Object.freeze({
    ...raw,
    market:Object.freeze({
      ...market,
      bidMinor:big(market.bidMinor,'SHARK_COFFER_RUNTIME_EXECUTION_BID_DECODE'),
      askMinor:big(market.askMinor,'SHARK_COFFER_RUNTIME_EXECUTION_ASK_DECODE'),
      visibleDepthNotionalMinor:big(market.visibleDepthNotionalMinor,'SHARK_COFFER_RUNTIME_EXECUTION_DEPTH_DECODE'),
      evidenceIds:Object.freeze(strings(market.evidenceIds)),
    }),
    route:Object.freeze({...raw.route,evidenceIds:Object.freeze(strings(raw.route?.evidenceIds))}),
    account:Object.freeze({
      ...account,
      buyingPowerMinor:big(account.buyingPowerMinor,'SHARK_COFFER_RUNTIME_EXECUTION_BUYING_POWER_DECODE'),
      settledCashMinor:big(account.settledCashMinor,'SHARK_COFFER_RUNTIME_EXECUTION_SETTLED_CASH_DECODE'),
      reservedCashMinor:big(account.reservedCashMinor,'SHARK_COFFER_RUNTIME_EXECUTION_RESERVED_CASH_DECODE'),
      longPositionMarketValueMinorByInstrument:Object.freeze(Object.fromEntries(
        Object.entries(account.longPositionMarketValueMinorByInstrument??{}).map(([key,value])=>[
          key,
          big(value,'SHARK_COFFER_RUNTIME_EXECUTION_LONG_POSITION_DECODE'),
        ]),
      )),
      evidenceIds:Object.freeze(strings(account.evidenceIds)),
    }),
    shadow:Object.freeze({...raw.shadow,reasonCodes:Object.freeze(strings(raw.shadow?.reasonCodes))}),
    shadowCertification:Object.freeze({...raw.shadowCertification,cases:Object.freeze(Array.isArray(raw.shadowCertification?.cases)?raw.shadowCertification.cases:[])}),
    mandate:Object.freeze({
      ...mandate,
      allowedInstrumentPrefixes:Object.freeze(strings(mandate.allowedInstrumentPrefixes)),
      allowedStrategyIds:Object.freeze(strings(mandate.allowedStrategyIds)),
      limits:Object.freeze({
        ...mandate.limits,
        maxOrderNotionalMinor:big(mandate.limits?.maxOrderNotionalMinor,'SHARK_COFFER_RUNTIME_EXECUTION_MANDATE_ORDER_DECODE'),
        maxDailySubmittedNotionalMinor:big(mandate.limits?.maxDailySubmittedNotionalMinor,'SHARK_COFFER_RUNTIME_EXECUTION_MANDATE_DAILY_DECODE'),
        maxDailyRealizedLossMinor:big(mandate.limits?.maxDailyRealizedLossMinor,'SHARK_COFFER_RUNTIME_EXECUTION_MANDATE_LOSS_DECODE'),
        maxGrossExposureMinor:big(mandate.limits?.maxGrossExposureMinor,'SHARK_COFFER_RUNTIME_EXECUTION_MANDATE_EXPOSURE_DECODE'),
      }),
      evidenceIds:Object.freeze(strings(mandate.evidenceIds)),
      canAuthorizeTrade:false,
    }),
    policy:Object.freeze({...raw.policy,canExecute:false}),
    evidenceIds:Object.freeze(strings(raw.evidenceIds)),
    canExecute:false,
  }) as SharkCofferExecutionEvidence
}

export async function appendSharkCofferExecutionEvidence(
  client:SupabaseClient,
  input:Readonly<{
    moneyOpportunityId:string
    userId:string
    cofferId:string
    charterId:string
    evidence:SharkCofferExecutionEvidence
  }>,
):Promise<'INSERTED'|'REPLAY'>{
  const e=input.evidence
  if(e.authority!=='EXECUTION_EVIDENCE_ONLY'||e.canExecute!==false||!e.evidenceIds.length)throw new Error('SHARK_COFFER_RUNTIME_EXECUTION_EVIDENCE_AUTHORITY_INVALID')
  const expiresAt=[e.market.expiresAt,e.account.expiresAt,e.policy.preflightExpiresAt,e.mandate.expiresAt].sort()[0]!
  return insertReplaySafe(client,{
    table:'money_shark_execution_evidence',
    idColumn:'evidence_id',
    id:e.evidenceId,
    row:{
      evidence_id:e.evidenceId,
      opportunity_id:input.moneyOpportunityId,
      user_id:input.userId,
      coffer_id:input.cofferId,
      charter_id:input.charterId,
      evidence_json:encode(e),
      observed_at:e.observedAt,
      available_at:e.availableAt,
      expires_at:expiresAt,
      source:e.source,
      evidence_ids:[...e.evidenceIds],
      authority:'EXECUTION_EVIDENCE_ONLY',
      can_execute:false,
    },
    compareColumns:['opportunity_id','user_id','coffer_id','charter_id','evidence_json'],
    code:'SHARK_COFFER_RUNTIME_EXECUTION_EVIDENCE',
  })
}

export async function loadSharkCofferExecutionEvidence(
  client:SupabaseClient,
  input:Readonly<{
    moneyOpportunityId:string
    userId:string
    cofferId:string
    charterId:string
    now:string
  }>,
):Promise<SharkCofferExecutionEvidence|undefined>{
  const {data,error}=await client.from('money_shark_execution_evidence')
    .select('evidence_json')
    .eq('opportunity_id',input.moneyOpportunityId)
    .eq('user_id',input.userId)
    .eq('coffer_id',input.cofferId)
    .eq('charter_id',input.charterId)
    .lte('available_at',input.now)
    .gt('expires_at',input.now)
    .order('available_at',{ascending:false})
    .limit(1)
    .maybeSingle()
  if(error)throw new Error('SHARK_COFFER_RUNTIME_EXECUTION_EVIDENCE_READ_FAILED:'+error.message)
  return data?decodeExecutionEvidence((data as any).evidence_json):undefined
}
