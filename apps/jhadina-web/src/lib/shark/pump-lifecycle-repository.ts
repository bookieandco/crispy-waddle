import type {SupabaseClient} from '@supabase/supabase-js'
import {
  PumpBondingCurveRpcSource,
  observePumpLifecycle,
  type PumpLifecycleObservationResult,
  type PumpMigrationObservation,
} from '@jhadina/shark-intelligence-core/meme-trader'

export type PumpLifecycleAppendDisposition='INSERTED'|'REPLAY'

export type PumpLaunchQueueRow=Readonly<{
  launch_id:string
  chain_id:string
  token_address:string
  launched_at:string
  launchpad:string|null
  pump_features:any|null
  evidence_ids:string[]|null
}>

export type PumpLifecycleWorkerResult=Readonly<{
  scanned:number
  eligible:number
  processed:number
  inserted:number
  replayed:number
  failed:number
  skipped:number
  failures:readonly Readonly<{launchId:string;reason:string}>[]
}>

const appendResult=(value:unknown):PumpLifecycleAppendDisposition=>{
  if(value==='INSERTED'||value==='REPLAY')return value
  throw new Error('SHARK_PUMP_LIFECYCLE_APPEND_RESULT_INVALID')
}
const isPumpLaunch=(row:PumpLaunchQueueRow):boolean=>{
  const launchpad=row.launchpad?.trim().toLowerCase()
  if(launchpad&&launchpad.includes('pump'))return true
  return row.pump_features?.protocol==='PUMP'
}
const unique=(values:readonly string[])=>[...new Set(values)].sort()

export async function appendPumpLifecycleObservation(
  client:SupabaseClient,
  input:Readonly<{
    launchId:string
    observation:PumpMigrationObservation
    lifecycle:PumpLifecycleObservationResult
    source:string
  }>,
):Promise<PumpLifecycleAppendDisposition>{
  if(!input.launchId.trim()||!input.source.trim())throw new Error('SHARK_PUMP_LIFECYCLE_IDENTITY_REQUIRED')
  if(input.lifecycle.radar.authority!=='RESEARCH_ONLY'||input.lifecycle.canAuthorizeTrade!==false)throw new Error('SHARK_PUMP_LIFECYCLE_AUTHORITY_INVALID')
  const observation=input.observation
  const radar=input.lifecycle.radar
  const payload={
    observationId:observation.observationId,
    launchId:input.launchId,
    mint:observation.mint,
    bondingCurveAddress:observation.bondingCurveAddress??null,
    quoteMint:observation.quoteMint??null,
    stage:radar.stage,
    graduationProgress:radar.graduationProgress,
    realTokenReserves:observation.realTokenReserves?.toString(),
    initialRealTokenReserves:observation.initialRealTokenReserves?.toString(),
    complete:observation.complete,
    mayhemMode:observation.mayhemMode,
    pumpSwapPoolAddress:radar.pumpSwapPoolAddress??null,
    pumpSwapPoolVerified:observation.pumpSwapPoolVerified,
    observedAt:observation.observedAt,
    availableAt:observation.availableAt,
    evidenceIds:unique(observation.evidenceIds),
    source:input.source.trim(),
    radar:{
      candidateId:radar.candidateId,
      discoveryScore:radar.discoveryScore,
      disposition:radar.disposition,
      blockers:[...radar.blockers],
      missingChecks:[...radar.missingChecks],
      authority:radar.authority,
      canAuthorizeTrade:radar.canAuthorizeTrade,
    },
  }
  const {data,error}=await client.rpc('jhadina_shark_append_pump_lifecycle_observation',{p_payload:payload})
  if(error)throw new Error(`SHARK Pump lifecycle append failed: ${error.message}`)
  return appendResult(data)
}

export async function loadPumpLaunchQueue(
  client:SupabaseClient,
  limit=100,
):Promise<readonly PumpLaunchQueueRow[]>{
  if(!Number.isInteger(limit)||limit<1||limit>500)throw new Error('SHARK_PUMP_LIFECYCLE_LIMIT_INVALID')
  const scanLimit=Math.min(2000,Math.max(limit*5,limit))
  const {data,error}=await client
    .from('jhadina_token_launches')
    .select('launch_id,chain_id,token_address,launched_at,launchpad,pump_features,evidence_ids')
    .eq('chain_id','solana-mainnet')
    .order('launched_at',{ascending:false})
    .limit(scanLimit)
  if(error)throw new Error(`SHARK Pump launch queue load failed: ${error.message}`)
  return Object.freeze((data??[]).filter((row:any)=>isPumpLaunch(row as PumpLaunchQueueRow)).slice(0,limit) as PumpLaunchQueueRow[])
}

export async function runPumpLifecycleObservationWorker(
  client:SupabaseClient,
  input:Readonly<{
    rpcUrl:string
    limit?:number
    source?:PumpBondingCurveRpcSource
  }>,
):Promise<PumpLifecycleWorkerResult>{
  const limit=input.limit??100
  const queue=await loadPumpLaunchQueue(client,limit)
  const source=input.source??new PumpBondingCurveRpcSource({rpcUrl:input.rpcUrl})
  let inserted=0,replayed=0,processed=0,failed=0
  const failures:{launchId:string;reason:string}[]=[]

  for(const row of queue){
    try{
      const observation=await source.observe({
        mint:row.token_address,
        evidenceIds:row.evidence_ids??[],
      })
      const lifecycle=observePumpLifecycle({observation})
      const disposition=await appendPumpLifecycleObservation(client,{
        launchId:row.launch_id,
        observation,
        lifecycle,
        source:'pump-bonding-curve-rpc',
      })
      processed++
      if(disposition==='INSERTED')inserted++
      else replayed++
    }catch(error){
      failed++
      failures.push({
        launchId:row.launch_id,
        reason:error instanceof Error?error.message:'unknown_error',
      })
    }
  }

  return Object.freeze({
    scanned:queue.length,
    eligible:queue.length,
    processed,
    inserted,
    replayed,
    failed,
    skipped:0,
    failures:Object.freeze(failures),
  })
}
