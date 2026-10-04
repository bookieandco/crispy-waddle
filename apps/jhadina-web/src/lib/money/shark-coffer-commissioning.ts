import type {SupabaseClient} from '@supabase/supabase-js'
import {DEX_SIGNED_SIMULATION_NO_BROADCAST_EVIDENCE,type JhadinaPurseCharter} from '@jhadina/money-core'
import {loadActivePurseCharters} from './shark-coffer-runtime-repository'

export const SHARK_COFFER_COMMISSIONING_TABLES=Object.freeze([
  'money_shark_runtime_ingress',
  'money_fusion_evidence_events',
  'money_financial_theses_v2',
  'money_dialectical_assessments',
  'money_opportunities_v2',
  'money_shark_execution_evidence',
  'money_shark_execution_packages',
  'money_shark_autonomous_intents',
  'money_shark_coffer_runtime_runs',
  'money_purse_charters',
  'money_purse_opportunity_events',
  'money_purse_allocation_plans',
  'money_purse_decision_sets',
  'money_purse_rebalance_plans',
  'money_dex_shadow_runs',
  'money_wallet_connections',
  'money_signer_leases',
  'money_market_connector_admissions',
  'money_dex_execution_attempts',
] as const)

export type SharkCofferCommissioningGateStatus=
  |'PASS'
  |'BLOCKED_EXTERNAL'
  |'WAITING_FOR_EVIDENCE'
  |'OWNER_ACTION_REQUIRED'

export type SharkCofferShadowMetric=Readonly<{
  shadowRunId:string
  provider:string
  instrumentId:string
  quoteAgeMs:number
  observedSlippageBps:number
  feeBps:number
  observedAt:string
}>

export type SharkCofferCommissioningCounts=Readonly<{
  ingressCount:number
  validatedOpportunityCount:number
  marketLiquidityEvidenceCount:number
  purseProcessedRunCount:number
  paperProcessedRunCount:number
  allocationRunCount:number
  executionEvidenceCount:number
  executionPackageCount:number
  autonomousIntentCount:number
  pumpExecutionRouteEvidenceCount:number
  dexShadowRunCount:number
  measuredShadowRunCount:number
  activeCofferWalletCount:number
  commissionedDexConnectorCount:number
  signedSimulationNoBroadcastCount:number
  boundSignerLeaseCount:number
}>

export type SharkCofferCommissioningEvaluation=Readonly<{
  schemaReady:boolean
  schedulerOidcVerified:boolean
  activeCharterCount:number
  memeEnabledCharterCount:number
  paperMemeCharterCount:number
  liveGovernedMemeCharterCount:number
  counts:SharkCofferCommissioningCounts
  gates:Readonly<{
    commission1:SharkCofferCommissioningGateStatus
    commission2:SharkCofferCommissioningGateStatus
    commission3:SharkCofferCommissioningGateStatus
    commission4:SharkCofferCommissioningGateStatus
    commission5:SharkCofferCommissioningGateStatus
    commission6:SharkCofferCommissioningGateStatus
    commission7:SharkCofferCommissioningGateStatus
    commission8:SharkCofferCommissioningGateStatus
    commission9:SharkCofferCommissioningGateStatus
    commission10:SharkCofferCommissioningGateStatus
  }>
  authority:'COMMISSIONING_EVIDENCE_ONLY'
  canExecute:false
}>

export type SharkCofferCommissioningSnapshot=SharkCofferCommissioningEvaluation & Readonly<{
  observedAt:string
  since:string
  windowHours:number
  tableChecks:Readonly<Record<string,boolean>>
  latestIngressAt?:string
  latestRunAt?:string
  latestShadowMetrics:readonly SharkCofferShadowMetric[]
}>

const hasMemeLane=(charter:JhadinaPurseCharter)=>charter.lanePolicies.some(policy=>policy.lane==='MEME'&&policy.enabled)
const object=(value:unknown):Record<string,unknown>|undefined=>
  value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:undefined
const nonEmpty=(value:unknown)=>typeof value==='string'&&value.trim().length>0
const nonNegativeInt=(value:unknown)=>typeof value==='number'&&Number.isInteger(value)&&value>=0

