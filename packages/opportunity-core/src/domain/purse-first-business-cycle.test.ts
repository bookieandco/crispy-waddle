import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewFirstBusinessCycle} from './purse-first-business-cycle.js'
const workOrder={
 id:'wo-1',opportunityId:'opp-1',customerRef:'customer-1',title:'AI service',
 price:{amount:99,currency:'USD',cadence:'one_time'},status:'accepted',
 authority:'COMMERCIAL_SCOPE_ONLY',externalActionAuthorized:false,paymentAuthorized:false,
 evidenceRefs:['e:scope'],createdAt:'2026-10-20T09:00:00Z'
}
const delivery={id:'delivery-1',workOrderId:'wo-1',opportunityId:'opp-1',
 deliveryRef:'deliverable:1',deliverableRefs:['deliverable:1'],evidenceRefs:['e:delivery'],
 deliveredAt:'2026-10-20T12:00:00Z',authority:'OBSERVATION_ONLY',externalActionAuthorized:false}
const acceptance={id:'accept-1',workOrderId:'wo-1',opportunityId:'opp-1',
 deliveryReceiptId:'delivery-1',customerRef:'customer-1',decision:'accepted',
 observedAt:'2026-10-20T13:00:00Z',evidenceRefs:['e:acceptance'],
 authority:'CUSTOMER_EVIDENCE_ONLY',externalActionAuthorized:false,paymentAuthorized:false}
const payment={orderId:'wo-1',ownerUserId:'owner-1',customerRef:'customer-1',currency:'USD',
 amountMinor:'9900',providerMode:'LIVE',providerTransactionId:'pi1',providerPayoutId:'po1',
 moneyCustodyReadbackId:'custody1',observedAt:'2026-10-20T14:00:00Z',
 evidenceRefs:['e:transaction','e:provider','e:custody'],
 authority:'PROVIDER_EVIDENCE_FOR_REVIEW_ONLY',canMoveMoney:false}
const input={ownerUserId:'owner-1',businessId:'AI_SERVICE',workOrder,delivery,acceptance,
 payment,directCostsMinor:'1300',providerFeesMinor:'320',taxAndObligationHoldMinor:'1500',
 operatingReserveMinor:'700',assessedAt:'2026-10-20T15:00:00Z'}
test('well-formed fixtures remain nonposting and not certified real earnings',()=>{
 const r=reviewFirstBusinessCycle(input as any)
 assert.equal(r.status,'INDEPENDENT_REVIEW_REQUIRED')
 assert.equal(r.candidateNetAfterDirectCostsMinor,'6080')
 assert.equal(r.verifiedRealizedRevenueMinor,null)
 assert.equal(r.canRecognizeProfit,false)
 assert.equal(r.canPayOwner,false)
})
test('test payments cannot masquerade as settled real money',()=>{
 const r=reviewFirstBusinessCycle({...input,payment:{...payment,providerMode:'STRIPE_TEST'}} as any)
 assert.equal(r.status,'BLOCKED')
 assert.ok(r.blockers.includes('TEST_MODE_IS_NOT_REAL_REVENUE'))
})
test('customer or order mismatch blocks',()=>{
 const r=reviewFirstBusinessCycle({...input,acceptance:{...acceptance,customerRef:'elsewhere'}} as any)
 assert.ok(r.blockers.includes('INDEPENDENT_CUSTOMER_ACCEPTANCE_REQUIRED'))
})
test('same provider transaction cannot assert independent custody',()=>{
 const r=reviewFirstBusinessCycle({...input,payment:{...payment,moneyCustodyReadbackId:'pi1'}} as any)
 assert.ok(r.blockers.includes('INDEPENDENT_PAYOUT_AND_CUSTODY_READBACK_REQUIRED'))
})
test('backdated customer acceptance blocks',()=>{
 const r=reviewFirstBusinessCycle({...input,acceptance:{...acceptance,observedAt:'2026-10-19T13:00:00Z'}} as any)
 assert.ok(r.blockers.includes('CHRONOLOGY_INVALID'))
})
test('zero amounts, malformed fees, and duplicate evidence refused',()=>{
 assert.throws(()=>reviewFirstBusinessCycle({...input,directCostsMinor:'-1'} as any),/COSTS_INVALID/)
 const r=reviewFirstBusinessCycle({...input,payment:{...payment,amountMinor:'0'}} as any)
 assert.equal(r.status,'BLOCKED')
})
