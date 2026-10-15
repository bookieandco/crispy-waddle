import assert from 'node:assert/strict'
import test from 'node:test'
import {appendDisposableOrderEventForReview,canonicalOrderEvent,decodePersistedOrderEvent,hashCanonicalOrderEvent,
 type OrderAppendRequest,type DisposableAtomicOrderJournalPort,type PersistedOrderJournalRow} from './biz-purse-durable-order-boundary.js'
const now='2026-10-14T23:00:00Z'
const first:OrderAppendRequest={ownerUserId:'owner:a',orderId:'order:1',expectedLastSequence:0,expectedLastEventId:null,event:{eventId:'created:1',sequence:1,ownerUserId:'owner:a',orderId:'order:1',kind:'ORDER_CREATED',observedAt:now,evidenceId:'evidence:order',customerRef:'client:1',amountMinor:9900n,currency:'USD'}}
const pay:OrderAppendRequest={ownerUserId:'owner:a',orderId:'order:1',expectedLastSequence:1,expectedLastEventId:'created:1',event:{eventId:'payment:1',sequence:2,ownerUserId:'owner:a',orderId:'order:1',kind:'PAYMENT_SETTLED',observedAt:now,evidenceId:'proof:provider',providerPaymentId:'pi:123',amountMinor:9900n,currency:'USD',providerReadbackVerified:true,providerSignatureVerified:true},provider:'provider:test',providerEventRef:'pe:123'}
function fake():DisposableAtomicOrderJournalPort {
 const streams=new Map<string,PersistedOrderJournalRow[]>()
 const eventOwners=new Map<string,string>()
 const providerEvents=new Map<string,string>()
 const settlementIds=new Map<string,string>()
 return {mode:'DISPOSABLE_POSTGRES_TEST_ONLY',
 async appendAtomically(x){
  await Promise.resolve()
  const key=x.ownerUserId+':'+x.orderId, rows=streams.get(key)||[]
  const prior=rows[rows.length-1]
  const owned=x.ownerUserId+':'+x.event.eventId
  const seen=eventOwners.get(owned)
  const existing=rows.find(r=>r.eventId===x.event.eventId)
  if(seen){
   if(seen!==key||!existing||hashCanonicalOrderEvent({...x,event:decodePersistedOrderEvent(existing.event)})!==hashCanonicalOrderEvent(x)||
      existing.provider!==(x.provider??null)||existing.providerEventRef!==(x.providerEventRef??null))
    throw Error('REPLAY_CONFLICT')
   return {outcome:'EXACT_REPLAY' as const,ownerUserId:x.ownerUserId,orderId:x.orderId,eventId:x.event.eventId,sequence:x.event.sequence}
  }
  if(rows.length!==x.expectedLastSequence||(prior?.eventId??null)!==x.expectedLastEventId)throw Error('STALE_HEAD')
  const providerKey=x.provider&&x.providerEventRef?x.ownerUserId+':'+x.provider+':'+x.providerEventRef:null
  if(providerKey&&providerEvents.has(providerKey))throw Error('DUPLICATE_PROVIDER_EVENT')
  const settlementKey=x.event.kind==='PAYMENT_SETTLED'?x.ownerUserId+':'+x.provider+':'+x.event.providerPaymentId:null
  if(settlementKey&&settlementIds.has(settlementKey))throw Error('PAYMENT_REUSED')
  rows.push({ownerUserId:x.ownerUserId,orderId:x.orderId,sequence:x.event.sequence,eventId:x.event.eventId,event:canonicalOrderEvent(x),provider:x.provider??null,providerEventRef:x.providerEventRef??null})
  streams.set(key,rows);eventOwners.set(owned,key)
  if(providerKey)providerEvents.set(providerKey,key)
  if(settlementKey)settlementIds.set(settlementKey,key)
  return {outcome:'APPENDED' as const,ownerUserId:x.ownerUserId,orderId:x.orderId,eventId:x.event.eventId,sequence:x.event.sequence}
 },
 async readOrder(owner,order){return [...(streams.get(owner+':'+order)||[])]}}
}
test('canonical payload retains amounts in integer minor-unit strings',()=>{
 const x=canonicalOrderEvent(pay)
 assert.equal(x.amountMinor,'9900');assert.equal(typeof x.amountMinor,'string')
 assert.equal(hashCanonicalOrderEvent(pay).length,64)
})
test('first append and exact idempotent replay require readback',async()=>{
 const port=fake();const a=await appendDisposableOrderEventForReview(first,port)
 assert.equal(a.status,'READBACK_VERIFIED_REVIEW_ONLY');assert.equal(a.receiptOutcome,'APPENDED')
 const r=await appendDisposableOrderEventForReview(first,port)
 assert.equal(r.receiptOutcome,'EXACT_REPLAY');assert.equal(r.canRecognizeProfit,false)
 const p=await appendDisposableOrderEventForReview(pay,port)
 assert.equal(p.projection?.netSettledMinor,9900n);assert.equal(p.canCharge,false)
})
test('two concurrent writes on the same head admit one and block one',async()=>{
 const port=fake()
 await appendDisposableOrderEventForReview(first,port)
 const alternate={...pay,event:{...pay.event,eventId:'payment:other',providerPaymentId:'pi:other'},providerEventRef:'pe:other'}
 const [a,b]=await Promise.all([appendDisposableOrderEventForReview(pay,port),appendDisposableOrderEventForReview(alternate,port)])
 assert.deepEqual([a.status,b.status].sort(),['BLOCKED_UNCERTAIN','READBACK_VERIFIED_REVIEW_ONLY'])
})
test('same provider payment cannot settle different orders for same owner',async()=>{
 const port=fake();await appendDisposableOrderEventForReview(first,port);await appendDisposableOrderEventForReview(pay,port)
 const other={...first,orderId:'order:2',event:{...first.event,orderId:'order:2',eventId:'created:2'}}
 await appendDisposableOrderEventForReview(other,port)
 const reused={...pay,orderId:'order:2',event:{...pay.event,orderId:'order:2',eventId:'payment:2'},expectedLastEventId:'created:2',providerEventRef:'pe:different'}
 assert.equal((await appendDisposableOrderEventForReview(reused,port)).status,'BLOCKED_UNCERTAIN')
})
test('cross-owner, mismatched prior sequence, missing provider reference and live ports fail closed',async()=>{
 const port=fake()
 await assert.rejects(appendDisposableOrderEventForReview({...first,event:{...first.event,ownerUserId:'other'}},port),/EVENT_INVALID/)
 await assert.rejects(appendDisposableOrderEventForReview({...pay,providerEventRef:undefined},port),/PROVIDER_EVENT_REFERENCE_REQUIRED/)
 await assert.rejects(appendDisposableOrderEventForReview(first,{...port,mode:'LIVE' as never}),/PRODUCTION_PORT_NOT_COMMISSIONED/)
})
test('ambiguous commit or failed readback cannot be treated as success or trigger implicit retry',async()=>{
 const port=fake();let calls=0
 const throwing={...port,appendAtomically:async()=>{calls++;throw Error('network down')}}
 const r=await appendDisposableOrderEventForReview(first,throwing)
 assert.equal(calls,1);assert.equal(r.status,'BLOCKED_UNCERTAIN')
 assert(r.reasonCodes.includes('ATOMIC_APPEND_OUTCOME_UNKNOWN_READBACK_REQUIRED'))
 const corrupt={...port,readOrder:async()=>[]}
 const another=await appendDisposableOrderEventForReview(first,corrupt)
 assert.equal(another.status,'BLOCKED_UNCERTAIN');assert.equal(another.canFulfill,false)
})

