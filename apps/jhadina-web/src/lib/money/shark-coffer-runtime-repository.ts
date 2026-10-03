import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {PersistedActorAwareAssessmentInput} from '@/lib/shark/actor-aware-assessment-service'
import {
  buildCofferTreasurySnapshot,
  type CofferAssetBalanceEvidence,
  type CofferTreasurySnapshot,
  type ExecutionPlan,
  type AutonomousTradingMandate,
  type JhadinaPurseCharter,
  type LiveExecutionPreflight,
  type PurseAllocationPlan,
  type PurseAllocatorCapitalEvidence,
  type PurseDecisionSet,
  type PurseExposureEvidence,
  type PurseOpportunity,
  type PurseOpportunityEnvelope,
  type PursePortfolioSnapshot,
  type PurseRebalanceIntent,
  type PurseRebalancePlan,
  type RebalanceIntent,
  type SharkCofferRuntimeResearch,
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
  envelope:SharkMoneyTransportEnvelope
  market:SharkMoneyRuntimeMarketEvidence
  source:string
  createdAt:string
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

export type SharkCofferRuntimeRunReceipt=Readonly<{
  runId:string
  envelopeId:string
  charterId:string
  userId:string
  cofferId:string
  disposition:'BLOCKED'|'RESEARCH_ONLY'|'PURSE_REJECTED'|'PURSE_ADMITTED'|'ALLOCATED'|'AUTONOMOUS_INTENT_READY'
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
    envelope:SharkMoneyTransportEnvelope
    assessment:PersistedActorAwareAssessmentInput
    source:string
    createdAt:string
  }>,
):Promise<'INSERTED'|'REPLAY'>{
  if(!input.source.trim())throw new Error('SHARK_COFFER_RUNTIME_INGRESS_SOURCE_REQUIRED')
  iso(input.createdAt,'SHARK_COFFER_RUNTIME_INGRESS_TIME_INVALID')
  const market=marketEvidenceFromAssessment({envelope:input.envelope,assessment:input.assessment})
  const row={
    envelope_id:input.envelope.envelopeId,
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
  const {data:existing,error:readError}=await client.from('money_shark_runtime_ingress').select('envelope_json,market_evidence_json,source').eq('envelope_id',input.envelope.envelopeId).maybeSingle()
  if(readError||!existing)throw new Error('SHARK_COFFER_RUNTIME_INGRESS_REPLAY_READ_FAILED:'+(readError?.message??'missing'))
  if(hash((existing as any).envelope_json)!==hash(row.envelope_json)||hash((existing as any).market_evidence_json)!==hash(row.market_evidence_json)||String((existing as any).source)!==input.source)throw new Error('SHARK_COFFER_RUNTIME_INGRESS_CONFLICT')
  return 'REPLAY'
}

export async function listSharkRuntimeIngress(client:SupabaseClient,limit=100):Promise<readonly SharkRuntimeIngressRecord[]>{
  const bounded=Math.max(1,Math.min(500,Math.trunc(limit)))
  const {data,error}=await client.from('money_shark_runtime_ingress').select('envelope_json,market_evidence_json,source,created_at').order('created_at',{ascending:true}).limit(bounded)
  if(error)throw new Error('SHARK_COFFER_RUNTIME_INGRESS_READ_FAILED:'+error.message)
  return Object.freeze((data??[]).map((row:any)=>Object.freeze({
    envelope:row.envelope_json as SharkMoneyTransportEnvelope,
    market:row.market_evidence_json as SharkMoneyRuntimeMarketEvidence,
    source:String(row.source),
    createdAt:String(row.created_at),
  })))
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
    const lanePolicies=Array.isArray(cfg.lanePolicies)?cfg.lanePolicies:[]
    const charter:JhadinaPurseCharter=Object.freeze({
      charterId:String(r.charter_id),charterVersion:String(r.charter_version),userId:String(r.user_id),cofferId:String(r.coffer_id),reportingCurrency:String(r.reporting_currency),autonomyMode:r.autonomy_mode,
      maxTotalDeployableBps:Number(cfg.maxTotalDeployableBps),minLiquidReserveMinor:big(cfg.minLiquidReserveMinor,'SHARK_COFFER_RUNTIME_CHARTER_LIQUID_RESERVE_DECODE'),minEmergencyReserveMinor:big(cfg.minEmergencyReserveMinor,'SHARK_COFFER_RUNTIME_CHARTER_EMERGENCY_RESERVE_DECODE'),
      maxSingleOpportunityBps:Number(cfg.maxSingleOpportunityBps),maxCorrelatedExposureBps:Number(cfg.maxCorrelatedExposureBps),maxRebalanceTurnoverBps:Number(cfg.maxRebalanceTurnoverBps),
      lanePolicies:Object.freeze(lanePolicies.map((x:any)=>Object.freeze({...x,maxAllocationBps:Number(x.maxAllocationBps),maxSinglePositionBps:Number(x.maxSinglePositionBps),minConfidenceBps:Number(x.minConfidenceBps)}))),
      verifiedOwnerPayoutDestinationId:String(r.verified_owner_payout_destination_id),ownerProfitSweepProtected:cfg.ownerProfitSweepProtected!==false,charterMutationRequiresOwnerApproval:cfg.charterMutationRequiresOwnerApproval!==false,ownerDestinationMutationRequiresOwnerApproval:cfg.ownerDestinationMutationRequiresOwnerApproval!==false,
      jhadinaMayAllocate:cfg.jhadinaMayAllocate===true,jhadinaMayRebalance:cfg.jhadinaMayRebalance===true,effectiveAt:String(r.effective_at),expiresAt:r.expires_at?String(r.expires_at):undefined,
      evidenceIds:Object.freeze(strings(r.evidence_ids)),authority:'OWNER_TREASURY_CHARTER',canExecute:false,
    })
    rows.push(charter);seen.add(charter.userId)
  }
  return Object.freeze(rows)
}

