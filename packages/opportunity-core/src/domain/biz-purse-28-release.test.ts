import test from 'node:test'
import assert from 'node:assert/strict'
import {evaluateBusinessFactoryRelease,BIZ_PURSE_RELEASE_MILESTONES} from './biz-purse-28-release.js'
const sha='a'.repeat(40)
const evidence=BIZ_PURSE_RELEASE_MILESTONES.map((milestone,i)=>({
 milestone,headSha:sha,testRunId:'test:'+i,outcome:'PASS' as const,scope:'CODE_ONLY' as const,
 evidenceRef:'repo:ci:'+i}))
const run=(e:readonly typeof evidence[number][]=evidence,o:Record<string,unknown>={})=>evaluateBusinessFactoryRelease({
 headSha:sha,at:'2026-10-14T22:00:00Z',evidence:e,ownerStopRequested:false,databaseRepairOpen:true,
 paymentProviderCommissioned:false,ownerCustodyCommissioned:false,
 independentLiveHostCertified:false,twoLiveBusinessesVerified:false,...o})
test('even nine reported passing tests do not certify payments or host',()=>{
 const r=run();assert.equal(r.status,'BLOCKED');assert.equal(r.productionCertified,false)
 assert.equal(r.canDeploy,false);assert.equal(r.canMoveMoney,false)
 assert(r.reasons.includes('SUPABASE_RECOVERY_NOT_COMMISSIONED'))
})
test('fabricated external completion flags cannot themselves sign production release',()=>{
 const r=run(evidence,{databaseRepairOpen:false,paymentProviderCommissioned:true,
  ownerCustodyCommissioned:true,independentLiveHostCertified:true,twoLiveBusinessesVerified:true})
 assert.equal(r.status,'CODE_HANDOFF_REVIEW_ONLY')
 assert.equal(r.canMergeAsProduction,false)
})
test('missing milestone or reused run IDs are rejected',()=>{
 assert(run(evidence.slice(0,8)).reasons.includes('MILESTONE_TEST_INCOMPLETE:BIZ-PURSE.27'))
 assert.throws(()=>run([evidence[0],{...evidence[1],testRunId:evidence[0].testRunId}]),/INVALID_OR_DUPLICATE_EVIDENCE/)
})