function pumpVenue(value:unknown):boolean{
  if(typeof value!=='string')return false
  const normalized=value.toLowerCase().replace(/[^a-z0-9]/g,'')
  return normalized==='pump'||normalized==='pumpfun'||normalized==='pumpswap'
}

function qualifyingMarketRoute(value:unknown):{instrumentId?:string;pump:boolean}|undefined{
  const evidence=object(value)
  const market=object(evidence?.market)
  const route=object(evidence?.route)
  if(!market||!route)return undefined
  if(route.status!=='ACCEPTING')return undefined
  if(!nonEmpty(market.instrumentId)||market.instrumentId!==route.instrumentId)return undefined
  if(!Array.isArray(market.evidenceIds)||market.evidenceIds.length===0)return undefined
  if(!Array.isArray(route.evidenceIds)||route.evidenceIds.length===0)return undefined
  return {instrumentId:String(market.instrumentId),pump:pumpVenue(route.venue)}
}

function shadowMetric(row:any,pumpInstruments:ReadonlySet<string>):SharkCofferShadowMetric|undefined{
  if(row.signed_transaction_count!==0||row.broadcast_count!==0)return undefined
  if(!nonEmpty(row.selected_provider)||!nonEmpty(row.instrument_id)||!pumpInstruments.has(String(row.instrument_id)))return undefined
  const certification=object(row.certification)
  if(certification?.passed!==true)return undefined
  const route=object(row.route_decision)
  const selected=object(route?.selected)
  if(!selected||String(selected.provider??'')!==String(row.selected_provider))return undefined
  const attempts=Array.isArray(route?.attempts)?route!.attempts:[]
  const selectedAttempt=attempts.map(object).find(attempt=>String(attempt?.provider??'')===String(row.selected_provider))
  const gate=object(selectedAttempt?.gate)
  if(!gate)return undefined
  const feeBps=selected.feeBps
  const quoteAgeMs=gate.quoteAgeMs
  const observedSlippageBps=gate.observedSlippageBps
  if(!nonNegativeInt(feeBps)||!nonNegativeInt(quoteAgeMs)||!nonNegativeInt(observedSlippageBps))return undefined
  return Object.freeze({
    shadowRunId:String(row.shadow_run_id),
    provider:String(row.selected_provider),
    instrumentId:String(row.instrument_id),
    quoteAgeMs:Number(quoteAgeMs),
    observedSlippageBps:Number(observedSlippageBps),
    feeBps:Number(feeBps),
    observedAt:new Date(row.observed_at).toISOString(),
  })
}

export function evaluateSharkCofferCommissioning(input:Readonly<{
  schemaReady:boolean
  schedulerOidcVerified:boolean
  charters:readonly JhadinaPurseCharter[]
  counts:SharkCofferCommissioningCounts
}>):SharkCofferCommissioningEvaluation{
  const meme=input.charters.filter(hasMemeLane)
  const paper=meme.filter(charter=>charter.autonomyMode==='PAPER_AUTONOMOUS')
  const live=meme.filter(charter=>charter.autonomyMode==='LIVE_GOVERNED_INTENTS')
  const signedSimulationReady=
    input.counts.activeCofferWalletCount>0&&
    input.counts.commissionedDexConnectorCount>0&&
    input.counts.boundSignerLeaseCount>0&&
    input.counts.signedSimulationNoBroadcastCount>0
  return Object.freeze({
    schemaReady:input.schemaReady,
    schedulerOidcVerified:input.schedulerOidcVerified,
    activeCharterCount:input.charters.length,
    memeEnabledCharterCount:meme.length,
    paperMemeCharterCount:paper.length,
    liveGovernedMemeCharterCount:live.length,
    counts:Object.freeze({...input.counts}),
    gates:Object.freeze({
      commission1:input.schemaReady?'PASS':'BLOCKED_EXTERNAL',
      commission2:input.schedulerOidcVerified?'PASS':'BLOCKED_EXTERNAL',
      commission3:meme.length>0?'PASS':'OWNER_ACTION_REQUIRED',
      commission4:input.counts.ingressCount>0?'PASS':'WAITING_FOR_EVIDENCE',
      commission5:input.counts.marketLiquidityEvidenceCount>0?'PASS':'WAITING_FOR_EVIDENCE',
      commission6:paper.length===0
        ?'OWNER_ACTION_REQUIRED'
        :input.counts.validatedOpportunityCount>0&&input.counts.paperProcessedRunCount>0?'PASS':'WAITING_FOR_EVIDENCE',
      commission7:input.counts.allocationRunCount>0?'PASS':'WAITING_FOR_EVIDENCE',
      commission8:input.counts.pumpExecutionRouteEvidenceCount>0?'PASS':'WAITING_FOR_EVIDENCE',
      commission9:signedSimulationReady?'PASS':'WAITING_FOR_EVIDENCE',
      commission10:input.counts.measuredShadowRunCount>0?'PASS':'WAITING_FOR_EVIDENCE',
    }),
    authority:'COMMISSIONING_EVIDENCE_ONLY',
    canExecute:false,
  })
}

