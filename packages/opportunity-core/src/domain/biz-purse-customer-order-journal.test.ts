import test from 'node:test'
import assert from 'node:assert/strict'
import {projectBusinessOrderJournal,type BusinessOrderJournalEvent} from './biz-purse-customer-order-journal.js'
const time='2026-10-14T23:00:00Z'
const base=(sequence:number,kind:BusinessOrderJournalEvent['kind'],extra:Partial<BusinessOrderJournalEvent>={}):BusinessOrderJournalEvent=>({eventId:'event:'+sequence,sequence,kind,ownerUserId:'owner:1',orderId:'order:1',observedAt:time,evidenceId:'proof:'+sequence,...extra})
const draft=base(1,'ORDER_CREATED',{customerRef:'customer:1',amountMinor:9900n,currency:'USD'})
const paid=base(2,'PAYMENT_SETTLED',{providerPaymentId:'pi_one',amountMinor:9900n,currency:'USD',providerReadbackVerified:true,providerSignatureVerified:true})
const accepted=base(3,'DELIVERY_ACCEPTED',{customerRef:'customer:1'})
test('settled customer payment and accepted delivery project without executing',()=>{
 const r=projectBusinessOrderJournal([draft,paid,accepted])
 assert.equal(r.status,'ACCEPTED');assert.equal(r.netSettledMinor,9900n)
 assert.equal(r.canFulfill,false);assert.equal(r.canRecognizeSpendableProfit,false)
})
test('exact repeated receipts are idempotent; conflicting event body cannot replay',()=>{
 const one=projectBusinessOrderJournal([draft,paid]),twice=projectBusinessOrderJournal([draft,paid,paid])
 assert.equal(one.reviewDigest,twice.reviewDigest)
 assert.throws(()=>projectBusinessOrderJournal([draft,paid,{...paid,amountMinor:10000n}]),/EVENT_ID_CONFLICT/)
})
test('gap and out-of-order events fail closed',()=>{
 assert.throws(()=>projectBusinessOrderJournal([paid,draft]),/CREATE_REQUIRED/)
 assert.throws(()=>projectBusinessOrderJournal([draft,{...paid,sequence:4}]),/GAP_OR_REORDER/)
})
test('uncertain payment cannot be converted into an accepted paid order',()=>{
 const unknown=base(2,'PROVIDER_UNKNOWN')
 const r=projectBusinessOrderJournal([draft,unknown,base(3,'DELIVERY_ACCEPTED',{customerRef:'customer:1'})])
 assert.equal(r.status,'BLOCKED');assert(r.unresolvedReasonCodes.includes('UNKNOWN_PROVIDER_OUTCOME_REQUIRES_RECONCILIATION'))
})
test('late refund after acceptance marks reversal debt and blocks revenue',()=>{
 const refund=base(4,'PAYMENT_REFUNDED',{providerPaymentId:'pi_one',amountMinor:9900n,providerReadbackVerified:true,providerSignatureVerified:true})
 const r=projectBusinessOrderJournal([draft,paid,accepted,refund])
 assert.equal(r.status,'BLOCKED');assert.equal(r.netSettledMinor,0n)
 assert(r.unresolvedReasonCodes.includes('REFUND_AFTER_ACCEPTANCE_REQUIRES_REVERSAL'))
})
test('cross-owner events and duplicate payment settlement cannot contaminate journal',()=>{
 assert.throws(()=>projectBusinessOrderJournal([draft,{...paid,ownerUserId:'other'}]),/OWNER_CROSSOVER/)
 assert.throws(()=>projectBusinessOrderJournal([draft,paid,base(3,'PAYMENT_SETTLED',{providerPaymentId:'pi_one',amountMinor:9900n,currency:'USD',providerReadbackVerified:true,providerSignatureVerified:true})]),/DUPLICATE_SETTLEMENT_ID/)
})
test('unsigned observation or cross-customer acceptance is review blocked',()=>{
 const r=projectBusinessOrderJournal([draft,{...paid,providerSignatureVerified:false},{...accepted,customerRef:'customer:other'}])
 assert.equal(r.status,'BLOCKED')
 assert(r.unresolvedReasonCodes.includes('PROVIDER_SETTLEMENT_UNVERIFIED'))
})
