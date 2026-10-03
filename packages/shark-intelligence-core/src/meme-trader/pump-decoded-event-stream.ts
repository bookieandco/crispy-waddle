import {
  buildPumpMigrationRadarCandidate,
  type PumpMigrationObservation,
  type PumpMigrationRadarCandidate,
} from './migration-radar'
import {derivePumpBondingCurveAddress} from './pump-bonding-curve-rpc'
import {PUMP_PROGRAM_ID} from './pump-migration-verifier'
import {normalizePumpLaunchFeatures} from './pump-v2-launch-features'
import type {TokenLaunchObservation} from './token-launch-ingest'

export const PUMP_EVENT_DISCRIMINATORS=Object.freeze({
  CreateEvent:Object.freeze([27,114,169,77,222,235,99,118] as const),
  CompleteEvent:Object.freeze([95,114,97,156,212,46,152,8] as const),
  CompletePumpAmmMigrationEvent:Object.freeze([189,233,93,185,92,148,234,148] as const),
  TradeEvent:Object.freeze([189,219,127,211,78,230,97,238] as const),
})

export type PumpDecodedEventName=keyof typeof PUMP_EVENT_DISCRIMINATORS

export type PumpDecodedStreamEvent=Readonly<{
  eventId:string
  programId:string
  eventName:PumpDecodedEventName
  eventDiscriminator?:readonly number[]
  signature:string
  slot:number
  observedAt:string
  availableAt:string
  data:Readonly<Record<string,unknown>>
  source:string
}>

export type PumpDecodedLifecycleUpdate=Readonly<{
  event:PumpDecodedStreamEvent
  observation:PumpMigrationObservation
  radar:PumpMigrationRadarCandidate
  launchObservation?:TokenLaunchObservation
  migrationPoolHint?:string
  migrationPoolVerified:false
  authority:'EVIDENCE_ONLY'
  canAuthorizeTrade:false
}>

export type PumpDecodedLifecycleState=Readonly<{
  initialRealTokenReserves?:bigint
  bondingCurveAddress?:string
  quoteMint?:string
  mayhemMode?:boolean
  complete?:boolean
}>

const str=(data:Readonly<Record<string,unknown>>,snake:string,camel:string)=>{
  const value=data[snake]??data[camel]
  return typeof value==='string'&&value.trim()?value.trim():undefined
}
const bool=(data:Readonly<Record<string,unknown>>,snake:string,camel:string)=>{
  const value=data[snake]??data[camel]
  return typeof value==='boolean'?value:undefined
}
const bigintValue=(data:Readonly<Record<string,unknown>>,snake:string,camel:string)=>{
  const value=data[snake]??data[camel]
  if(typeof value==='bigint')return value>=0n?value:undefined
  if(typeof value==='number')return Number.isSafeInteger(value)&&value>=0?BigInt(value):undefined
  if(typeof value==='string'&&/^[0-9]+$/.test(value))return BigInt(value)
  return undefined
}
const same=(a:readonly number[]|undefined,b:readonly number[])=>a===undefined||(a.length===b.length&&a.every((v,i)=>v===b[i]))
const validIso=(value:string)=>Boolean(value)&&!Number.isNaN(Date.parse(value))
const evidenceId=(event:PumpDecodedStreamEvent)=>`pump-event:${event.signature}:${event.eventId}`

function assertDecodedEvent(event:PumpDecodedStreamEvent):void{
  if(!event.eventId.trim()||!event.signature.trim()||!event.source.trim())throw new Error('pump_stream_event_identity_required')
  if(event.programId!==PUMP_PROGRAM_ID)throw new Error('pump_stream_event_program_invalid')
  if(!Number.isSafeInteger(event.slot)||event.slot<0)throw new Error('pump_stream_event_slot_invalid')
  if(!validIso(event.observedAt)||!validIso(event.availableAt)||Date.parse(event.availableAt)<Date.parse(event.observedAt))throw new Error('pump_stream_event_clock_invalid')
  if(!same(event.eventDiscriminator,PUMP_EVENT_DISCRIMINATORS[event.eventName]))throw new Error('pump_stream_event_discriminator_invalid')
}

export class PumpDecodedEventLifecycleTracker{
  private readonly state=new Map<string,PumpDecodedLifecycleState>()

  seed(mint:string,state:PumpDecodedLifecycleState):void{
    if(!mint.trim())throw new Error('pump_stream_seed_mint_required')
    this.state.set(mint,Object.freeze({...state}))
  }

