import test from 'node:test'
import assert from 'node:assert/strict'
import {projectBusinessProfitLedger,type BusinessProfitLedgerEvent,type BusinessProfitLedgerInput} from './biz-purse-profit-ledger.js'
import type {BusinessProfitPolicy} from './biz-purse-profit-waterfall.js'

const asOf='2026-10-14T23:00:00Z'
const policy:BusinessProfitPolicy={
 policyId:'owner-70-20-10',currency:'USD',
 ownerShareBps:2000,retainedReserveBps:1000,reinvestmentBps:7000,
 protectedCashFloorMinor:10000n,authority:'OWNER_POLICY',
}
type Kind=BusinessProfitLedgerEvent['kind']
function e(sequence:number,kind:Kind,amountMinor:bigint,extra:Partial<BusinessProfitLedgerEvent>={}):BusinessProfitLedgerEvent{
 return {eventId:'e:'+sequence,sequence,ownerUserId:'owner:1',
  businessId:'studio:1',periodId:'2026-10',currency:'USD',kind,
  mode:'LIVE_UNCOMMISSIONED',amountMinor,observedAt:asOf,
  evidenceId:'receipt:'+sequence,independentReadbackClaimed:true,...extra}
}
const base:BusinessProfitLedgerEvent[]=[
 e(1,'CUSTOMER_SETTLEMENT',50000n,{providerPaymentId:'pi_one',providerEventId:'evt_one'}),
 e(2,'DIRECT_COST',5000n),
 e(3,'PROVIDER_FEE',1500n),
 e(4,'TAX_AND_OBLIGATION_PROVISION',5000n),
 e(5,'OWNER_SEED_CAPITAL',100000n),
 e(6,'UNSETTLED_ORDER',50000n),
 e(7,'SETTLED_CASH_READBACK',150000n),
 e(8,'OTHER_RESERVED_CASH_READBACK',10000n),
]
const run=(events:readonly BusinessProfitLedgerEvent[]=base,overrides:Partial<BusinessProfitLedgerInput>={})=>
 projectBusinessProfitLedger({ownerUserId:'owner:1',businessId:'studio:1',periodId:'2026-10',
  currency:'USD',asOf,policy,events,...overrides})