test('JSONB roundtrip decodes minor-unit string to bigint but rejects malformed evidence',()=>{
 const wire=canonicalOrderEvent(pay)
 const decoded=decodePersistedOrderEvent(wire)
 assert.equal(decoded.amountMinor,9900n)
 assert.throws(()=>decodePersistedOrderEvent({...wire,amountMinor:'99.00'}),/READBACK_AMOUNT_INVALID/)
 assert.throws(()=>decodePersistedOrderEvent({...wire,paymentAuthorized:true}),/READBACK_EVENT_SHAPE_INVALID/)
 assert.throws(()=>decodePersistedOrderEvent({...wire,amountMinor:'9223372036854775808'}),/READBACK_AMOUNT_RANGE/)
})
test('readback from database with malformed money strings cannot be admitted',async()=>{
 const port=fake()
 const original=await appendDisposableOrderEventForReview(first,port)
 assert.equal(original.status,'READBACK_VERIFIED_REVIEW_ONLY')
 const corrupted={...port,readOrder:async()=>[
  {ownerUserId:first.ownerUserId,orderId:first.orderId,sequence:1,eventId:first.event.eventId,
   event:{...canonicalOrderEvent(first),amountMinor:'9.9'},provider:null,providerEventRef:null}
 ]}
 const result=await appendDisposableOrderEventForReview(first,corrupted)
 assert.equal(result.status,'BLOCKED_UNCERTAIN')
 assert(result.reasonCodes.includes('ATOMIC_APPEND_READBACK_EVENT_DECODE_FAILURE'))
})
