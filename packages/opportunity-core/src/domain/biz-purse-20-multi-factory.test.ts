import test from 'node:test'
import assert from 'node:assert/strict'
import {assessTwoBusinessFactory,type BusinessFactoryUnit} from './biz-purse-20-multi-factory.js'
import type {BusinessDirectorReview} from './biz-purse-19-business-director.js'
const workflow=(id:string):BusinessDirectorReview=>({ownerUserId:'owner:1',businessId:id,
 completedSteps:['RESEARCH','REVIEW_OFFER','SCOPE_ORDER','REVIEW_DELIVERY','REVIEW_OUTCOME'],
 nextStep:null,status:'INTERNAL_REHEARSAL_COMPLETE',blockers:['SYNTHETIC_RESULTS_NOT_REAL_BUSINESS_EVIDENCE'],
 digest:'a'.repeat(64),authority:'DIRECTOR_REVIEW_ONLY',canContactCustomers:false,canSpend:false,canFulfill:false,canPublish:false,canMoveMoney:false})
const unit=(id:string,family:BusinessFactoryUnit['family'],n:number):BusinessFactoryUnit=>({
 businessId:id,family,ownerUserId:'owner:1',accountId:'account:'+n,
 customerRefs:['customer:'+n],ledgerReceiptIds:['receipt:'+n],
 operatingBudgetMinor:10000n,reservedSpendMinor:1000n,workflow:workflow(id)
})
const two=[unit('capture','CLIENT_CAPTURE_STUDIO',1),unit('digital','DIGITAL_PRODUCT_STUDIO',2)]
const run=(units:readonly BusinessFactoryUnit[]=two)=>assessTwoBusinessFactory({
 ownerUserId:'owner:1',units,totalBudgetCapMinor:20000n,stopRequested:false})
test('two isolated factory workflows permit only internal review',()=>{
 const r=run();assert.equal(r.status,'TWO_REHEARSALS_REVIEW_READY')
 assert.equal(r.businesses.length,2);assert.equal(r.canRunLiveBusinesses,false);assert.equal(r.canTransfer,false)
})
test('shared customer, ledger and account identity are blocked',()=>{
 const bad={...two[1],customerRefs:['customer:1'],ledgerReceiptIds:['receipt:1'],accountId:'account:1'}
 const r=run([two[0],bad])
 assert.equal(r.status,'BLOCKED');assert(r.reasons.includes('CROSS_BUSINESS_LEDGER_COLLISION'))
})
test('cross-owner workflow or duplicate family cannot be promoted',()=>{
 const r=run([two[0],{...two[1],workflow:{...workflow('digital'),ownerUserId:'other'},family:'CLIENT_CAPTURE_STUDIO'}])
 assert.equal(r.status,'BLOCKED');assert(r.reasons.includes('DIRECTOR_SCOPE_CROSSOVER'))
})
test('incomplete worker and unbounded aggregate budget block review',()=>{
 const r=run([{...two[0],workflow:{...workflow('capture'),status:'WAITING_REVIEW'}},{...two[1],operatingBudgetMinor:11000n}])
 assert.equal(r.status,'BLOCKED');assert(r.reasons.includes('BUSINESS_REHEARSAL_INCOMPLETE'))
 assert(r.reasons.includes('PORTFOLIO_AGGREGATE_BUDGET_EXCEEDED'))
})
