import {encodeBase58} from './solana-pda'
import {
  PUMP_EVENT_DISCRIMINATORS,
  type PumpDecodedEventName,
  type PumpDecodedStreamEvent,
} from './pump-decoded-event-stream'
import {PUMP_PROGRAM_ID} from './pump-migration-verifier'

const LOG_PREFIX='Program data: '

class Reader{
  private offset=0
  constructor(private readonly data:Uint8Array){}
  remaining(){return this.data.length-this.offset}
  bytes(length:number){
    if(!Number.isInteger(length)||length<0||this.remaining()<length)throw new Error('pump_anchor_event_truncated')
    const out=this.data.slice(this.offset,this.offset+length)
    this.offset+=length
    return out
  }
  u8(){return this.bytes(1)[0]!}
  bool(){
    const value=this.u8()
    if(value!==0&&value!==1)throw new Error('pump_anchor_event_bool_invalid')
    return value===1
  }
  u32(){
    const b=this.bytes(4)
    return b[0]!|(b[1]!<<8)|(b[2]!<<16)|(b[3]!<<24)>>>0
  }
  u64(){
    const b=this.bytes(8)
    let value=0n
    for(let i=7;i>=0;i--)value=(value<<8n)|BigInt(b[i]!)
    return value
  }
  i64(){
    const value=this.u64()
    return value&(1n<<63n)?value-(1n<<64n):value
  }
  pubkey(){return encodeBase58(this.bytes(32))}
  optionalPubkey(){
    const bytes=this.bytes(32)
    return bytes.every(value=>value===0)?undefined:encodeBase58(bytes)
  }
  string(){
    const length=this.u32()
    if(length>1_000_000)throw new Error('pump_anchor_event_string_too_large')
    return new TextDecoder().decode(this.bytes(length))
  }
}

const decodeBase64=(value:string)=>{
  try{
    const binary=atob(value)
    return Uint8Array.from(binary,char=>char.charCodeAt(0))
  }catch{
    throw new Error('pump_anchor_event_base64_invalid')
  }
}
const same=(a:Uint8Array,b:readonly number[])=>a.length===b.length&&a.every((v,i)=>v===b[i])
const eventName=(disc:Uint8Array):PumpDecodedEventName|undefined=>{
  for(const [name,value] of Object.entries(PUMP_EVENT_DISCRIMINATORS) as [PumpDecodedEventName,readonly number[]][]){
    if(same(disc,value))return name
  }
  return undefined
}
const timestampIso=(seconds:bigint,fallback:string)=>{
  const n=Number(seconds)
  if(!Number.isSafeInteger(n))return fallback
  const date=new Date(n*1000)
  return Number.isNaN(date.getTime())?fallback:date.toISOString()
}

function decodeCreate(r:Reader){
  const name=r.string()
  const symbol=r.string()
  const uri=r.string()
  const mint=r.pubkey()
  const bonding_curve=r.pubkey()
  const user=r.pubkey()
  const creator=r.pubkey()
  const timestamp=r.i64()
  const virtual_token_reserves=r.u64()
  const virtual_sol_reserves=r.u64()
  const real_token_reserves=r.u64()
  const token_total_supply=r.u64()
  const token_program=r.remaining()>=32?r.pubkey():undefined
  const is_mayhem_mode=r.remaining()>=1?r.bool():undefined
  const is_cashback_enabled=r.remaining()>=1?r.bool():undefined
  const quote_mint=r.remaining()>=32?r.optionalPubkey():undefined
  const virtual_quote_reserves=r.remaining()>=8?r.u64():undefined
  const creator_fee_bps=r.remaining()>=8?r.u64():undefined
  const is_holder_reward=r.remaining()>=1?r.bool():undefined
  return {
    name,symbol,uri,mint,bonding_curve,user,creator,timestamp:timestamp.toString(),
    virtual_token_reserves:virtual_token_reserves.toString(),
    virtual_sol_reserves:virtual_sol_reserves.toString(),
    real_token_reserves:real_token_reserves.toString(),
    token_total_supply:token_total_supply.toString(),
    token_program,is_mayhem_mode,is_cashback_enabled,quote_mint,
    virtual_quote_reserves:virtual_quote_reserves?.toString(),
    creator_fee_bps:creator_fee_bps?.toString(),
    is_holder_reward,
  }
}
function decodeTrade(r:Reader){
  const mint=r.pubkey()
  const sol_amount=r.u64()
  const token_amount=r.u64()
  const is_buy=r.bool()
  const user=r.pubkey()
  const timestamp=r.i64()
  const virtual_sol_reserves=r.u64()
  const virtual_token_reserves=r.u64()
  const real_sol_reserves=r.u64()
  const real_token_reserves=r.u64()
  return {
    mint,sol_amount:sol_amount.toString(),token_amount:token_amount.toString(),is_buy,user,
    timestamp:timestamp.toString(),virtual_sol_reserves:virtual_sol_reserves.toString(),
    virtual_token_reserves:virtual_token_reserves.toString(),real_sol_reserves:real_sol_reserves.toString(),
    real_token_reserves:real_token_reserves.toString(),
  }
}
function decodeComplete(r:Reader){
  const user=r.pubkey()
  const mint=r.pubkey()
  const bonding_curve=r.pubkey()
  const timestamp=r.i64()
  const quote_mint=r.remaining()>=32?r.optionalPubkey():undefined
  return {user,mint,bonding_curve,timestamp:timestamp.toString(),quote_mint}
}
function decodeMigration(r:Reader){
  const user=r.pubkey()
  const mint=r.pubkey()
  const mint_amount=r.u64()
  const sol_amount=r.u64()
  const pool_migration_fee=r.u64()
  const bonding_curve=r.pubkey()
  const timestamp=r.i64()
  const pool=r.pubkey()
  const quote_mint=r.remaining()>=32?r.optionalPubkey():undefined
  return {
    user,mint,mint_amount:mint_amount.toString(),sol_amount:sol_amount.toString(),
    pool_migration_fee:pool_migration_fee.toString(),bonding_curve,
    timestamp:timestamp.toString(),pool,quote_mint,
  }
}