  snapshot(mint:string):PumpDecodedLifecycleState|undefined{
    const value=this.state.get(mint)
    return value?Object.freeze({...value}):undefined
  }

  async ingest(event:PumpDecodedStreamEvent):Promise<PumpDecodedLifecycleUpdate>{
    assertDecodedEvent(event)
    const mint=str(event.data,'mint','mint')
    if(!mint)throw new Error('pump_stream_event_mint_required')
    const prior=this.state.get(mint)??{}
    const canonicalCurve=(await derivePumpBondingCurveAddress(mint)).address
    if(prior.bondingCurveAddress&&prior.bondingCurveAddress!==canonicalCurve)throw new Error('pump_stream_prior_curve_binding_invalid')
    const providedCurve=str(event.data,'bonding_curve','bondingCurve')
    if(providedCurve&&providedCurve!==canonicalCurve)throw new Error('pump_stream_curve_binding_invalid')
    const curve=providedCurve??canonicalCurve
    const quoteMint=str(event.data,'quote_mint','quoteMint')??prior.quoteMint
    const currentReal=bigintValue(event.data,'real_token_reserves','realTokenReserves')
    const mayhem=bool(event.data,'is_mayhem_mode','isMayhemMode')??bool(event.data,'mayhem_mode','mayhemMode')??prior.mayhemMode
    const eId=evidenceId(event)
    let initial=prior.initialRealTokenReserves
    let complete=prior.complete
    let launchObservation:TokenLaunchObservation|undefined
    let migrationPoolHint:string|undefined

    if(event.eventName==='CreateEvent'){
      if(currentReal===undefined)throw new Error('pump_stream_create_real_reserves_required')
      initial=currentReal
      complete=false
      const creator=str(event.data,'creator','creator')
      const user=str(event.data,'user','user')
      const creatorFeeBpsRaw=bigintValue(event.data,'creator_fee_bps','creatorFeeBps')
      const features=normalizePumpLaunchFeatures({
        observationKind:'CREATE_EVENT',
        observedAt:event.observedAt,
        evidenceIds:[eId],
        mayhemMode:mayhem,
        quoteMint,
        creatorArgument:creator,
        recordedCreator:creator,
        isCashbackCoin:bool(event.data,'is_cashback_enabled','isCashbackEnabled'),
        isHolderReward:bool(event.data,'is_holder_reward','isHolderReward'),
        creatorFeeBps:creatorFeeBpsRaw===undefined?undefined:Number(creatorFeeBpsRaw),
      })
      launchObservation={
        observationId:eId,
        chainId:'solana-mainnet',
        tokenAddress:mint,
        observedAt:event.observedAt,
        deployerWalletId:user??creator,
        launchpad:'pump.fun',
        pumpFeatures:features,
        evidenceIds:[eId,`solana-signature:${event.signature}`,`solana-slot:${event.slot}`],
        source:event.source,
      }
    }else if(event.eventName==='CompleteEvent'){
      complete=true
    }else if(event.eventName==='CompletePumpAmmMigrationEvent'){
      complete=true
      migrationPoolHint=str(event.data,'pool','pool')
      if(!migrationPoolHint)throw new Error('pump_stream_migration_pool_required')
    }else if(event.eventName==='TradeEvent'){
      if(currentReal===undefined)throw new Error('pump_stream_trade_real_reserves_required')
      if(currentReal===0n)complete=true
    }

    const next:PumpDecodedLifecycleState={
      initialRealTokenReserves:initial,
      bondingCurveAddress:curve,
      quoteMint,
      mayhemMode:mayhem,
      complete,
    }
    this.state.set(mint,next)

    const observation:PumpMigrationObservation=Object.freeze({
      observationId:`pump-stream:${event.signature}:${event.eventId}`,
      mint,
      quoteMint,
      bondingCurveAddress:curve,
      mayhemMode:mayhem,
      observedAt:event.observedAt,
      availableAt:event.availableAt,
      initialRealTokenReserves:initial,
      realTokenReserves:currentReal??(complete?0n:undefined),
      complete,
      ...(migrationPoolHint?{pumpSwapPoolAddress:migrationPoolHint,pumpSwapPoolVerified:false}:{}),
      evidenceIds:Object.freeze([eId,`solana-signature:${event.signature}`,`solana-slot:${event.slot}`]),
    })
    const radar=buildPumpMigrationRadarCandidate(observation)
    return Object.freeze({
      event,
      observation,
      radar,
      launchObservation,
      migrationPoolHint,
      migrationPoolVerified:false,
      authority:'EVIDENCE_ONLY',
      canAuthorizeTrade:false,
    })
  }
}
