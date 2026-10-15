import assert from 'node:assert/strict'
import test from 'node:test'
import type {Opportunity} from './opportunity.js'
import {buildSideHustleProfile} from './side-hustles.js'
import {
 prepareClientCapturePilotReport,rehearseClientCaptureStudioPilot,
 type ClientCapturePilotInput,type ClientCapturePilotObservation,
} from './biz-purse-client-capture-pilot.js'

const createdAt='2026-10-14T20:00:00Z',evaluatedAt='2026-10-14T21:00:00Z'
const opportunity:Opportunity={
 id:'opportunity:pilot',title:'Synthetic client intake audit',family:'business',
 type:'commercial',sourceUrl:'https://example.invalid/synthetic',
 sourceName:'synthetic fixture',claims:[],evidence:[],
 verificationStatus:'unverified',sourceConfidence:0.1,riskFlags:[],
 metadata:{sideHustleProfile:buildSideHustleProfile({family:'business_automation'})},
 status:'approved',createdAt,updatedAt:createdAt,
}
const item=(caseId:string,stage:ClientCapturePilotObservation['stage'],time:string):ClientCapturePilotObservation=>({
 caseId,stage,occurredAt:'2026-10-14T'+time+':00Z',evidenceRef:'fixture:'+caseId+':'+stage,
})
const events:ClientCapturePilotObservation[]=[
 item('case:1','INQUIRY','20:01'),item('case:1','FIRST_RESPONSE','20:03'),
 item('case:1','QUALIFIED','20:05'),item('case:1','HANDOFF','20:07'),
 item('case:2','INQUIRY','20:10'),
 item('case:3','INQUIRY','20:20'),item('case:3','FIRST_RESPONSE','20:50'),
 item('case:3','EXCEPTION','20:51'),
]
const input:ClientCapturePilotInput={
 mode:'SYNTHETIC_REHEARSAL_ONLY',syntheticFixtureConfirmed:true,
 ownerUserId:'owner:synthetic',customerRef:'customer:synthetic',workOrderId:'workorder:synthetic',
 opportunity,createdAt,evaluatedAt,targetResponseMinutes:10,
 observations:events,simulatedCustomerDecision:'accepted',
}
test('computes factual synthetic intake counts, response delays, and exception findings',()=>{
 const r=prepareClientCapturePilotReport(input)
 assert.equal(r.inquiryCount,3)
 assert.equal(r.responsesObserved,2)
 assert.equal(r.responsesOnTime,1)
 assert.equal(r.handoffsObserved,1)
 assert.equal(r.openExceptionCount,1)
 assert.deepEqual(r.measuredResponseMinutes,[2,30])
 assert.deepEqual(r.findings.map(f=>f.code),['RESPONSE_LATE','RESPONSE_MISSING','EXCEPTION_OPEN'])
 assert.equal(r.synthetic,true);assert.equal(r.actualResultsVerified,false)
 assert.equal(r.externalPublicationAuthorized,false)
})
test('audit pricing and canonical work-order lifecycle are actually exercised with synthetic acceptance',()=>{
 const r=rehearseClientCaptureStudioPilot(input)
 assert.equal(r.quotedPriceUsd,99)
 assert.deepEqual(r.simulatedWorkOrderStages,['draft','scope_locked','delivery_in_progress','delivered','accepted'])
 assert.equal(r.simulatedAcceptanceDecision,'accepted')
 assert.equal(r.simulatedDeliveryReceiptId,'fixture:delivery:workorder:synthetic')
 assert.equal(r.canDeliverToCustomer,false)
 assert.equal(r.canRecordRealCustomerAcceptance,false)
 assert.equal(r.canRecognizeRevenue,false)
 assert.equal(r.canCharge,false);assert.equal(r.canMoveMoney,false)
 assert(r.blockers.includes('REAL_PROVIDER_SETTLEMENT_AND_CUSTOMER_ACCEPTANCE_NOT_VERIFIED'))
})
test('revision rehearsal routes the synthetic work order to revision_required, not accepted',()=>{
 const r=rehearseClientCaptureStudioPilot({...input,simulatedCustomerDecision:'revision_required'})
 assert.equal(r.simulatedWorkOrderStages.at(-1),'revision_required')
 assert.equal(r.simulatedAcceptanceDecision,'revision_required')
 assert.equal(r.canRecordRealCustomerAcceptance,false)
})
test('without simulated customer decision, delivery remains delivered and blocked',()=>{
 const r=rehearseClientCaptureStudioPilot({...input,simulatedCustomerDecision:'none'})
 assert.equal(r.simulatedWorkOrderStages.at(-1),'delivered')
 assert.equal(r.simulatedAcceptanceReceiptId,null)
 assert(r.blockers.includes('SIMULATED_CUSTOMER_DECISION_NOT_RECORDED'))
})
test('real customer execution, unconfirmed fixture and unauthorized opportunity are refused',()=>{
 assert.throws(()=>rehearseClientCaptureStudioPilot({...input,mode:'LIVE' as never}),/REAL_CUSTOMER_PIPELINE_NOT_COMMISSIONED/)
 assert.throws(()=>rehearseClientCaptureStudioPilot({...input,syntheticFixtureConfirmed:false as never}),/REAL_CUSTOMER_PIPELINE_NOT_COMMISSIONED/)
 assert.throws(()=>rehearseClientCaptureStudioPilot({...input,opportunity:{...opportunity,status:'discovered'}}),/CANONICAL_OPPORTUNITY_NOT_REVIEWED/)
})
test('orphan response, reversed chronology and qualified-before-response are refused',()=>{
 assert.throws(()=>prepareClientCapturePilotReport({...input,observations:[item('solo','FIRST_RESPONSE','20:01')]}),/ORPHANED_STAGE/)
 assert.throws(()=>prepareClientCapturePilotReport({...input,observations:[
  item('x','INQUIRY','20:22'),item('x','FIRST_RESPONSE','20:20')]}),/CHRONOLOGY/)
 assert.throws(()=>prepareClientCapturePilotReport({...input,observations:[
  item('x','INQUIRY','20:01'),item('x','QUALIFIED','20:03')]}),/CHRONOLOGY/)
})
test('duplicate stage and duplicate evidence provenance cannot inflate measured volume',()=>{
 assert.throws(()=>prepareClientCapturePilotReport({...input,observations:[events[0],events[0]]}),/DUPLICATE_OBSERVATION/)
 assert.throws(()=>prepareClientCapturePilotReport({...input,observations:[events[0],{...events[1],evidenceRef:events[0].evidenceRef}]}),/DUPLICATE_OBSERVATION/)
})
test('nonfixture evidence and observations outside intake window fail closed',()=>{
 assert.throws(()=>prepareClientCapturePilotReport({...input,observations:[{...events[0],evidenceRef:'live:unverified'}]}),/OBSERVATION_INVALID/)
 assert.throws(()=>prepareClientCapturePilotReport({...input,observations:[{...events[0],occurredAt:'2026-10-14T23:00:00Z'}]}),/OBSERVATION_INVALID/)
})
test('small baseline is explicitly insufficient rather than implying a conversion gain',()=>{
 const r=prepareClientCapturePilotReport({...input,observations:[events[0],events[1]]})
 assert.equal(r.inquiryCount,1)
 assert(r.findings.some(f=>f.code==='BASELINE_LIMITED'))
 assert.equal(r.actualResultsVerified,false)
})
test('invalid response target and no events cannot be admitted',()=>{
 assert.throws(()=>prepareClientCapturePilotReport({...input,targetResponseMinutes:0}),/RESPONSE_TARGET_INVALID/)
 assert.throws(()=>prepareClientCapturePilotReport({...input,observations:[]}),/OBSERVATIONS_REQUIRED/)
})