export function decodePumpAnchorEventLog(
  log:string,
  metadata:Readonly<{
    signature:string
    slot:number
    eventIndex:number
    receivedAt:string
    source?:string
  }>,
):PumpDecodedStreamEvent|null{
  if(!log.startsWith(LOG_PREFIX))return null
  if(!metadata.signature.trim()||!Number.isSafeInteger(metadata.slot)||metadata.slot<0||!Number.isInteger(metadata.eventIndex)||metadata.eventIndex<0)throw new Error('pump_anchor_event_metadata_invalid')
  if(Number.isNaN(Date.parse(metadata.receivedAt)))throw new Error('pump_anchor_event_received_at_invalid')
  const bytes=decodeBase64(log.slice(LOG_PREFIX.length).trim())
  if(bytes.length<8)return null
  const discriminator=bytes.slice(0,8)
  const name=eventName(discriminator)
  if(!name)return null
  const reader=new Reader(bytes.slice(8))
  let data:Record<string,unknown>
  if(name==='CreateEvent')data=decodeCreate(reader)
  else if(name==='TradeEvent')data=decodeTrade(reader)
  else if(name==='CompleteEvent')data=decodeComplete(reader)
  else data=decodeMigration(reader)
  const timestamp=typeof data.timestamp==='string'&&/^-?[0-9]+$/.test(data.timestamp)?BigInt(data.timestamp):undefined
  const observedAt=timestamp===undefined?metadata.receivedAt:timestampIso(timestamp,metadata.receivedAt)
  return Object.freeze({
    eventId:`log:${metadata.signature}:${metadata.eventIndex}`,
    programId:PUMP_PROGRAM_ID,
    eventName:name,
    eventDiscriminator:Object.freeze([...discriminator]),
    signature:metadata.signature,
    slot:metadata.slot,
    observedAt,
    availableAt:metadata.receivedAt,
    data:Object.freeze(data),
    source:metadata.source?.trim()||'solana-logs-subscribe',
  })
}

export function buildPumpLogsSubscribeRequest(
  input:Readonly<{id?:number;commitment?:'confirmed'|'finalized'}>={},
){
  return Object.freeze({
    jsonrpc:'2.0' as const,
    id:input.id??1,
    method:'logsSubscribe' as const,
    params:Object.freeze([
      Object.freeze({mentions:Object.freeze([PUMP_PROGRAM_ID])}),
      Object.freeze({commitment:input.commitment??'confirmed'}),
    ]),
  })
}


export type SolanaLogsNotification=Readonly<{
  method?:string
  params?:Readonly<{
    result?:Readonly<{
      context?:Readonly<{slot?:number}>
      value?:Readonly<{
        signature?:string
        err?:unknown
        logs?:readonly string[]
      }>
    }>
  }>
}>

const INVOKE=/^Program ([1-9A-HJ-NP-Za-km-z]+) invoke \[\d+\]$/
const EXIT=/^Program ([1-9A-HJ-NP-Za-km-z]+) (?:success|failed:.*)$/

export function decodePumpLogsNotification(
  payload:SolanaLogsNotification,
  receivedAt:string,
  source='solana-logs-subscribe',
):readonly PumpDecodedStreamEvent[]{
  if(Number.isNaN(Date.parse(receivedAt)))throw new Error('pump_logs_notification_received_at_invalid')
  const result=payload.params?.result
  const value=result?.value
  const slot=result?.context?.slot
  const signature=value?.signature
  const logs=value?.logs
  if(payload.method!==undefined&&payload.method!=='logsNotification')return Object.freeze([])
  if(value?.err!==null&&value?.err!==undefined)return Object.freeze([])
  if(!signature||!Number.isSafeInteger(slot)||slot!<0||!Array.isArray(logs))throw new Error('pump_logs_notification_shape_invalid')

  const stack:string[]=[]
  const events:PumpDecodedStreamEvent[]=[]
  let eventIndex=0
  for(const logLine of logs){
    const invoke=INVOKE.exec(logLine)
    if(invoke){stack.push(invoke[1]!);continue}
    const exit=EXIT.exec(logLine)
    if(exit){
      const id=exit[1]!
      const at=stack.lastIndexOf(id)
      if(at>=0)stack.splice(at)
      continue
    }
    if(!logLine.startsWith(LOG_PREFIX))continue
    if(stack.at(-1)!==PUMP_PROGRAM_ID)continue
    const event=decodePumpAnchorEventLog(logLine,{
      signature,
      slot:slot!,
      eventIndex:eventIndex++,
      receivedAt,
      source,
    })
    if(event)events.push(event)
  }
  return Object.freeze(events)
}
