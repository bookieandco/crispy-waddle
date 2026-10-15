import assert from 'node:assert/strict'
import test from 'node:test'
import {assessVentureScoutResearch,assessCommercialPayment,assessCommercialDelivery,type BusinessEvidenceRef,type BusinessPaymentObservation} from './biz-purse-commercial-gates.js'
const asOf='2026-10-14T23:00:00Z'
const ev=(id:string,domain='example.org'):BusinessEvidenceRef=>({id,sourceUrl:'https://'+domain+'/case/'+id,observedAt:asOf,independentlyObserved:true,synthetic:false})
const payment:BusinessPaymentObservation={orderId:'order:1',ownerUserId:'owner:1',providerAccountOwnerId:'owner:1',paymentOrderId:'order:1',providerPaymentId:'pi_1',amountMinor:9900n,expectedAmountMinor:9900n,currency:'USD',expectedCurrency:'USD',providerState:'SETTLED',providerReadbackVerified:true,webhookSignatureVerified:true,providerReceiptId:'provider:receipt:1',synthetic:false,observedAt:asOf,asOf}
test('real timestamped independent research evidence can advance only to review',()=>{
 const r=assessVentureScoutResearch({family:'business_automation',approvedFamily:'business_automation',observedAt:asOf,maxAgeDays:30,distinctSourcesRequired:2,evidence:[ev('1'),ev('2','elsewhere.org')]})
 assert.equal(r.status,'REVIEW_READY');assert.equal(r.externalActionAuthorized,false)
})
test('synthetic, stale or one-domain research is blocked',()=>{
 const r=assessVentureScoutResearch({family:'business_automation',approvedFamily:'business_automation',observedAt:asOf,maxAgeDays:2,distinctSourcesRequired:2,evidence:[{...ev('1'),synthetic:true},{...ev('2'),observedAt:'2026-09-01T00:00:00Z'}]})
 assert.equal(r.status,'BLOCKED');assert(r.reasons.includes('UNVERIFIED_OR_SYNTHETIC_EVIDENCE'));assert(r.reasons.includes('INSUFFICIENT_INDEPENDENT_SOURCE_DOMAINS'))
})
test('settled matching provider payment is only admitted for review',()=>{
 const r=assessCommercialPayment(payment)
 assert.equal(r.status,'REVIEW_READY');assert.equal(r.paymentAuthorized,false);assert.equal(r.moneyMovementAuthorized,false)
})
test('mismatched settlement/order/account and unsigned events block',()=>{
 const r=assessCommercialPayment({...payment,paymentOrderId:'wrong',providerAccountOwnerId:'another',webhookSignatureVerified:false,providerState:'UNKNOWN'})
 assert.equal(r.status,'BLOCKED');assert(r.reasons.includes('PAYMENT_NOT_SETTLED'))
})
test('accepted delivery needs matching owner, accepted state and two independent receipts',()=>{
 const r=assessCommercialDelivery({orderId:'order:1',workOrderId:'order:1',orderOwnerId:'owner:1',workOrderOwnerId:'owner:1',workOrderStatus:'accepted',payment:assessCommercialPayment(payment),deliveryReceipt:ev('delivered'),acceptanceReceipt:ev('accepted'),asOf})
 assert.equal(r.status,'REVIEW_READY');assert.equal(r.fulfillmentAuthorized,false)
})
test('no actual acceptance or insufficient payment remains blocked',()=>{
 const r=assessCommercialDelivery({orderId:'order:1',workOrderId:'order:1',orderOwnerId:'owner:1',workOrderOwnerId:'owner:1',workOrderStatus:'delivered',payment:assessCommercialPayment({...payment,providerState:'PENDING'}),deliveryReceipt:ev('delivered'),asOf})
 assert.equal(r.status,'BLOCKED');assert(r.reasons.includes('PAYMENT_NOT_ADMITTED'))
})

test('paid order receipt cannot be reused for another work order or owner',()=>{
 const paid=assessCommercialPayment(payment)
 for(const [orderId,ownerId] of [['order:2','owner:1'],['order:1','owner:2']] as const){
  const result=assessCommercialDelivery({orderId,workOrderId:orderId,orderOwnerId:ownerId,workOrderOwnerId:ownerId,workOrderStatus:'accepted',payment:paid,deliveryReceipt:ev('delivery:'+orderId),acceptanceReceipt:ev('accept:'+orderId),asOf})
  assert.equal(result.status,'BLOCKED');assert(result.reasons.includes('PAYMENT_DELIVERY_BINDING_MISMATCH'))
 }
})
