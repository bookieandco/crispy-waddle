import test from 'node:test'
import assert from 'node:assert/strict'
import {summarizeSniperProspectiveCohort,type SniperProspectiveEvent} from './sniper-live-source-cohort.js'
const e=(id:string,patch:Partial<SniperProspectiveEvent>={}):SniperProspectiveEvent=>({
 eventId:id,signature:'4'.repeat(87),mint:'2'.repeat(32),
 receivedAt:'2026-10-23T20:00:00.000Z',
 riskCompletedAt:'2026-10-23T20:00:00.020Z',
 quoteReceivedAt:'2026-10-23T20:00:00.100Z',
 paperDecisionAt:'2026-10-23T20:00:00.200Z',
 chainMintIndependentlyVerified:true,exitRouteIndependentlyVerified:false,
 result:'PAPER_ONLY',evidenceIds:['source:event:'+id],...patch,
})
test('measures only observed local stage percentiles; no synthetic end-to-end SLA',()=>{
 const r=summarizeSniperProspectiveCohort([
  e('1'),e('2',{result:'SKIPPED_EXPIRED',riskCompletedAt:undefined,
   quoteReceivedAt:undefined,paperDecisionAt:undefined}),
  e('3',{chainMintIndependentlyVerified:false,result:'BLOCKED_RISK',
   quoteReceivedAt:undefined,paperDecisionAt:undefined}),
 ])
 assert.equal(r.observedEvents,3)
 assert.equal(r.missingDecisionEvents,2)
 assert.equal(r.skippedOrBlockedEvents,2)
 assert.equal(r.unverifiedEvents,1)
 assert.deepEqual(r.receiptToPaperDecisionMs,{p50:200,p95:200,p99:200})
 assert.equal(r.realEventToConfirmedExitSla,'NOT_ESTABLISHED')
 assert.equal(r.samplesAreRealTransactions,false)
 assert.equal(r.canExecute,false)
})
test('duplicate or missing coin events cannot be counted twice',()=>{
 assert.throws(()=>summarizeSniperProspectiveCohort([e('same'),e('same')]),
  /IDENTITY_OR_EVIDENCE_INVALID/)
 assert.throws(()=>summarizeSniperProspectiveCohort([
  e('missing',{evidenceIds:[]}),
 ]),/IDENTITY_OR_EVIDENCE_INVALID/)
})
test('clock regression or future stage inversion invalidates evidence',()=>{
 assert.throws(()=>summarizeSniperProspectiveCohort([
  e('bad',{paperDecisionAt:'2026-10-23T19:59:00Z'}),
 ]),/NONMONOTONIC_CLOCK/)
 assert.throws(()=>summarizeSniperProspectiveCohort([
  e('bad',{riskCompletedAt:'2026-10-23T20:00:00.150Z',
   quoteReceivedAt:'2026-10-23T20:00:00.100Z'}),
 ]),/NONMONOTONIC_CLOCK/)
})
test('zero events is unknown source coverage, not zero-latency success',()=>{
 const r=summarizeSniperProspectiveCohort([])
 assert.equal(r.observedEvents,0)
 assert.equal(r.receiptToRiskMs,undefined)
 assert.equal(r.receiptToQuoteMs,undefined)
 assert.equal(r.canCreditPurse,false)
})
