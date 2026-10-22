import test from 'node:test'
import assert from 'node:assert/strict'
import {assessSolanaSniperCostBudget,type SolanaSniperCostBudget} from './solana-sniper-execution-cost.js'

const budget:SolanaSniperCostBudget={
 initialNotionalLamports:100_000_000n,
 quoteRelativeEdgeBps:120,
 adverseSlippageBudgetBps:100,
 entry:{signatureBaseFeeLamports:5_000n,computeUnitLimit:200_000,microLamportsPerComputeUnit:1_000n,jitoTipLamports:1_000n,nonRecoverableRentLamports:0n,evidenceId:'entry:slot:10'},
 exit:{signatureBaseFeeLamports:5_000n,computeUnitLimit:200_000,microLamportsPerComputeUnit:1_000n,jitoTipLamports:1_000n,nonRecoverableRentLamports:0n,evidenceId:'exit:slot:10'},
 minimumNetEdgeBps:10,
 ownerMaxFixedCostBps:10,
}
test('round-trip costs include base, ceil CU priority and separate Jito tips but do not double count quote fees',()=>{
 const x=assessSolanaSniperCostBudget(budget)
 assert.equal(x.status,'PASS_PAPER_COST')
 assert.equal(x.entryFixedLamports,6_200n)
 assert.equal(x.roundTripFixedLamports,12_400n)
 assert.equal(x.roundTripFixedCostBps,2)
 assert.equal(x.worstCaseNetEdgeBps,18)
 assert.equal(x.canSign,false)
 assert.equal(x.canBroadcast,false)
 assert.equal(x.canAuthorizeTrade,false)
})
test('a fast high-priority route fails if tips eliminate the net edge',()=>{
 const x=assessSolanaSniperCostBudget({
  ...budget,
  entry:{...budget.entry,jitoTipLamports:1_000_000n},
  exit:{...budget.exit,jitoTipLamports:1_000_000n},
 })
 assert.equal(x.status,'REJECT_COST')
 assert.ok(x.reasonCodes.includes('SOLANA_COST_OWNER_FIXED_FEE_CAP'))
 assert.ok(x.reasonCodes.includes('SOLANA_COST_INSUFFICIENT_NET_EDGE'))
})
test('fee inputs and the owner maximum must be explicit and nonnegative',()=>{
 assert.throws(()=>assessSolanaSniperCostBudget({...budget,entry:{...budget.entry,microLamportsPerComputeUnit:-1n}}),/SOLANA_COST_CU_PRICE_INVALID/)
 assert.throws(()=>assessSolanaSniperCostBudget({...budget,adverseSlippageBudgetBps:10001}),/SOLANA_COST_SLIPPAGE_INVALID/)
 assert.throws(()=>assessSolanaSniperCostBudget({...budget,initialNotionalLamports:0n}),/SOLANA_COST_NOTIONAL_REQUIRED/)
})
