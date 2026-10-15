import {createHash} from 'node:crypto'
import {projectBusinessOrderJournal,type BusinessOrderJournalEvent,type BusinessOrderJournalProjection} from './biz-purse-customer-order-journal.js'

/**
 * BIZ-PURSE.15 — test-only atomic order append adapter.
 *
 * Only a reviewed private PostgreSQL transaction can make a write durable.
 * This port deliberately excludes live Supabase and financial provider adapters.
 */
export type OrderAppendRequest=Readonly<{
 ownerUserId:string
 orderId:string
 expectedLastSequence:number
 expectedLastEventId:string|null
 event:BusinessOrderJournalEvent
 provider?:string
 providerEventRef?:string
}>
export type PersistedOrderJournalRow=Readonly<{
 ownerUserId:string
 orderId:string
 sequence:number
 eventId:string
 event:unknown
 provider:string|null
 providerEventRef:string|null
}>
export type AtomicAppendReceipt=Readonly<{
 outcome:'APPENDED'|'EXACT_REPLAY'
 ownerUserId:string
 orderId:string
 eventId:string
 sequence:number
}>
export type DisposableAtomicOrderJournalPort=Readonly<{
 mode:'DISPOSABLE_POSTGRES_TEST_ONLY'
 appendAtomically(request:OrderAppendRequest):Promise<AtomicAppendReceipt>
 readOrder(ownerUserId:string,orderId:string):Promise<readonly PersistedOrderJournalRow[]>
}>
export type DurableOrderReview=Readonly<{
 status:'READBACK_VERIFIED_REVIEW_ONLY'|'BLOCKED_UNCERTAIN'
 reasonCodes:readonly string[]
 receiptOutcome:'APPENDED'|'EXACT_REPLAY'|null
 orderId:string
 ownerUserId:string
 journalDigest:string|null
 projection:BusinessOrderJournalProjection|null
 authority:'DISPOSABLE_JOURNAL_REVIEW_ONLY'
 canCharge:false
 canFulfill:false
 canPayOwner:false
 canTrade:false
 canRecognizeProfit:false
}>
const MINOR_MAX=9223372036854775807n
const EVENT_KEYS=new Set(['eventId','sequence','ownerUserId','orderId','kind','observedAt','evidenceId',
 'providerPaymentId','providerReadbackVerified','providerSignatureVerified','amountMinor','currency','customerRef','synthetic'])
