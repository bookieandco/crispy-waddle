import assert from 'node:assert/strict'
import { simulateDisclosedTreasuryProfitTaking } from './meme-profit-policy.js'
import type { MemeTreasuryPaperInput } from './meme-profit-policy.js'

const sample = (): MemeTreasuryPaperInput => ({
  totalSupplyTokens: 1_000_000_000,
  creatorAllocationTokens: 100_000_000,
  poolReserveTokens: 900_000_000,
  poolReserveSol: 500,
  hypotheticalSolPriceUsd: 175,
  ammFeeBps: 30,
  assumedNetworkCostSolPerSale: 0.001,
  assumedCostBasisUsdPerToken: 0.00001,
  estimatedBusinessOverheadUsd: 75,
  assumedTaxReservePercent: 25,
  schedulePubliclyDisclosed: true,
  liquidityWithdrawalsForbidden: true,
  inventedVolumeForbidden: true,
  ownerAuthorizedPaperStudy: true,
  plannedSales: [
    { day: 1, tokens: 100_000 },
    { day: 8, tokens: 100_000 },
    { day: 15, tokens: 100_000 },
  ],
});

{
  const a=simulateDisclosedTreasuryProfitTaking(sample())
  const b=simulateDisclosedTreasuryProfitTaking(sample())
  assert.deepEqual(a,b,'paper planning must be deterministic')
  assert.equal(a.status,'SIMULATED')
  assert.equal(a.mode,'PAPER_ONLY')
  assert.equal(a.schedule.length,3)
  assert.equal(a.hypotheticalTotalSoldTokens,300_000)
  assert.equal(a.hypotheticalRemainingTreasuryTokens,99_700_000)
  assert(a.hypotheticalTotalNetProceedsUsdBeforeTaxReserve>0)
  assert(a.hypotheticalNetAfterTaxReserveUsd <= a.hypotheticalTotalNetProceedsUsdBeforeTaxReserve)
  assert(a.schedule.every(x=>x.estimatedPriceImpactBps<=150))
  assert(a.schedule[1].hypotheticalPoolTokensAfter>a.schedule[0].hypotheticalPoolTokensAfter)
  assert.equal(a.actualRevenueUsd,0)
  assert.equal(a.actualProfitUsd,0)
  assert.equal(a.walletSigningAuthorized,false)
  assert.equal(a.anyExecutionAuthorized,false)
  assert.equal(a.liquidityWithdrawalAuthorized,false)
  assert.equal(a.hiddenSalesAuthorized,false)
  assert.equal(a.automatedSalesAuthorized,false)
  assert.equal(a.investmentReturnGuaranteed,false)
}

{
  const base=sample()
  const blocked=simulateDisclosedTreasuryProfitTaking({...base,schedulePubliclyDisclosed:false})
  assert.equal(blocked.status,'BLOCKED')
  assert.equal(blocked.schedule.length,0)
  assert.equal(blocked.hypotheticalTotalNetProceedsUsdBeforeTaxReserve,0)
  assert(blocked.refusals.some(x=>/disclos/i.test(x)))
}

{
  const blocked=simulateDisclosedTreasuryProfitTaking({...sample(),liquidityWithdrawalsForbidden:false})
  assert.equal(blocked.status,'BLOCKED')
  assert(blocked.refusals.some(x=>/liquidity/i.test(x)))
}
{
  const blocked=simulateDisclosedTreasuryProfitTaking({...sample(),inventedVolumeForbidden:false})
  assert.equal(blocked.status,'BLOCKED')
  assert(blocked.refusals.some(x=>/Artificial volume/i.test(x)))
}
{
  const blocked=simulateDisclosedTreasuryProfitTaking({...sample(),ownerAuthorizedPaperStudy:false})
  assert.equal(blocked.status,'BLOCKED')
}

{
  const blocked=simulateDisclosedTreasuryProfitTaking({...sample(),plannedSales:[{day:1,tokens:3_000_000}]})
  assert.equal(blocked.status,'BLOCKED')
  assert(blocked.refusals.some(x=>/0.25%/i.test(x)))
}
{
  const blocked=simulateDisclosedTreasuryProfitTaking({...sample(),plannedSales:[
    {day:1,tokens:2_000_000},{day:3,tokens:2_000_000},{day:6,tokens:2_000_000}
  ]})
  assert.equal(blocked.status,'BLOCKED')
  assert(blocked.refusals.some(x=>/5%/i.test(x)))
}
{
  const blocked=simulateDisclosedTreasuryProfitTaking({...sample(),poolReserveTokens:500_000})
  assert.equal(blocked.status,'BLOCKED')
  assert(blocked.refusals.some(x=>/price-impact/i.test(x)))
}
{
  const blocked=simulateDisclosedTreasuryProfitTaking({...sample(),assumedNetworkCostSolPerSale:1_000_000})
  assert.equal(blocked.status,'BLOCKED')
  assert(blocked.refusals.some(x=>/transaction costs/i.test(x)))
}
{
  assert.throws(()=>simulateDisclosedTreasuryProfitTaking({...sample(),plannedSales:[{day:8,tokens:5},{day:8,tokens:5}]}),/strictly increasing/)
  assert.throws(()=>simulateDisclosedTreasuryProfitTaking({...sample(),hypotheticalSolPriceUsd:0}),/positive/)
  assert.throws(()=>simulateDisclosedTreasuryProfitTaking({...sample(),assumedNetworkCostSolPerSale:-1}),/nonnegative/)
  assert.throws(()=>simulateDisclosedTreasuryProfitTaking({...sample(),assumedTaxReservePercent:101}),/Invalid assumed tax reserve/)
  assert.throws(()=>simulateDisclosedTreasuryProfitTaking({...sample(),creatorAllocationTokens:1_000_000_001}),/Creator allocation/)
  assert.throws(()=>simulateDisclosedTreasuryProfitTaking({...sample(),ammFeeBps:2000}),/Invalid AMM fee/)
}

console.log('MEME-VENTURE paper disclosed treasury profit-policy tests passed')
