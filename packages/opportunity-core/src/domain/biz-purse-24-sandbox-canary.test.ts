import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewClientCaptureSandboxCanary} from './biz-purse-24-sandbox-canary.js'
import type {StripeSandboxReview} from './biz-purse-stripe-sandbox.js'
const payment:StripeSandboxReview={status:'TEST_PAYMENT_OBSERVED',webhookEventId:'evt_a',orderId:'order:1',
 ownerUserId:'owner:1',providerSessionId:'cs_test_a',providerPaymentIntentId:'pi_a',providerRefundId:null,
 observedAmountMinor:'9900',proposedJournalKind:'PAYMENT_SETTLED',reasons:[],
 authority:'STRIPE_TEST_EVIDENCE_REVIEW_ONLY',canCharge:false,canRefund:false,canAppendJournal:false,
 canFulfill:false,canRecognizeCash:false,canPayOwner:false,canTrade:false}
const run=(x:Record<string,unknown>={})=>reviewClientCaptureSandboxCanary({ownerUserId:'owner:1',
 orderId:'order:1',testPayment:payment,journalOwnerUserId:'owner:1',
 journalOrderId:'order:1',durableTestReadback:true,syntheticDeliveryAccepted:true,...x})
test('sandbox observation is review-only, never cash or authorization',()=>{
 const r=run();assert.equal(r.status,'SANDBOX_CANARY_REVIEW_ONLY')
 assert.equal(r.canCharge,false);assert.equal(r.canRecognizeRevenue,false)
})
test('unpaid, cross-owner or missing journal evidence block',()=>{
 assert.equal(run({testPayment:{...payment,status:'BLOCKED'}}).status,'BLOCKED')
 assert.equal(run({journalOwnerUserId:'other'}).status,'BLOCKED')
 assert.equal(run({durableTestReadback:false}).status,'BLOCKED')
})