/** Never return untrusted JSONB directly to the bigint accounting projector. */
export function decodePersistedOrderEvent(raw:unknown):BusinessOrderJournalEvent {
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('BIZ_PURSE_15_READBACK_EVENT_INVALID')
 const v=raw as Record<string,unknown>
 if(Object.keys(v).some(key=>!EVENT_KEYS.has(key))||
    typeof v.ownerUserId!=='string'||typeof v.orderId!=='string'||typeof v.eventId!=='string'||
    typeof v.evidenceId!=='string'||typeof v.kind!=='string'||typeof v.observedAt!=='string'||
    !Number.isSafeInteger(v.sequence)||!Number.isFinite(Date.parse(v.observedAt)))
  throw new Error('BIZ_PURSE_15_READBACK_EVENT_SHAPE_INVALID')
 for(const k of ['providerPaymentId','currency','customerRef'])
  if(v[k]!==undefined && typeof v[k]!=='string')throw new Error('BIZ_PURSE_15_READBACK_OPTIONAL_TEXT_INVALID')
 for(const k of ['providerReadbackVerified','providerSignatureVerified','synthetic'])
  if(v[k]!==undefined && typeof v[k]!=='boolean')throw new Error('BIZ_PURSE_15_READBACK_OPTIONAL_BOOL_INVALID')
 let amount:bigint|undefined
 if(v.amountMinor!==undefined){
  if(typeof v.amountMinor!=='string'||!/^[1-9][0-9]{0,18}$/.test(v.amountMinor))
   throw new Error('BIZ_PURSE_15_READBACK_AMOUNT_INVALID')
  amount=BigInt(v.amountMinor)
  if(amount>MINOR_MAX)throw new Error('BIZ_PURSE_15_READBACK_AMOUNT_RANGE')
 }
 return {
  ownerUserId:v.ownerUserId,orderId:v.orderId,eventId:v.eventId,evidenceId:v.evidenceId,
  sequence:v.sequence as number,kind:v.kind as BusinessOrderJournalEvent['kind'],observedAt:v.observedAt,
  ...(v.providerPaymentId!==undefined?{providerPaymentId:v.providerPaymentId as string}:{}),
  ...(v.providerReadbackVerified!==undefined?{providerReadbackVerified:v.providerReadbackVerified as boolean}:{}),
  ...(v.providerSignatureVerified!==undefined?{providerSignatureVerified:v.providerSignatureVerified as boolean}:{}),
  ...(amount!==undefined?{amountMinor:amount}:{}),
  ...(v.currency!==undefined?{currency:v.currency as string}:{}),
  ...(v.customerRef!==undefined?{customerRef:v.customerRef as string}:{}),
  ...(v.synthetic!==undefined?{synthetic:v.synthetic as boolean}:{})
 }
}
const nonempty=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<=256&&s.trim()===s
const own=(o:OrderAppendRequest):void=>{
 if(!nonempty(o.ownerUserId)||!nonempty(o.orderId)||
    !Number.isSafeInteger(o.expectedLastSequence)||o.expectedLastSequence<0||
    (o.expectedLastSequence===0?o.expectedLastEventId!==null:!nonempty(o.expectedLastEventId)))
  throw new Error('BIZ_PURSE_15_EXPECTED_HEAD_INVALID')
 const e=o.event
 if(e.amountMinor!==undefined&&(typeof e.amountMinor!=='bigint'||e.amountMinor<=0n||e.amountMinor>MINOR_MAX))throw new Error('BIZ_PURSE_15_AMOUNT_OUT_OF_RANGE')
 if(!e||!nonempty(e.eventId)||!nonempty(e.evidenceId)||e.ownerUserId!==o.ownerUserId||
    e.orderId!==o.orderId||!Number.isSafeInteger(e.sequence)||e.sequence!==o.expectedLastSequence+1||
    !Number.isFinite(Date.parse(e.observedAt))||!['ORDER_CREATED','PROVIDER_UNKNOWN','PAYMENT_SETTLED','PAYMENT_REFUNDED','DELIVERY_ACCEPTED'].includes(e.kind))
  throw new Error('BIZ_PURSE_15_EVENT_INVALID')
 if((e.kind==='ORDER_CREATED')!== (e.sequence===1))throw new Error('BIZ_PURSE_15_CREATION_SEQUENCE_INVALID')
 if((e.kind==='PAYMENT_SETTLED'||e.kind==='PAYMENT_REFUNDED')&&
    (!nonempty(o.provider)||!nonempty(o.providerEventRef)||!nonempty(e.providerPaymentId)||
    !nonempty(e.currency)||typeof e.amountMinor!=='bigint'||e.amountMinor<=0n))
  throw new Error('BIZ_PURSE_15_PROVIDER_EVENT_REFERENCE_REQUIRED')
 if(e.kind!=='PAYMENT_SETTLED'&&e.kind!=='PAYMENT_REFUNDED'&&
    (o.provider!==undefined||o.providerEventRef!==undefined))
  throw new Error('BIZ_PURSE_15_NONPAYMENT_PROVIDER_ID_REJECTED')
 if(e.kind==='ORDER_CREATED'&&(!nonempty(e.customerRef)||!nonempty(e.currency)||typeof e.amountMinor!=='bigint'||e.amountMinor<=0n))
  throw new Error('BIZ_PURSE_15_ORDER_SCOPE_INVALID')
}
export function canonicalOrderEvent(input:OrderAppendRequest):Readonly<Record<string,unknown>>{
 own(input)
 const e=input.event
 return Object.freeze({
  eventId:e.eventId,sequence:e.sequence,ownerUserId:e.ownerUserId,orderId:e.orderId,kind:e.kind,
  observedAt:e.observedAt,evidenceId:e.evidenceId,
  ...(e.providerPaymentId?{providerPaymentId:e.providerPaymentId}:{}),
  ...(e.providerReadbackVerified!==undefined?{providerReadbackVerified:e.providerReadbackVerified}:{}),
  ...(e.providerSignatureVerified!==undefined?{providerSignatureVerified:e.providerSignatureVerified}:{}),
  ...(e.amountMinor!==undefined?{amountMinor:e.amountMinor.toString()}:{}),
  ...(e.currency?{currency:e.currency}:{}),
  ...(e.customerRef?{customerRef:e.customerRef}:{}),
  ...(e.synthetic!==undefined?{synthetic:e.synthetic}:{}),
 })
}
export function hashCanonicalOrderEvent(input:OrderAppendRequest):string{
 return createHash('sha256').update(JSON.stringify(canonicalOrderEvent(input))).digest('hex')
}
function blocked(input:OrderAppendRequest,reason:string):DurableOrderReview{
 return Object.freeze({status:'BLOCKED_UNCERTAIN',reasonCodes:Object.freeze([reason]),
  receiptOutcome:null,orderId:input.orderId,ownerUserId:input.ownerUserId,journalDigest:null,projection:null,
  authority:'DISPOSABLE_JOURNAL_REVIEW_ONLY' as const,canCharge:false as const,canFulfill:false as const,
  canPayOwner:false as const,canTrade:false as const,canRecognizeProfit:false as const})
}
/**
 * A thrown append or failed readback must NOT cause an automatic resend.
 * Caller must reconcile by independent readback before deciding about retries.
 */
