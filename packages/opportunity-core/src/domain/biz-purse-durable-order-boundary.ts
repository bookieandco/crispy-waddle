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
 event:BusinessOrderJournalEvent
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
const nonempty=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<=256&&s.trim()===s
const own=(o:OrderAppendRequest):void=>{
 if(!nonempty(o.ownerUserId)||!nonempty(o.orderId)||
    !Number.isSafeInteger(o.expectedLastSequence)||o.expectedLastSequence<0||
    (o.expectedLastSequence===0?o.expectedLastEventId!==null:!nonempty(o.expectedLastEventId)))
  throw new Error('BIZ_PURSE_15_EXPECTED_HEAD_INVALID')
 const e=o.event
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
 if(rows.some((r,i)=>r.ownerUserId!==input.ownerUserId||r.orderId!==input.orderId||
   r.sequence!==i+1||r.event.sequence!==i+1||r.eventId!==r.event.eventId))
  return blocked(input,'ATOMIC_APPEND_READBACK_OWNER_OR_SEQUENCE_MISMATCH')
 const prior=rows.length>1?rows[rows.length-2]:null
 if((prior?.eventId??null)!==input.expectedLastEventId)return blocked(input,'ATOMIC_APPEND_READBACK_PRIOR_HEAD_MISMATCH')
 const last=rows[rows.length-1]
 if(last.eventId!==input.event.eventId||last.provider!==(input.provider??null)||
    last.providerEventRef!==(input.providerEventRef??null))
  return blocked(input,'ATOMIC_APPEND_READBACK_LAST_EVENT_MISMATCH')
 if(hashCanonicalOrderEvent({...input,event:last.event})!==hashCanonicalOrderEvent(input))
  return blocked(input,'ATOMIC_APPEND_READBACK_PAYLOAD_MISMATCH')
 try{
  const projection=projectBusinessOrderJournal(rows.map(r=>r.event))
  return Object.freeze({status:'READBACK_VERIFIED_REVIEW_ONLY' as const,reasonCodes:Object.freeze([]),
   receiptOutcome:receipt.outcome,orderId:input.orderId,ownerUserId:input.ownerUserId,
   journalDigest:projection.reviewDigest,projection,authority:'DISPOSABLE_JOURNAL_REVIEW_ONLY' as const,
   canCharge:false as const,canFulfill:false as const,canPayOwner:false as const,
   canTrade:false as const,canRecognizeProfit:false as const})
 }catch{return blocked(input,'JOURNAL_PROJECTOR_REJECTED_READBACK')}
}