export async function hasRuntimeRun(client:SupabaseClient,envelopeId:string,charterId:string):Promise<boolean>{
  const {data,error}=await client.from('money_shark_coffer_runtime_runs').select('run_id').eq('envelope_id',envelopeId).eq('charter_id',charterId).limit(1)
  if(error)throw new Error('SHARK_COFFER_RUNTIME_RUN_LOOKUP_FAILED:'+error.message)
  return Boolean((data??[]).length)
}

export async function countStrategyCalibrationSamples(client:SupabaseClient,strategyId:string,userId?:string):Promise<number>{
  let query=client.from('money_purse_learning_events').select('learning_event_id',{count:'exact',head:true}).eq('strategy_id',strategyId).in('source',['SHARK_CLOSED_TRADE','PURSE_OUTCOME','PAPER_STRATEGY'])
  if(userId)query=query.eq('user_id',userId)
  const {count,error}=await query
  if(error)throw new Error('SHARK_COFFER_RUNTIME_CALIBRATION_READ_FAILED:'+error.message)
  return count??0
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

export async function loadExecutionPackage(client:SupabaseClient,input:{envelopeId:string;charterId:string;opportunityId:string;rebalancePlanId:string;now:string}):Promise<SharkExecutionPlanningPackage|undefined>{
  const {data,error}=await client.from('money_shark_execution_packages').select('*').eq('envelope_id',input.envelopeId).eq('charter_id',input.charterId).eq('opportunity_id',input.opportunityId).eq('rebalance_plan_id',input.rebalancePlanId).lte('observed_at',input.now).gt('expires_at',input.now).order('observed_at',{ascending:false}).limit(1).maybeSingle()
  if(error)throw new Error('SHARK_COFFER_RUNTIME_EXECUTION_PACKAGE_READ_FAILED:'+error.message)
  if(!data)return undefined
  const r=data as any
  const canonical={...r.canonical_intent_json,notional:{...r.canonical_intent_json.notional,minor:big(r.canonical_intent_json.notional.minor,'EXECUTION_CANONICAL_NOTIONAL_DECODE')}} as RebalanceIntent
  const plan={...r.execution_plan_json,notional:{...r.execution_plan_json.notional,minor:big(r.execution_plan_json.notional.minor,'EXECUTION_PLAN_NOTIONAL_DECODE')},slices:(r.execution_plan_json.slices??[]).map((s:any)=>({...s,notional:{...s.notional,minor:big(s.notional.minor,'EXECUTION_SLICE_NOTIONAL_DECODE')},limitPriceMinor:big(s.limitPriceMinor,'EXECUTION_SLICE_PRICE_DECODE')}))} as ExecutionPlan
  return Object.freeze({packageId:String(r.package_id),envelopeId:String(r.envelope_id),charterId:String(r.charter_id),opportunityId:String(r.opportunity_id),rebalancePlanId:String(r.rebalance_plan_id),purseIntentId:String(r.purse_intent_id),canonicalIntent:Object.freeze(canonical),executionPlan:Object.freeze(plan),preflight:Object.freeze(r.preflight_json) as LiveExecutionPreflight,observedAt:String(r.observed_at),expiresAt:String(r.expires_at),evidenceIds:Object.freeze(strings(r.evidence_ids)),authority:'EXECUTION_PLANNING_EVIDENCE_ONLY',canExecute:false})
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

export async function appendRuntimeRun(client:SupabaseClient,receipt:SharkCofferRuntimeRunReceipt):Promise<'INSERTED'|'REPLAY'>{
  return insertReplaySafe(client,{table:'money_shark_coffer_runtime_runs',idColumn:'run_id',id:receipt.runId,row:{run_id:receipt.runId,envelope_id:receipt.envelopeId,charter_id:receipt.charterId,user_id:receipt.userId,coffer_id:receipt.cofferId,disposition:receipt.disposition,opportunity_id:receipt.opportunityId??null,purse_bus_event_id:receipt.purseBusEventId??null,allocation_plan_id:receipt.allocationPlanId??null,decision_set_id:receipt.decisionSetId??null,rebalance_plan_id:receipt.rebalancePlanId??null,autonomous_intent_id:receipt.autonomousIntentId??null,run_json:encode(receipt.runJson),information_cutoff:receipt.informationCutoff,completed_at:receipt.completedAt,evidence_ids:[...receipt.evidenceIds],authority:'RUNTIME_EVIDENCE_ONLY',can_execute:false},compareColumns:['run_json','evidence_ids'],code:'SHARK_COFFER_RUNTIME_RUN'})
}

export function runtimeRunId(envelopeId:string,charterId:string):string{return 'shark-coffer-runtime:'+hash({envelopeId,charterId})}

export function findPurseIntentForOpportunity(input:{
  rebalance:PurseRebalancePlan
  decisions:PurseDecisionSet
  opportunityId:string
}):PurseRebalanceIntent|undefined{
  const decision=input.decisions.allocations.find(x=>x.opportunityId===input.opportunityId)
  if(!decision)return undefined
  return input.rebalance.intents.find(x=>x.strategyId===decision.strategyId&&x.instrumentId===decision.instrumentId&&x.action==='INCREASE')
}
