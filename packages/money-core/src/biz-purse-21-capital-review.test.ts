import test from 'node:test'
import assert from 'node:assert/strict'
import {gradeCapitalPaperPortfolio,type FrozenPaperCase} from './biz-purse-21-capital-review.js'
const at='2026-10-14T22:00:00Z'
const mk=(id:string,venue:FrozenPaperCase['venue']):FrozenPaperCase=>({
 id,venue,ownerUserId:'owner:1',frozenAt:'2026-10-13T20:00:00Z',resolvedAt:at,
 predictionProbabilityBps:6000,actualOutcome:1,grossPaperPnlMinor:1200n,transactionCostMinor:200n,
 predictionReceiptId:'pred:'+id,settlementReceiptId:'settle:'+id,source:'PAPER_ONLY'
})
const run=(cases:readonly FrozenPaperCase[],gaps=0)=>gradeCapitalPaperPortfolio({ownerUserId:'owner:1',asOf:at,cases,unresolvedFeedGaps:gaps})
test('grades four paper venues with transaction costs and no real cash authorization',()=>{
 const r=run([mk('a','STOCKS'),mk('b','MEMECOINS'),mk('c','KALSHI'),mk('d','SPORTS')])
 assert.equal(r.status,'PAPER_RESEARCH_REVIEW_READY');assert.equal(r.gradedCaseCount,4)
 assert(r.venues.every(x=>x.meanBrierScore===0.16&&x.netPaperPnlMinor==='1000'))
 assert.equal(r.canTrade,false);assert.equal(r.canBet,false);assert.equal(r.canPromoteCashProfit,false)
})
test('unresolved outcome or gap prohibits paper readiness',()=>{
 const c=mk('x','KALSHI')
 const r=run([{...c,actualOutcome:null,resolvedAt:null,settlementReceiptId:null}],1)
 assert.equal(r.status,'BLOCKED');assert(r.reasons.includes('MARKET_FEED_GAPS_UNRESOLVED'))
})
test('invalid chronology, borrowed owner and duplicates fail closed',()=>{
 const c=mk('x','KALSHI')
 assert.throws(()=>run([c,c]),/INVALID_OR_DUPLICATE/)
 assert.throws(()=>run([{...c,ownerUserId:'other'}]),/INVALID_OR_DUPLICATE/)
 assert.throws(()=>run([{...c,resolvedAt:'2026-10-10T20:00:00Z'}]),/SETTLEMENT_PROVENANCE_INVALID/)
})
