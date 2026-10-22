import test from 'node:test'
import assert from 'node:assert/strict'
import {compareSniperLandingRoutes,type SniperRouteStudyCandidate,type SniperLandingObservation} from './sniper-landing-route-study.js'
const at='2026-10-21T20:00:00Z'
const leg=(tip:bigint,id:string)=>({
 signatureBaseFeeLamports:5000n,computeUnitLimit:200000,microLamportsPerComputeUnit:1000n,
 jitoTipLamports:tip,nonRecoverableRentLamports:0n,evidenceId:id,
})
const candidate=(lane:SniperRouteStudyCandidate['lane'],tip:bigint):SniperRouteStudyCandidate=>({
 lane,evidenceId:'quote:'+lane,observedAt:at,entry:leg(tip,'entry:'+lane),exit:leg(tip,'exit:'+lane),
 quoteRelativeEdgeBps:200,extraAdverseSlippageBps:40,
})
const sample=(lane:SniperLandingObservation['lane'],n:number,outcome:SniperLandingObservation['outcome']='LANDED'):SniperLandingObservation=>({
 observationId:lane+n,lane,availableAt:at,outcome,source:'CHAIN_ATTESTED',landingDelayMs:200+n,
})
const compare=(observations:SniperLandingObservation[],candidates=[candidate('STANDARD_RPC',0n),candidate('JITO_BUNDLE',50000n)])=>
 compareSniperLandingRoutes({candidates,observations,cutoff:'2026-10-21T20:00:01Z',
 maxQuoteAgeMs:1500,notionalLamports:100000000n,minimumNetEdgeBps:10,maxFixedCostBps:100,minLandingSamples:2})
test('route study accounts for tips and refuses to claim Jito private route wins unconditionally',()=>{
 const r=compare([sample('STANDARD_RPC',1),sample('STANDARD_RPC',2),sample('JITO_BUNDLE',3),sample('JITO_BUNDLE',4)])
 assert.equal(r.selectedForPaper,'STANDARD_RPC')
 assert.equal(r.canSubmit,false)
 assert.equal(r.canExecute,false)
 assert.ok(r.rankings[0]!.cost.worstCaseNetEdgeBps>r.rankings[1]!.cost.worstCaseNetEdgeBps)
})
test('insufficient, unknown and unverified route landing observations cannot qualify',()=>{
 const invalid=compare([sample('JITO_BUNDLE',1,'UNKNOWN'),
  {...sample('JITO_BUNDLE',2),source:'PAPER_ASSUMPTION'}])
 assert.equal(invalid.selectedForPaper,undefined)
 assert.ok(invalid.rankings[1]!.reasonCodes.includes('LANDING_SAMPLE_INSUFFICIENT'))
})
test('price-stale venue is excluded even if nominally cheapest',()=>{
 const stale=compare([
  sample('STANDARD_RPC',1),sample('STANDARD_RPC',2),sample('JITO_BUNDLE',1),sample('JITO_BUNDLE',2),
 ],[candidate('STANDARD_RPC',0n),{...candidate('JITO_BUNDLE',0n),observedAt:'2026-10-21T19:00:00Z'}])
 assert.equal(stale.selectedForPaper,'STANDARD_RPC')
 assert.equal(stale.rankings[1]!.readyForPaperComparison,false)
})
