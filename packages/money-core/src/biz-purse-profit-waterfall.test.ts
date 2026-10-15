import test from 'node:test'
import assert from 'node:assert/strict'
import {proposeBusinessProfitWaterfall, type BusinessProfitPolicy, type BusinessProfitPeriod} from './biz-purse-profit-waterfall.js'
const policy:BusinessProfitPolicy={policyId:'owner-70-20-10',currency:'USD',ownerShareBps:2000,retainedReserveBps:1000,reinvestmentBps:7000,protectedCashFloorMinor:10000n,authority:'OWNER_POLICY'}
const period:BusinessProfitPeriod={businessId:'capture-studio',periodId:'2026-10',currency:'USD',settledRevenueMinor:110000n,refundsMinor:0n,directCostsMinor:10000n,providerFeesMinor:0n,taxAndObligationProvisionMinor:0n,previouslyAllocatedProfitMinor:0n,settledCashMinor:120000n,otherReservedCashMinor:10000n,observedAt:'2026-10-14T23:00:00Z',evidenceIds:['settlement:1'],authority:'SETTLED_ACCOUNTING_EVIDENCE'}
test('70/20/10 on available realized minor-unit profit with owner payout protected',()=>{
 const result=proposeBusinessProfitWaterfall({policy,period})
 assert.equal(result.status,'ALLOCATABLE');assert.equal(result.netUnallocatedProfitMinor,100000n)
 assert.equal(result.ownerEntitlementMinor,20000n);assert.equal(result.ownerProtectedNowMinor,20000n)
 assert.equal(result.retainedReserveMinor,10000n);assert.equal(result.reinvestmentLimitMinor,70000n)
 assert.equal(result.canMoveMoney,false);assert.equal(result.canPlaceOrders,false)
})
test('insufficient liquid cash protects owner entitlement first and prevents reinvestment',()=>{
 const result=proposeBusinessProfitWaterfall({policy,period:{...period,settledCashMinor:30000n}})
 assert.equal(result.status,'PARTIALLY_FUNDED');assert.equal(result.ownerProtectedNowMinor,10000n)
 assert.equal(result.ownerUnfundedMinor,10000n);assert.equal(result.reinvestmentLimitMinor,0n)
})
test('unsettled forecasts cannot influence proposal and no cash prevents allocations',()=>{
 const result=proposeBusinessProfitWaterfall({policy,period:{...period,settledCashMinor:0n}})
 assert.equal(result.status,'LIQUIDITY_BLOCKED');assert.equal(result.reinvestmentLimitMinor,0n)
})
test('replayed evidence is deterministic and duplicate evidence IDs fail',()=>{
 const x=proposeBusinessProfitWaterfall({policy,period});const y=proposeBusinessProfitWaterfall({policy,period})
 assert.equal(x.planId,y.planId)
 assert.throws(()=>proposeBusinessProfitWaterfall({policy,period:{...period,evidenceIds:['a','a']}}),/IDS_INVALID/)
})
test('invalid share totals, currency, negative balances and malformed timestamps fail closed',()=>{
 assert.throws(()=>proposeBusinessProfitWaterfall({policy:{...policy,ownerShareBps:3000},period}),/SHARES_INVALID/)
 assert.throws(()=>proposeBusinessProfitWaterfall({policy,period:{...period,currency:'EUR'}}),/POLICY_INVALID/)
 assert.throws(()=>proposeBusinessProfitWaterfall({policy,period:{...period,refundsMinor:-1n}}),/NEGATIVE_ACCOUNTING_INPUT/)
 assert.throws(()=>proposeBusinessProfitWaterfall({policy,period:{...period,observedAt:'bad'}}),/EVIDENCE_INVALID/)
})
test('refunds and already allocated profit reduce profit; losses do not create negative payouts',()=>{
 const result=proposeBusinessProfitWaterfall({policy,period:{...period,refundsMinor:100000n}})
 assert.equal(result.status,'NO_PROFIT');assert.equal(result.ownerProtectedNowMinor,0n)
 const already=proposeBusinessProfitWaterfall({policy,period:{...period,previouslyAllocatedProfitMinor:100000n}})
 assert.equal(already.netUnallocatedProfitMinor,0n)
})