test('candidate profit proposal accounts for costs/fees/tax while excluding seed capital and pending orders',()=>{
 const r=run()
 assert.equal(r.status,'REVIEW_ONLY_NOT_COMMISSIONED')
 assert.equal(r.settledRevenueCandidateMinor,50000n)
 assert.equal(r.seedCapitalExcludedMinor,100000n)
 assert.equal(r.unsettledOrderExcludedMinor,50000n)
 assert.equal(r.directCostsCandidateMinor,5000n)
 assert.equal(r.feesCandidateMinor,1500n)
 assert.equal(r.taxProvisionCandidateMinor,5000n)
 assert.equal(r.provisionalWaterfall?.netUnallocatedProfitMinor,38500n)
 assert.equal(r.provisionalWaterfall?.ownerEntitlementMinor,7700n)
 assert.equal(r.provisionalWaterfall?.reinvestmentLimitMinor,26950n)
 assert.equal(r.provisionalWaterfall?.retainedReserveMinor,3850n)
 assert.equal(r.canMoveMoney,false)
 assert.equal(r.ownerEntitlementPayable,false)
 assert.equal(r.providerSettlementCertified,false)
 assert.equal(r.reinvestmentAuthorized,false)
})
test('test Stripe receipt and synthetic Client Capture revenue are quarantined and cannot become a profit proposal',()=>{
 const bad=[
  e(9,'CUSTOMER_SETTLEMENT',9900n,{mode:'STRIPE_TEST',providerPaymentId:'pi_test',providerEventId:'evt_test'}),
  e(10,'CUSTOMER_SETTLEMENT',9900n,{mode:'SYNTHETIC',providerPaymentId:'pi_synthetic',providerEventId:'evt_synthetic'}),
 ]
 const r=run([...base,...bad])
 assert.equal(r.syntheticOrTestExcludedMinor,19800n)
 assert.equal(r.quarantinedCount,2)
 assert.equal(r.provisionalWaterfall,null)
 assert.equal(r.status,'BLOCKED')
 assert(r.reasons.includes('SYNTHETIC_OR_STRIPE_TEST_EVIDENCE_QUARANTINED'))
})
test('self-asserted unverified live settlements are quarantined instead of counted',()=>{
 const ev=[...base]
 ev[0]={...ev[0],independentReadbackClaimed:false}
 const r=run(ev)
 assert.equal(r.settledRevenueCandidateMinor,0n)
 assert.equal(r.provisionalWaterfall,null)
 assert(r.reasons.includes('NO_LIVE_SETTLEMENT_CANDIDATE'))
})
test('partial refunds and chargebacks bound to the same settled payment reduce candidate profit',()=>{
 const r=run([...base,
  e(9,'CUSTOMER_REFUND',10000n,{providerPaymentId:'pi_one',providerEventId:'evt_refund',linkedPaymentId:'pi_one'}),
  e(10,'CUSTOMER_CHARGEBACK',5000n,{providerPaymentId:'pi_one',providerEventId:'evt_dispute',linkedPaymentId:'pi_one'}),
 ])
 assert.equal(r.refundsAndChargebacksCandidateMinor,15000n)
 assert.equal(r.provisionalWaterfall?.netUnallocatedProfitMinor,23500n)
 assert.equal(r.provisionalWaterfall?.ownerEntitlementMinor,4700n)
})
test('orphan refund, reuse of provider events, and excess refund fail closed',()=>{
 assert.throws(()=>run([...base,e(9,'CUSTOMER_REFUND',1000n,{
  providerPaymentId:'pi_absent',providerEventId:'evt_refund',linkedPaymentId:'pi_absent',
 })]),/ORPHAN_OR_EXCESS_REFUND/)
 assert.throws(()=>run([...base,e(9,'CUSTOMER_REFUND',50001n,{
  providerPaymentId:'pi_one',providerEventId:'evt_refund',linkedPaymentId:'pi_one',
 })]),/ORPHAN_OR_EXCESS_REFUND/)
 assert.throws(()=>run([...base,e(9,'CUSTOMER_SETTLEMENT',1000n,{
  providerPaymentId:'pi_new',providerEventId:'evt_one',
 })]),/PROVIDER_EVENT_REUSED/)
})
test('late chargeback after prior allocation produces accounting deficit and no owner payday',()=>{
 const ev=[...base,
  e(9,'PRIOR_ALLOCATED_PROFIT',50000n),
  e(10,'CUSTOMER_CHARGEBACK',10000n,{providerPaymentId:'pi_one',
   providerEventId:'evt_late_dispute',linkedPaymentId:'pi_one'}),
 ]
 const r=run(ev)
 assert.equal(r.status,'BLOCKED')
 assert.equal(r.grossAccountingDeficitMinor,21500n)
 assert.equal(r.provisionalWaterfall?.status,'ACCOUNTING_DEFICIT')
 assert.equal(r.provisionalWaterfall?.ownerEntitlementMinor,0n)
 assert.equal(r.provisionalWaterfall?.reinvestmentLimitMinor,0n)
})
test('exact event replay is idempotent, mismatched replay is rejected',()=>{
 const once=run(),replay=run([...base.slice(0,1),base[0],...base.slice(1)])
 assert.equal(once.ledgerDigest,replay.ledgerDigest)
 assert.equal(once.eventCount,replay.eventCount)
 assert.throws(()=>run([base[0],{...base[0],amountMinor:50001n},...base.slice(1)]),/EVENT_ID_REPLAY_CONFLICT/)
})
test('missing sequence, duplicate evidence and cross-owner/currency references fail closed',()=>{
 assert.throws(()=>run([{...base[0],sequence:2},...base.slice(1)]),/EVENT_SEQUENCE_GAP/)
 assert.throws(()=>run([base[0],{...base[1],evidenceId:base[0].evidenceId},...base.slice(2)]),/DUPLICATE_SOURCE_EVIDENCE/)
 assert.throws(()=>run([{...base[0],ownerUserId:'another'},...base.slice(1)]),/CROSS_TENANT_EVENT/)
 assert.throws(()=>run([{...base[0],currency:'EUR'},...base.slice(1)]),/CROSS_TENANT_EVENT/)
})
test('missing, stale, or insufficient cash readbacks cannot produce even a provisional proposal',()=>{
 const missing=run(base.slice(0,6))
 assert.equal(missing.provisionalWaterfall,null)
 assert(missing.reasons.includes('INDEPENDENT_CASH_AND_RESERVE_READBACK_REQUIRED'))
 const old=run(base.map((x,i)=>i<6?x:{...x,observedAt:'2026-10-12T23:00:00Z'}),{
  asOf:'2026-10-15T23:00:00Z'
 })
 // Nonmonotonic readback timestamps are forbidden before stale is assessed.
 assert.equal(old.provisionalWaterfall,null)
})
test('reconciled cash below reserved balance blocks allocation proposal',()=>{
 const r=run(base.map(e=>e.kind==='SETTLED_CASH_READBACK'?{...e,amountMinor:100n}:e))
 assert.equal(r.provisionalWaterfall,null)
 assert(r.reasons.includes('RESERVES_EXCEED_SETTLED_CASH'))
})
test('all input digest and proposal remain non-executing despite a positive research projection',()=>{
 const first=run(),second=run()
 assert.equal(first.ledgerDigest,second.ledgerDigest)
 assert.equal(first.provisionalWaterfall?.planId,second.provisionalWaterfall?.planId)
 assert.equal(first.provisionalWaterfall?.canPlaceOrders,false)
 assert.equal(first.canPostJournal,false);assert.equal(first.canTrade,false)
})
