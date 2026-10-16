import assert from 'node:assert/strict'
import { scoreMemeResearchSnapshots, compareMemeResearchStrategies,
 type MemeResearchSnapshot,type MemeResearchStrategy } from './meme-paper-learning.js'
import type { MemeTreasuryPaperInput } from './meme-profit-policy.js'

const template:MemeTreasuryPaperInput={
 totalSupplyTokens:1_000_000_000,creatorAllocationTokens:100_000_000,
 poolReserveSol:500,poolReserveTokens:900_000_000,hypotheticalSolPriceUsd:175,
 ammFeeBps:30,assumedNetworkCostSolPerSale:0.001,
 assumedCostBasisUsdPerToken:0.00001,estimatedBusinessOverheadUsd:75,assumedTaxReservePercent:25,
 schedulePubliclyDisclosed:true,liquidityWithdrawalsForbidden:true,
 inventedVolumeForbidden:true,ownerAuthorizedPaperStudy:true,
 plannedSales:[{day:1,tokens:100_000}],
}
const snapshots:MemeResearchSnapshot[]=Array.from({length:7},(_,i)=>({
 day:'2026-10-'+String(i+1).padStart(2,'0'),
 observedAt:'2026-10-'+String(i+1).padStart(2,'0')+'T12:00:00Z',
 availableAt:'2026-10-'+String(i+1).padStart(2,'0')+'T12:02:00Z',
 sourceRef:'synthetic:day:'+String(i+1),sourceKind:'SYNTHETIC_FIXTURE',
 priceUsdPerSol:150+i*5,hypotheticalPoolReserveSol:500+(i%3)*10,
 hypotheticalPoolReserveTokens:900_000_000,
}))
const small:MemeResearchStrategy={id:'small',label:'Study small treasury slice',
 hypotheticalSaleTokens:100_000,assumedFixedOverheadUsd:10,assumedNetworkCostSol:0.001}
const higherCost:MemeResearchStrategy={id:'higher-cost',label:'Expensive overhead',
 hypotheticalSaleTokens:100_000,assumedFixedOverheadUsd:100,assumedNetworkCostSol:0.001}
const args={snapshots,strategy:small,policyTemplate:template,scoreAt:'2026-10-08T00:00:00Z'}
const score=scoreMemeResearchSnapshots(args)
assert.equal(score.status,'SYNTHETIC_REPLAY')
assert.equal(score.admittedCount,7)
assert.equal(score.refusedCount,0)
assert.equal(score.actualTrades,0)
assert.equal(score.actualEarningsUsd,0)
assert.equal(score.autopilotAuthorized,false)
assert.equal(score.observations[0].sourceRef,'synthetic:day:1')
assert.deepEqual(score,scoreMemeResearchSnapshots(args),'same facts same simulated scores')
const cost=scoreMemeResearchSnapshots({...args,strategy:higherCost})
assert(cost.meanHypotheticalPnlUsd! < score.meanHypotheticalPnlUsd!)
const compared=compareMemeResearchStrategies([cost,score])
assert.equal(compared.ranking[0].strategyId,'small')
assert.equal(compared.winnerForLiveTrading,null)
assert.equal(compared.actualEarningsUsd,0)
const expensive=scoreMemeResearchSnapshots({...args,strategy:{...small,id:'network-exceeds',assumedNetworkCostSol:1000}})
assert.equal(expensive.refusedCount,7)
assert.equal(expensive.meanHypotheticalPnlUsd,null)
assert.equal(compareMemeResearchStrategies([expensive,score]).ranking[0].strategyId,'small')
assert.throws(()=>scoreMemeResearchSnapshots({...args,snapshots:snapshots.slice(0,6)}),/EXACTLY_SEVEN/)
assert.throws(()=>scoreMemeResearchSnapshots({...args,snapshots:snapshots.map((x,i)=>i===5?{...x,day:x.day.replace('06','07')}:x)}),/DATE_GAP/)
assert.throws(()=>scoreMemeResearchSnapshots({...args,snapshots:snapshots.map((x,i)=>i===3?{...x,availableAt:'2026-10-09T00:00:00Z'}:x)}),/LOOKAHEAD/)
assert.throws(()=>scoreMemeResearchSnapshots({...args,snapshots:snapshots.map((x,i)=>i===3?{...x,sourceKind:'READ_ONLY_RESEARCH'}:x)}),/SOURCE_MIX/)
assert.throws(()=>scoreMemeResearchSnapshots({...args,snapshots:snapshots.map((x,i)=>i===3?{...x,sourceRef:''}:x)}),/PROVENANCE/)
assert.throws(()=>compareMemeResearchStrategies([score,score]),/COMPARISON_INVALID/)
console.log('MEME-PROFIT.11–.14 7-day counterfactual scoring tests passed')
