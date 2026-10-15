import test from 'node:test'
import assert from 'node:assert/strict'
import type {Opportunity} from './opportunity.js'
import {buildSideHustleProfile} from './side-hustles.js'
import {buildClientCaptureStudioDraft} from './biz-purse-client-capture.js'
const now='2026-10-14T23:00:00Z'
const opportunity:Opportunity={id:'studio:1',title:'Client Capture Studio',family:'business',type:'commercial',sourceUrl:'https://example.test/studio',sourceName:'owner test',claims:[],evidence:[],verificationStatus:'unverified',sourceConfidence:0.5,riskFlags:[],metadata:{sideHustleProfile:buildSideHustleProfile({family:'business_automation'})},status:'discovered',createdAt:now,updatedAt:now}
const make=(offer:'AUDIT'|'SETUP'|'MANAGED_MONTHLY')=>buildClientCaptureStudioDraft({opportunity,offer,workOrderId:'draft:1',customerRef:'customer:1',evidenceRefs:['client:scope'],createdAt:now})
test('audit is a narrow $99 quote not an unauthorized implementation',()=>{const x=make('AUDIT');assert.equal(x.draft.price.amount,99);assert.equal(x.draft.price.cadence,'one_time');assert.deepEqual(x.draft.scopeItems.map(s=>s.id),['audit']);assert.equal(x.paymentAuthorized,false);assert.equal(x.fulfillmentAuthorized,false)})
test('setup reuses existing automation service template with QA criteria',()=>{const x=make('SETUP');assert.equal(x.draft.price.amount,299);assert(x.draft.scopeItems.some(s=>s.id==='qa'));assert(x.draft.acceptanceCriteria.some(c=>c.id==='failure-path'))})
test('monthly managed service requires observed support receipts and customer acceptance',()=>{const x=make('MANAGED_MONTHLY');assert.equal(x.draft.price.amount,149);assert.equal(x.draft.price.cadence,'monthly');assert(x.draft.acceptanceCriteria.some(c=>c.id==='customer-acceptance'));assert(x.draft.evidenceRefs.includes('product:client-capture-studio:v1'))})
test('missing evidence and unrelated families fail closed',()=>{assert.throws(()=>buildClientCaptureStudioDraft({opportunity,offer:'AUDIT',workOrderId:'x',customerRef:'y',evidenceRefs:[],createdAt:now}),/SOURCE_EVIDENCE_REQUIRED/);assert.throws(()=>buildClientCaptureStudioDraft({opportunity:{...opportunity,metadata:{}},offer:'AUDIT',workOrderId:'x',customerRef:'y',evidenceRefs:['a'],createdAt:now}),/BUSINESS_AUTOMATION_PROFILE_REQUIRED/)})
