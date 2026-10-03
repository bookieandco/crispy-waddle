import type {SupabaseClient} from '@supabase/supabase-js'
import {
  PumpDecodedEventLifecycleTracker,
  ingestTokenLaunch,
  observePumpLifecycle,
  type PumpDecodedLifecycleState,
  type PumpDecodedLifecycleUpdate,
  type PumpDecodedStreamEvent,
} from '@jhadina/shark-intelligence-core/meme-trader'
import {persistSharkLaunch} from './launch-repository'
import {appendPumpLifecycleObservation,type PumpLifecycleAppendDisposition} from './pump-lifecycle-repository'

type LifecycleRow=Readonly<{
  bonding_curve_address:string|null
  quote_mint:string|null
  initial_real_token_reserves:string|number|null
  curve_complete:boolean|null
  mayhem_mode:boolean|null
}>

export type PumpDecodedEventRuntimeResult=Readonly<{
  launchId:string
  launchPersisted:boolean
  lifecycleDisposition:PumpLifecycleAppendDisposition
  update:PumpDecodedLifecycleUpdate
  authority:'EVIDENCE_ONLY'
  canAuthorizeTrade:false
}>

const mintFrom=(event:PumpDecodedStreamEvent):string=>{
  const value=event.data.mint
  if(typeof value!=='string'||!value.trim())throw new Error('SHARK_PUMP_STREAM_MINT_REQUIRED')
  return value.trim()
}
const bigintOrUndefined=(value:string|number|null|undefined):bigint|undefined=>{
  if(value===null||value===undefined)return undefined
  const text=String(value)
  if(!/^[0-9]+$/.test(text))throw new Error('SHARK_PUMP_STREAM_RESERVE_INVALID')
  return BigInt(text)
}

async function loadPersistedPumpState(
  client:SupabaseClient,
  mint:string,
):Promise<PumpDecodedLifecycleState|undefined>{
  const {data,error}=await client
    .from('jhadina_shark_pump_lifecycle_observations')
    .select('bonding_curve_address,quote_mint,initial_real_token_reserves,curve_complete,mayhem_mode')
    .eq('mint',mint)
    .order('available_at',{ascending:false})
    .limit(1)
  if(error)throw new Error(`SHARK Pump lifecycle state load failed: ${error.message}`)
  const row=(data?.[0]??undefined) as LifecycleRow|undefined
  if(!row)return undefined
  return Object.freeze({
    bondingCurveAddress:row.bonding_curve_address??undefined,
    quoteMint:row.quote_mint??undefined,
    initialRealTokenReserves:bigintOrUndefined(row.initial_real_token_reserves),
    complete:row.curve_complete??undefined,
    mayhemMode:row.mayhem_mode??undefined,
  })
}

async function loadLaunchId(client:SupabaseClient,mint:string):Promise<string|undefined>{
  const {data,error}=await client
    .from('jhadina_token_launches')
    .select('launch_id')
    .eq('chain_id','solana-mainnet')
    .eq('token_address',mint)
    .limit(1)
  if(error)throw new Error(`SHARK Pump launch identity load failed: ${error.message}`)
  const id=data?.[0]?.launch_id
  return typeof id==='string'&&id.trim()?id:undefined
}

/**
 * App-level persistence composition for provider-decoded Pump events.
 * Rehydrates lifecycle state from append-only evidence on every stateless call.
 */
export async function processPumpDecodedStreamEvent(
  client:SupabaseClient,
  event:PumpDecodedStreamEvent,
  options:Readonly<{tracker?:PumpDecodedEventLifecycleTracker}>={},
):Promise<PumpDecodedEventRuntimeResult>{
  const mint=mintFrom(event)
  const tracker=options.tracker??new PumpDecodedEventLifecycleTracker()
  if(event.eventName!=='CreateEvent'&&!tracker.snapshot(mint)){
    const persisted=await loadPersistedPumpState(client,mint)
    if(!persisted)throw new Error('SHARK_PUMP_STREAM_PRIOR_LIFECYCLE_REQUIRED')
    tracker.seed(mint,persisted)
  }

  const update=await tracker.ingest(event)
  let launchId:string|undefined
  let launchPersisted=false

  if(update.launchObservation){
    const ingested=ingestTokenLaunch(update.launchObservation)
    const persisted=await persistSharkLaunch(client,{
      observation:update.launchObservation,
      ingested,
      signature:event.signature,
      slot:event.slot,
    })
    launchId=persisted.launchId
    launchPersisted=true
  }else{
    launchId=await loadLaunchId(client,mint)
    if(!launchId)throw new Error('SHARK_PUMP_STREAM_LAUNCH_REQUIRED')
  }

  const lifecycle=observePumpLifecycle({observation:update.observation})
  const lifecycleDisposition=await appendPumpLifecycleObservation(client,{
    launchId,
    observation:update.observation,
    lifecycle,
    source:event.source,
  })

  return Object.freeze({
    launchId,
    launchPersisted,
    lifecycleDisposition,
    update,
    authority:'EVIDENCE_ONLY',
    canAuthorizeTrade:false,
  })
}