function boundedWindowHours(value:number):number{
  if(!Number.isInteger(value)||value<1||value>168)throw new Error('SHARK_COFFER_COMMISSIONING_WINDOW_INVALID')
  return value
}

async function countRecent(client:SupabaseClient,table:string,timeColumn:string,since:string):Promise<number>{
  const {count,error}=await client.from(table).select('*',{count:'exact',head:true}).gte(timeColumn,since)
  if(error)throw new Error('SHARK_COFFER_COMMISSIONING_COUNT_FAILED:'+table+':'+error.message)
  return count??0
}

export async function collectSharkCofferCommissioningSnapshot(input:Readonly<{
  client:SupabaseClient
  schedulerOidcVerified:boolean
  now?:string
  windowHours?:number
}>):Promise<SharkCofferCommissioningSnapshot>{
  const observedAt=input.now??new Date().toISOString()
  if(Number.isNaN(Date.parse(observedAt)))throw new Error('SHARK_COFFER_COMMISSIONING_NOW_INVALID')
  const windowHours=boundedWindowHours(input.windowHours??24)
  const since=new Date(Date.parse(observedAt)-windowHours*60*60*1000).toISOString()

  const tableChecks:Record<string,boolean>={}
  for(const table of SHARK_COFFER_COMMISSIONING_TABLES){
    const {error}=await input.client.from(table).select('*',{head:true,count:'exact'}).limit(1)
    tableChecks[table]=!error
  }
  const schemaReady=SHARK_COFFER_COMMISSIONING_TABLES.every(table=>tableChecks[table]===true)
  const zero:SharkCofferCommissioningCounts={
    ingressCount:0,validatedOpportunityCount:0,marketLiquidityEvidenceCount:0,purseProcessedRunCount:0,paperProcessedRunCount:0,
    allocationRunCount:0,executionEvidenceCount:0,executionPackageCount:0,autonomousIntentCount:0,pumpExecutionRouteEvidenceCount:0,
    dexShadowRunCount:0,measuredShadowRunCount:0,activeCofferWalletCount:0,commissionedDexConnectorCount:0,
    signedSimulationNoBroadcastCount:0,boundSignerLeaseCount:0,
  }
  if(!schemaReady){
    const evaluation=evaluateSharkCofferCommissioning({
      schemaReady:false,schedulerOidcVerified:input.schedulerOidcVerified,charters:[],counts:zero,
    })
    return Object.freeze({...evaluation,observedAt,since,windowHours,tableChecks:Object.freeze(tableChecks),latestShadowMetrics:Object.freeze([])})
  }

  const charters=await loadActivePurseCharters(input.client,observedAt)
  const paperCharterIds=new Set(charters.filter(c=>hasMemeLane(c)&&c.autonomyMode==='PAPER_AUTONOMOUS').map(c=>c.charterId))

  const [
    ingressCount,
    executionPackageCount,
    autonomousIntentCount,
    opportunityRows,
    runRows,
    executionEvidenceRows,
    shadowRows,
    walletRows,
    connectorRows,
    signerLeaseRows,
    attemptRows,
    latestIngress,
  ]=await Promise.all([
    countRecent(input.client,'money_shark_runtime_ingress','created_at',since),
    countRecent(input.client,'money_shark_execution_packages','observed_at',since),
    countRecent(input.client,'money_shark_autonomous_intents','created_at',since),
    input.client.from('money_opportunities_v2').select('opportunity_id,trade_mims_json,validation_json,created_at').gte('created_at',since).order('created_at',{ascending:false}).limit(500),
    input.client.from('money_shark_coffer_runtime_runs').select('charter_id,disposition,opportunity_id,allocation_plan_id,decision_set_id,rebalance_plan_id,completed_at').gte('completed_at',since).order('completed_at',{ascending:false}).limit(500),
    input.client.from('money_shark_execution_evidence').select('evidence_id,evidence_json,observed_at,available_at,source').gte('available_at',since).order('available_at',{ascending:false}).limit(500),
    input.client.from('money_dex_shadow_runs').select('shadow_run_id,instrument_id,observed_at,selected_provider,route_decision,stage_evidence,certification,signed_transaction_count,broadcast_count').gte('observed_at',since).order('observed_at',{ascending:false}).limit(500),
    input.client.from('money_wallet_connections').select('connection_id,provider,network,mode,status,connected_at,updated_at').eq('mode','COFFER_EXECUTION_WALLET').eq('status','ACTIVE').limit(500),
    input.client.from('money_market_connector_admissions').select('connector_id,provider,lane,admission,updated_at').eq('lane','DEX').limit(500),
    input.client.from('money_signer_leases').select('lease_id,wallet_connection_id,issued_at,expires_at,state').limit(1000),
    input.client.from('money_dex_execution_attempts').select('attempt_id,wallet_connection_id,signer_lease_id,provider,simulation_id,simulated_fee_lamports,signed_transaction_hash,primary_signature,provider_request_id,provider_receipt_id,state,evidence_ids,started_at,updated_at').gte('started_at',since).order('started_at',{ascending:false}).limit(500),
    input.client.from('money_shark_runtime_ingress').select('created_at').order('created_at',{ascending:false}).limit(1).maybeSingle(),
  ])
  const failures=[
    ['opportunities',opportunityRows.error],['runs',runRows.error],['execution-evidence',executionEvidenceRows.error],
    ['shadow-runs',shadowRows.error],['wallets',walletRows.error],['connectors',connectorRows.error],
    ['signer-leases',signerLeaseRows.error],['execution-attempts',attemptRows.error],['latest-ingress',latestIngress.error],
  ] as const
  for(const [name,error] of failures)if(error)throw new Error('SHARK_COFFER_COMMISSIONING_READ_FAILED:'+name+':'+error.message)

  const opportunities=opportunityRows.data??[]
  const runs=runRows.data??[]
  const executionEvidence=executionEvidenceRows.data??[]
  const shadows=shadowRows.data??[]
  const wallets=walletRows.data??[]
  const connectors=connectorRows.data??[]
  const signerLeases=signerLeaseRows.data??[]
  const attempts=attemptRows.data??[]

  const validatedOpportunityCount=opportunities.filter((row:any)=>row.trade_mims_json&&row.validation_json).length
  const purseProcessed=new Set(['PURSE_ADMITTED','PURSE_NOT_ALLOCATED','ALLOCATED','PREFLIGHT_BLOCKED','AUTONOMOUS_INTENT_READY'])
  const purseProcessedRunCount=runs.filter((row:any)=>purseProcessed.has(String(row.disposition))).length
  const paperProcessedRunCount=runs.filter((row:any)=>paperCharterIds.has(String(row.charter_id))&&purseProcessed.has(String(row.disposition))).length
  const allocationRunCount=runs.filter((row:any)=>Boolean(row.allocation_plan_id&&row.decision_set_id&&row.rebalance_plan_id)).length

  const marketRoutes=executionEvidence.flatMap((row:any)=>{
    const parsed=qualifyingMarketRoute(row.evidence_json)
    return parsed?[parsed]:[]
  })
  const marketLiquidityEvidenceCount=marketRoutes.length
  const pumpRoutes=marketRoutes.filter(route=>route.pump)
  const pumpExecutionRouteEvidenceCount=pumpRoutes.length
  const pumpInstruments=new Set(pumpRoutes.flatMap(route=>route.instrumentId?[route.instrumentId]:[]))

  const activeWalletIds=new Set(wallets.map((row:any)=>String(row.connection_id)))
  const admittedProviders=new Set(connectors.filter((row:any)=>
    typeof row.provider==='string'&&!row.provider.startsWith('unassigned-')&&
    ['SHADOW','CONTROLLED_CANARY','LIVE'].includes(String(row.admission)),
  ).map((row:any)=>String(row.provider)))
  const commissionedDexConnectorCount=admittedProviders.size

  const leaseById=new Map(signerLeases.map((row:any)=>[String(row.lease_id),row] as const))
  let signedSimulationNoBroadcastCount=0
  const boundLeaseIds=new Set<string>()
  for(const attempt of attempts as any[]){
    if(String(attempt.state)!=='SIMULATED')continue
    if(!nonEmpty(attempt.simulation_id)||!nonEmpty(attempt.signed_transaction_hash)||!nonEmpty(attempt.primary_signature)||!nonEmpty(attempt.provider_request_id))continue
    if(attempt.provider_receipt_id!==null&&attempt.provider_receipt_id!==undefined)continue
    if(!Array.isArray(attempt.evidence_ids)||!attempt.evidence_ids.includes(DEX_SIGNED_SIMULATION_NO_BROADCAST_EVIDENCE))continue
    if(!activeWalletIds.has(String(attempt.wallet_connection_id)))continue
    if(!admittedProviders.has(String(attempt.provider)))continue
    const lease=leaseById.get(String(attempt.signer_lease_id)) as any
    if(!lease||String(lease.wallet_connection_id)!==String(attempt.wallet_connection_id))continue
    const started=Date.parse(String(attempt.started_at))
    const issued=Date.parse(String(lease.issued_at))
    const expires=Date.parse(String(lease.expires_at))
    if(!Number.isFinite(started)||!Number.isFinite(issued)||!Number.isFinite(expires)||started<issued||started>=expires)continue
    signedSimulationNoBroadcastCount+=1
    boundLeaseIds.add(String(attempt.signer_lease_id))
  }
  const boundSignerLeaseCount=boundLeaseIds.size

  const metrics=shadows.flatMap((row:any)=>{
    const metric=shadowMetric(row,pumpInstruments)
    return metric?[metric]:[]
  })
  const counts:SharkCofferCommissioningCounts={
    ingressCount,validatedOpportunityCount,marketLiquidityEvidenceCount,purseProcessedRunCount,paperProcessedRunCount,allocationRunCount,
    executionEvidenceCount:executionEvidence.length,executionPackageCount,autonomousIntentCount,pumpExecutionRouteEvidenceCount,
    dexShadowRunCount:shadows.length,measuredShadowRunCount:metrics.length,activeCofferWalletCount:activeWalletIds.size,
    commissionedDexConnectorCount,signedSimulationNoBroadcastCount,boundSignerLeaseCount,
  }
  const evaluation=evaluateSharkCofferCommissioning({
    schemaReady:true,schedulerOidcVerified:input.schedulerOidcVerified,charters,counts,
  })
  const latestRunAt=runs.length?String((runs[0] as any).completed_at):undefined
  const latestIngressAt=(latestIngress.data as any)?.created_at?String((latestIngress.data as any).created_at):undefined
  return Object.freeze({
    ...evaluation,
    observedAt,
    since,
    windowHours,
    tableChecks:Object.freeze(tableChecks),
    latestShadowMetrics:Object.freeze(metrics.slice(0,20)),
    ...(latestIngressAt?{latestIngressAt}:{}),
    ...(latestRunAt?{latestRunAt}:{}),
  })
}
