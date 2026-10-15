import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewBusinessDirector,type BusinessDirectorReceipt,type BusinessDirectorStep} from './biz-purse-19-business-director.js'
const at='2026-10-14T22:00:00Z'
const steps:BusinessDirectorStep[]=['RESEARCH','REVIEW_OFFER','SCOPE_ORDER','REVIEW_DELIVERY','REVIEW_OUTCOME']
const receipts:BusinessDirectorReceipt[]=steps.map((step,i)=>({
 id:'receipt:'+i,ownerUserId:'owner:1',businessId:'studio:1',sequence:i+1,
 step,verdict:'PASS',evidenceId:'fixture:'+i,at,source:'SIMULATED'
}))
const run=(overrides:Record<string,unknown>={})=>reviewBusinessDirector({ownerUserId:'owner:1',businessId:'studio:1',asOf:at,
 receipts,stopRequested:false,authorizedResearchFamilies:['business_automation'],businessFamily:'business_automation',...overrides})
test('five-stage internal rehearsal is complete but has no external authority',()=>{
 const r=run()
 assert.equal(r.status,'INTERNAL_REHEARSAL_COMPLETE');assert.equal(r.nextStep,null)
 assert.equal(r.completedSteps.length,5);assert.equal(r.canFulfill,false);assert.equal(r.canMoveMoney,false)
 assert(r.blockers.includes('SYNTHETIC_RESULTS_NOT_REAL_BUSINESS_EVIDENCE'))
})
test('owner stop, unapproved family and missing receipt block',()=>{
 assert.equal(run({stopRequested:true}).status,'BLOCKED')
 assert(run({authorizedResearchFamilies:[]}).blockers.includes('BUSINESS_FAMILY_NOT_APPROVED'))
 assert.equal(run({receipts:[]}).status,'BLOCKED')
})
test('skipped state, sequence gap, cross-owner and replay conflict fail closed',()=>{
 assert.throws(()=>run({receipts:[receipts[1]]}),/GAP_OR_REORDER/)
 assert.throws(()=>run({receipts:[{...receipts[0],step:'REVIEW_OFFER'}]}),/STAGE_SKIPPED/)
 assert.throws(()=>run({receipts:[{...receipts[0],ownerUserId:'other'}]}),/RECEIPT_INVALID/)
 assert.throws(()=>run({receipts:[receipts[0],{...receipts[0],verdict:'BLOCK'}]}),/REPLAY_CONFLICT/)
})
test('WAIT halts next stage pending review and forbids later activity',()=>{
 const waiting={...receipts[1],verdict:'WAIT' as const}
 const r=run({receipts:[receipts[0],waiting]})
 assert.equal(r.status,'WAITING_REVIEW');assert.equal(r.nextStep,'REVIEW_OFFER')
 assert.throws(()=>run({receipts:[receipts[0],waiting,receipts[2]]}),/EVENT_AFTER_HALT/)
})
