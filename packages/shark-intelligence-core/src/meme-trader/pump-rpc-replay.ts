import {PUMP_PROGRAM_ID} from './pump-migration-verifier'
import type {SolanaLogsNotification} from './pump-anchor-log-decoder'

/** SHARK-ALPHA.FABRIC.06 — bounded public JSON-RPC retrospective evidence.
 * It never certifies complete recovery or authorizes time-sensitive alerts. */
export type PumpRpcRequest=Readonly<{jsonrpc:'2.0';id:number;method:string;params:readonly unknown[]}>
export type PumpRpcSend=(request:PumpRpcRequest)=>Promise<unknown>
export type PumpReplayReceipt=Readonly<{
  notifications:readonly SolanaLogsNotification[]
  requested:number
  recovered:number
  missing:number
  cursorSlot?:number
  gapStatus:'PARTIAL_UNVERIFIED'
  retrospectiveOnly:true
  canAlertAsEarly:false
  canAuthorizeTrade:false
}>
const asRecord=(v:unknown):Record<string,unknown>|null=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:null
const MAX=64
export async function readPumpRpcReplay(input:Readonly<{
  request:PumpRpcSend
  afterSlot?:number
  receivedAt:string
  limit?:number
}>):Promise<PumpReplayReceipt>{
  const limit=input.limit??32
  if(!Number.isInteger(limit)||limit<1||limit>MAX)throw new Error('shark_pump_replay_limit_invalid')
  if(input.afterSlot!==undefined&&(!Number.isSafeInteger(input.afterSlot)||input.afterSlot<0))
    throw new Error('shark_pump_replay_cursor_invalid')
  if(!Number.isFinite(Date.parse(input.receivedAt)))throw new Error('shark_pump_replay_clock_invalid')
  const list=asRecord(await input.request({
    jsonrpc:'2.0',id:11,method:'getSignaturesForAddress',
    params:[PUMP_PROGRAM_ID,{limit,commitment:'confirmed'}],
  }))
  if(!list||list.error||!Array.isArray(list.result))throw new Error('shark_pump_replay_listing_unavailable')
  const rows=list.result
  if(rows.length>limit)throw new Error('shark_pump_replay_over_limit')
  const filtered:{signature:string;slot:number}[]=[]
  const unique=new Set<string>()
  for(const item of rows){
    const record=asRecord(item)
    const signature=record?.signature,slot=record?.slot
    if(typeof signature!=='string'||!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)||
      typeof slot!=='number'||!Number.isSafeInteger(slot)||slot<0)
      throw new Error('shark_pump_replay_identity_invalid')
    if(record?.err!==null){continue}
    if(input.afterSlot!==undefined&&Number(slot)<input.afterSlot)continue
    if(unique.has(signature))continue
    unique.add(signature)
    filtered.push({signature,slot:Number(slot)})
  }
  // The signature list is reverse-chronological and within-slot ordering is NOT attested;
  // sorting merely enables deterministic review, not a claim of complete chain coverage.
  filtered.sort((a,b)=>a.slot-b.slot||a.signature.localeCompare(b.signature))
  const notifications:SolanaLogsNotification[]=[]
  let missing=0
  for(const item of filtered){
    const response=asRecord(await input.request({
      jsonrpc:'2.0',id:12,method:'getTransaction',
      params:[item.signature,{encoding:'json',commitment:'confirmed',maxSupportedTransactionVersion:0}],
    }))
    const result=asRecord(response?.result)
    const meta=asRecord(result?.meta)
    const logs=meta?.logMessages
    if(response?.error||!result||Number(result.slot)!==item.slot||!meta||
      meta.err!==null||!Array.isArray(logs)||logs.length>300||
      logs.some(line=>typeof line!=='string'||line.length>20000)){
      missing++;continue
    }
    notifications.push(Object.freeze({
      method:'logsNotification' as const,
      params:{result:{context:{slot:item.slot},value:{signature:item.signature,err:null,logs:logs as string[]}}},
    }))
  }
  return Object.freeze({
    notifications:Object.freeze(notifications),requested:filtered.length,
    recovered:notifications.length,missing,
    cursorSlot:filtered.length?filtered[filtered.length-1]!.slot:input.afterSlot,
    gapStatus:'PARTIAL_UNVERIFIED' as const,retrospectiveOnly:true as const,
    canAlertAsEarly:false as const,canAuthorizeTrade:false as const,
  })
}
export function createReadOnlyPumpRpcSender(url:string,fetcher:typeof fetch=fetch):PumpRpcSend{
  let parsed:URL
  try{parsed=new URL(url)}catch{throw new Error('shark_pump_rpc_url_invalid')}
  if(parsed.protocol!=='https:'||parsed.username||parsed.password||parsed.hash)throw new Error('shark_pump_rpc_url_invalid')
  return async request=>{
    const reply=await fetcher(parsed.toString(),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(request),signal:AbortSignal.timeout(8000),
    })
    if(!reply.ok)throw new Error('shark_pump_rpc_response_unavailable')
    const raw=await reply.text()
    if(raw.length>1_000_000)throw new Error('shark_pump_rpc_response_oversize')
    return JSON.parse(raw)
  }
}
