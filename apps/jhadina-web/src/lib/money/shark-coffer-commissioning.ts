import type {SupabaseClient} from '@supabase/supabase-js'
import type {JhadinaPurseCharter} from '@jhadina/money-core'
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
] as const)

export type SharkCofferCommissioningGateStatus=
  |'PASS'
  |'BLOCKED_EXTERNAL'
  |'WAITING_FOR_EVIDENCE'
  |'OWNER_ACTION_REQUIRED'

export type SharkCofferCommissioningCounts=Readonly<{
  ingressCount:number
  validatedOpportunityCount:number
  purseProcessedRunCount:number
  paperProcessedRunCount:number
  allocationRunCount:number
  executionEvidenceCount:number
  executionPackageCount:number
  autonomousIntentCount:number
}>

export type SharkCofferCommissioningEvaluation=Readonly<{
  schemaReady:boolean
  activeCharterCount:number
  memeEnabledCharterCount:number
  paperMemeCharterCount:number
  liveGovernedMemeCharterCount:number
  counts:SharkCofferCommissioningCounts
  gates:Readonly<{
    commission1:SharkCofferCommissioningGateStatus
    commission3:SharkCofferCommissioningGateStatus
    commission4:SharkCofferCommissioningGateStatus
    commission5:SharkCofferCommissioningGateStatus
    commission6:SharkCofferCommissioningGateStatus
    commission7:SharkCofferCommissioningGateStatus
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
}>

const hasMemeLane=(charter:JhadinaPurseCharter)=>charter.lanePolicies.some(policy=>policy.lane==='MEME'&&policy.enabled)

export function evaluateSharkCofferCommissioning(input:Readonly<{
  schemaReady:boolean
  charters:readonly JhadinaPurseCharter[]
  counts:SharkCofferCommissioningCounts
}>):SharkCofferCommissioningEvaluation{
  const meme=input.charters.filter(hasMemeLane)
  const paper=meme.filter(charter=>charter.autonomyMode==='PAPER_AUTONOMOUS')
  const live=meme.filter(charter=>charter.autonomyMode==='LIVE_GOVERNED_INTENTS')
  return Object.freeze({
    schemaReady:input.schemaReady,
    activeCharterCount:input.charters.length,
    memeEnabledCharterCount:meme.length,
    paperMemeCharterCount:paper.length,
    liveGovernedMemeCharterCount:live.length,
    counts:Object.freeze({...input.counts}),
    gates:Object.freeze({
      commission1:input.schemaReady?'PASS':'BLOCKED_EXTERNAL',
      commission3:meme.length>0?'PASS':'OWNER_ACTION_REQUIRED',
      commission4:input.counts.ingressCount>0?'PASS':'WAITING_FOR_EVIDENCE',
      commission5:input.counts.validatedOpportunityCount>0?'PASS':'WAITING_FOR_EVIDENCE',
      commission6:paper.length===0
        ?'OWNER_ACTION_REQUIRED'
        :input.counts.paperProcessedRunCount>0?'PASS':'WAITING_FOR_EVIDENCE',
      commission7:input.counts.allocationRunCount>0?'PASS':'WAITING_FOR_EVIDENCE',
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
  if(!schemaReady){
    const zero:SharkCofferCommissioningCounts={
      ingressCount:0,validatedOpportunityCount:0,purseProcessedRunCount:0,paperProcessedRunCount:0,
      allocationRunCount:0,executionEvidenceCount:0,executionPackageCount:0,autonomousIntentCount:0,
    }
    const evaluation=evaluateSharkCofferCommissioning({schemaReady:false,charters:[],counts:zero})
    return Object.freeze({...evaluation,observedAt,since,windowHours,tableChecks:Object.freeze(tableChecks)})
  }

  const charters=await loadActivePurseCharters(input.client,observedAt)
  const paperCharterIds=new Set(charters.filter(c=>hasMemeLane(c)&&c.autonomyMode==='PAPER_AUTONOMOUS').map(c=>c.charterId))

  const [
    ingressCount,
    executionEvidenceCount,
    executionPackageCount,
    autonomousIntentCount,
    opportunityRows,
    runRows,
    latestIngress,
  ]=await Promise.all([
    countRecent(input.client,'money_shark_runtime_ingress','created_at',since),
    countRecent(input.client,'money_shark_execution_evidence','created_at',since),
    countRecent(input.client,'money_shark_execution_packages','observed_at',since),
    countRecent(input.client,'money_shark_autonomous_intents','created_at',since),
    input.client.from('money_opportunities_v2').select('opportunity_id,trade_mims_json,validation_json,created_at').gte('created_at',since).order('created_at',{ascending:false}).limit(500),
    input.client.from('money_shark_coffer_runtime_runs').select('charter_id,disposition,opportunity_id,allocation_plan_id,decision_set_id,rebalance_plan_id,completed_at').gte('completed_at',since).order('completed_at',{ascending:false}).limit(500),
    input.client.from('money_shark_runtime_ingress').select('created_at').order('created_at',{ascending:false}).limit(1).maybeSingle(),
  ])
  if(opportunityRows.error)throw new Error('SHARK_COFFER_COMMISSIONING_OPPORTUNITY_READ_FAILED:'+opportunityRows.error.message)
  if(runRows.error)throw new Error('SHARK_COFFER_COMMISSIONING_RUN_READ_FAILED:'+runRows.error.message)
  if(latestIngress.error)throw new Error('SHARK_COFFER_COMMISSIONING_INGRESS_LATEST_FAILED:'+latestIngress.error.message)

  const opportunities=opportunityRows.data??[]
  const runs=runRows.data??[]
  const validatedOpportunityCount=opportunities.filter((row:any)=>row.trade_mims_json&&row.validation_json).length
  const purseProcessed=new Set(['PURSE_ADMITTED','PURSE_NOT_ALLOCATED','ALLOCATED','PREFLIGHT_BLOCKED','AUTONOMOUS_INTENT_READY'])
  const purseProcessedRunCount=runs.filter((row:any)=>purseProcessed.has(String(row.disposition))).length
  const paperProcessedRunCount=runs.filter((row:any)=>paperCharterIds.has(String(row.charter_id))&&purseProcessed.has(String(row.disposition))).length
  const allocationRunCount=runs.filter((row:any)=>Boolean(row.allocation_plan_id&&row.decision_set_id&&row.rebalance_plan_id)).length
  const counts:SharkCofferCommissioningCounts={
    ingressCount,validatedOpportunityCount,purseProcessedRunCount,paperProcessedRunCount,allocationRunCount,
    executionEvidenceCount,executionPackageCount,autonomousIntentCount,
  }
  const evaluation=evaluateSharkCofferCommissioning({schemaReady:true,charters,counts})
  const latestRunAt=runs.length?String((runs[0] as any).completed_at):undefined
  const latestIngressAt=(latestIngress.data as any)?.created_at?String((latestIngress.data as any).created_at):undefined
  return Object.freeze({
    ...evaluation,
    observedAt,
    since,
    windowHours,
    tableChecks:Object.freeze(tableChecks),
    ...(latestIngressAt?{latestIngressAt}:{}),
    ...(latestRunAt?{latestRunAt}:{}),
  })
}
