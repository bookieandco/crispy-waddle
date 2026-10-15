import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewPurseOwnerProtection} from './biz-purse-25-owner-protection.js'
import type {BusinessProfitLedgerReview} from './biz-purse-profit-ledger.js'
const mock={ownerUserId:'owner:1',businessId:'studio:1',quarantinedCount:0,
 grossAccountingDeficitMinor:0n,providerSettlementCertified:false,canMoveMoney:false,
 provisionalWaterfall:{status:'ALLOCATABLE',ownerEntitlementMinor:7700n,reinvestmentLimitMinor:26950n}} as BusinessProfitLedgerReview
const run=(o:Record<string,unknown>={})=>reviewPurseOwnerProtection({ownerUserId:'owner:1',
 businessId:'studio:1',ledger:mock,payoutDestinationOwnerId:'owner:1',payoutDestinationVerified:true,
 custodyOwnerId:'owner:1',reconciliationReceiptId:'receipt:test',ownerStopRequested:false,
 taxAndObligationReviewCompleted:true,...o})
test('positive profit can be reviewed but never paid without a separate financial execution rail',()=>{
 const r=run();assert.equal(r.status,'OWNER_CUSTODY_REVIEW_ONLY');assert.equal(r.ownerEntitlementCandidateMinor,7700n)
 assert.equal(r.canPayOwner,false);assert.equal(r.canReinvest,false)
})
test('owner mismatch, refund deficit, missing tax or stop block',()=>{
 assert(run({payoutDestinationOwnerId:'another'}).reasons.includes('OWNER_CUSTODY_OR_DESTINATION_UNVERIFIED'))
 assert(run({ledger:{...mock,grossAccountingDeficitMinor:100n}}).reasons.includes('ACCOUNTING_UNALLOCATABLE_OR_UNCERTAIN'))
 assert.equal(run({ownerStopRequested:true}).status,'BLOCKED')
 assert.equal(run({taxAndObligationReviewCompleted:false}).status,'BLOCKED')
})