export async function appendDisposableOrderEventForReview(
 input:OrderAppendRequest,port:DisposableAtomicOrderJournalPort,
):Promise<DurableOrderReview>{
 canonicalOrderEvent(input)
 if(!port||port.mode!=='DISPOSABLE_POSTGRES_TEST_ONLY')throw new Error('BIZ_PURSE_15_PRODUCTION_PORT_NOT_COMMISSIONED')
 let receipt:AtomicAppendReceipt
 try{receipt=await port.appendAtomically(input)}catch{return blocked(input,'ATOMIC_APPEND_OUTCOME_UNKNOWN_READBACK_REQUIRED')}
 if(receipt.ownerUserId!==input.ownerUserId||receipt.orderId!==input.orderId||
    receipt.eventId!==input.event.eventId||receipt.sequence!==input.event.sequence||
    !['APPENDED','EXACT_REPLAY'].includes(receipt.outcome))
  return blocked(input,'ATOMIC_APPEND_RECEIPT_MISMATCH')
 let rows:readonly PersistedOrderJournalRow[]
 try{rows=await port.readOrder(input.ownerUserId,input.orderId)}catch{return blocked(input,'ATOMIC_APPEND_READBACK_FAILED')}
 if(!Array.isArray(rows)||rows.length!==input.event.sequence)return blocked(input,'ATOMIC_APPEND_READBACK_COUNT_MISMATCH')
 let decoded:BusinessOrderJournalEvent[]
 try{decoded=rows.map(r=>decodePersistedOrderEvent(r.event))}
 catch{return blocked(input,'ATOMIC_APPEND_READBACK_EVENT_DECODE_FAILURE')}
 if(rows.some((r,i)=>r.ownerUserId!==input.ownerUserId||r.orderId!==input.orderId||
   r.sequence!==i+1||decoded[i].sequence!==i+1||r.eventId!==decoded[i].eventId||
   decoded[i].orderId!==input.orderId||decoded[i].ownerUserId!==input.ownerUserId))
  return blocked(input,'ATOMIC_APPEND_READBACK_OWNER_OR_SEQUENCE_MISMATCH')
 const prior=rows.length>1?rows[rows.length-2]:null
 if((prior?.eventId??null)!==input.expectedLastEventId)return blocked(input,'ATOMIC_APPEND_READBACK_PRIOR_HEAD_MISMATCH')
 const last=rows[rows.length-1]
 if(last.eventId!==input.event.eventId||last.provider!==(input.provider??null)||
    last.providerEventRef!==(input.providerEventRef??null))
  return blocked(input,'ATOMIC_APPEND_READBACK_LAST_EVENT_MISMATCH')
 if(hashCanonicalOrderEvent({...input,event:decoded[decoded.length-1]})!==hashCanonicalOrderEvent(input))
  return blocked(input,'ATOMIC_APPEND_READBACK_PAYLOAD_MISMATCH')
 try{
  const projection=projectBusinessOrderJournal(decoded)
  return Object.freeze({status:'READBACK_VERIFIED_REVIEW_ONLY' as const,reasonCodes:Object.freeze([]),
   receiptOutcome:receipt.outcome,orderId:input.orderId,ownerUserId:input.ownerUserId,
   journalDigest:projection.reviewDigest,projection,authority:'DISPOSABLE_JOURNAL_REVIEW_ONLY' as const,
   canCharge:false as const,canFulfill:false as const,canPayOwner:false as const,
   canTrade:false as const,canRecognizeProfit:false as const})
 }catch{return blocked(input,'JOURNAL_PROJECTOR_REJECTED_READBACK')}
}
