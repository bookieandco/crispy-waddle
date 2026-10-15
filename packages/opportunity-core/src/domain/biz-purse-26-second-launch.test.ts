import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewSecondBusinessLaunch} from './biz-purse-26-second-launch.js'
import type {BusinessFactoryUnit} from './biz-purse-20-multi-factory.js'
import type {BusinessDirectorReview} from './biz-purse-19-business-director.js'
const director=(id:string):BusinessDirectorReview=>({
 ownerUserId:'owner:1',businessId:id,completedSteps:['RESEARCH','REVIEW_OFFER','SCOPE_ORDER','REVIEW_DELIVERY','REVIEW_OUTCOME'],
 nextStep:null,status:'INTERNAL_REHEARSAL_COMPLETE',blockers:[],digest:'a'.repeat(64),
 authority:'DIRECTOR_REVIEW_ONLY',canContactCustomers:false,canSpend:false,canFulfill:false,canPublish:false,canMoveMoney:false})
const unit=(id:string,family:BusinessFactoryUnit['family']):BusinessFactoryUnit=>({
 businessId:id,family,ownerUserId:'owner:1',accountId:id,customerRefs:[id+':customer'],
 ledgerReceiptIds:[id+':ledger'],operatingBudgetMinor:1000n,reservedSpendMinor:100n,workflow:director(id)})
const units=[unit('capture','CLIENT_CAPTURE_STUDIO'),unit('digital','DIGITAL_PRODUCT_STUDIO')]
const run=(o:Record<string,unknown>={})=>reviewSecondBusinessLaunch({
 ownerUserId:'owner:1',businesses:units,aggregateBudgetCapMinor:2000n,stopRequested:false,
 licensedCatalogEvidenceIds:['fixture:license:1'],syntheticDeliveryProofId:'fixture:delivery',
 refundDrillReceiptId:'fixture:refund',customerRightsReviewed:true,...o})
test('two internal businesses can pass a rehearsal review with no live authority',()=>{
 const r=run();assert.equal(r.status,'SECOND_BUSINESS_PILOT_REVIEW_ONLY')
 assert.equal(r.canPublish,false);assert.equal(r.canCharge,false)
})
test('missing catalog rights or refund drill blocks',()=>{
 assert(run({licensedCatalogEvidenceIds:[]}).reasons.includes('DIGITAL_PRODUCT_RIGHTS_EVIDENCE_MISSING'))
 assert(run({refundDrillReceiptId:null}).reasons.includes('SECOND_BUSINESS_DELIVERY_REFUND_DRILL_MISSING'))
})
