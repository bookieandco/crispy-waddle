import test from 'node:test'
import assert from 'node:assert/strict'
import {planBusinessAutomationCycle,type AutomationLead,type BusinessAutomationInput} from './biz-purse-business-automation-playbook.js'

const asOf='2026-10-14T23:00:00Z'
const baseline:AutomationLead={
 leadRef:'lead:one',ownerUserId:'owner:one',businessId:'client-capture',
 source:'INBOUND_FORM',channel:'EMAIL',purpose:'SERVICE_REQUEST',
 capturedAt:'2026-10-10T20:00:00Z',lastInboundAt:'2026-10-10T20:00:00Z',
 initialReplyAt:null,permission:'SERVICE_REQUEST_ONLY',permissionEvidenceRef:null,
 evidenceRef:'fixture:lead-one',followUpsCompleted:0,
 needScore:5,serviceFitScore:5,timingScore:4,authorityScore:3,
}
const defaultInput:BusinessAutomationInput={
 ownerUserId:'owner:one',businessId:'client-capture',asOf,ownerStopRequested:false,
 leads:[baseline],
 operations:{customerOnboarding:null,supportCases:[],contentDrafts:[],cashSnapshot:null},
}
const run=(change:Partial<BusinessAutomationInput>={})=>planBusinessAutomationCycle({...defaultInput,...change})
const withLead=(changes:Partial<AutomationLead>)=>run({leads:[{...baseline,...changes}]})

test('real-looking sales inquiry only creates a human-approved internal initial reply',()=>{
 const result=run()
 assert.equal(result.status,'INTERNAL_DRAFT_ONLY')
 assert.equal(result.qualifyingLeadCount,1)
 assert.deepEqual(result.tasks.map(t=>t.kind),['DRAFT_INITIAL_REPLY'])
 assert.equal(result.tasks[0].humanApprovalRequired,true)
 assert.equal(result.canSend,false)
 assert.equal(result.canCall,false)
 assert.equal(result.canPurchaseSoftware,false)
 assert.equal(result.verifiedRevenueMinor,0)
})
test('a follower, story viewer or commenter cannot be treated as opt-in',()=>{
 const leads=['FOLLOW','STORY_VIEW','COMMENT'].map((source,i)=>({
  ...baseline,leadRef:'lead:viewer'+i,evidenceRef:'fixture:viewer'+i,
  source:source as AutomationLead['source'],purpose:'GENERAL_INTEREST' as const,
  permission:'UNKNOWN' as const,
 }))
 const r=run({leads})
 assert.equal(r.candidateCount,3)
 assert.equal(r.suppressedLeadCount,3)
 assert.equal(r.tasks.length,0)
})
test('withdrawn consent suppresses even a qualified lead',()=>{
 const r=withLead({permission:'WITHDRAWN',initialReplyAt:'2026-10-10T20:05:00Z'})
 assert.equal(r.tasks.length,0)
 assert.equal(r.suppressedLeadCount,1)
})
test('optional 24h/3d/7d/14d/21d follow-ups are drafts, never sends',()=>{
 const initial='2026-09-01T22:00:00Z'
 for(const stage of [0,1,2,3,4]){
  const r=withLead({permission:'EXPLICIT_MARKETING_OPT_IN',
   permissionEvidenceRef:'fixture:explicit-opt-in',capturedAt:'2026-08-31T20:00:00Z',
   lastInboundAt:'2026-08-31T20:00:00Z',initialReplyAt:initial,
   followUpsCompleted:stage})
  assert.equal(r.followUpDraftCount,1)
  assert.equal(r.tasks[0].kind,'DRAFT_VALUE_FOLLOWUP')
  assert.equal(r.tasks[0].canSend,false)
 }
 const done=withLead({permission:'EXPLICIT_MARKETING_OPT_IN',
  permissionEvidenceRef:'fixture:explicit-opt-in',capturedAt:'2026-08-31T20:00:00Z',
  lastInboundAt:'2026-08-31T20:00:00Z',initialReplyAt:initial,
  followUpsCompleted:5})
 assert.equal(done.followUpDraftCount,0)
})
test('a new customer reply suspends automated follow-up cadence for review',()=>{
 const r=withLead({permission:'EXPLICIT_MARKETING_OPT_IN',permissionEvidenceRef:'fixture:optin',
  capturedAt:'2026-10-01T20:00:00Z',initialReplyAt:'2026-10-01T22:00:00Z',
  lastInboundAt:'2026-10-11T22:00:00Z'})
 assert.equal(r.followUpDraftCount,0)
})
test('no follow-up is proposed before due time or without explicit opt-in',()=>{
 const early=withLead({permission:'EXPLICIT_MARKETING_OPT_IN',
  permissionEvidenceRef:'fixture:optin',initialReplyAt:'2026-10-14T22:30:00Z'})
 assert.equal(early.followUpDraftCount,0)
 const service=withLead({capturedAt:'2026-10-01T20:00:00Z',
  initialReplyAt:'2026-10-01T22:00:00Z',permission:'SERVICE_REQUEST_ONLY'})
 assert.equal(service.followUpDraftCount,0)
})
test('owner stop prevents every customer, content or finance action',()=>{
 const r=run({ownerStopRequested:true,operations:{
  customerOnboarding:{orderRef:'order:1',firstWinDefined:false,
   lastActiveAt:'2026-10-10T23:00:00Z',identityVerifiedExternally:false},
  supportCases:[{caseRef:'case:urgent',severity:'SAFETY',evidenceRef:'fixture:safety'}],
  contentDrafts:[{assetRef:'asset:1',brandReviewed:false,usageRightsVerified:false}],
  cashSnapshot:{asOf,externalCustodyVerified:false,unresolvedExceptions:2},
 }})
 assert.equal(r.status,'BLOCKED_OWNER_STOP')
 assert.equal(r.tasks.length,0)
 assert.equal(r.canMoveMoney,false)
})
test('first-week win, support escalation, editorial and daily cash all require review',()=>{
 const r=run({operations:{
  customerOnboarding:{orderRef:'order:synthetic',firstWinDefined:false,
   lastActiveAt:'2026-10-10T23:00:00Z',identityVerifiedExternally:false},
  supportCases:[{caseRef:'case:1',severity:'REFUND',evidenceRef:'fixture:case'}],
  contentDrafts:[{assetRef:'asset:one',brandReviewed:true,usageRightsVerified:false}],
  cashSnapshot:{asOf,externalCustodyVerified:false,unresolvedExceptions:2},
 }})
 const kinds=r.tasks.map(x=>x.kind)
 for(const x of ['REVIEW_FIRST_WEEK_WIN','ESCALATE_SUPPORT','REVIEW_CONTENT','REVIEW_DAILY_CASH'])
  assert(kinds.includes(x as typeof kinds[number]))
 assert(r.tasks.every(x=>x.humanApprovalRequired&&x.canCharge===false&&x.canPublish===false))
 assert.equal(r.canTreatClaimsAsROI,false)
})
test('disallow cross-tenant lead, missing opt-in proof, duplicate source and impossible chronology',()=>{
 assert.throws(()=>withLead({ownerUserId:'someone-else'}),/LEAD_OR_PERMISSION_INVALID/)
 assert.throws(()=>withLead({permission:'EXPLICIT_MARKETING_OPT_IN',permissionEvidenceRef:null}),/LEAD_OR_PERMISSION_INVALID/)
 assert.throws(()=>run({leads:[baseline,baseline]}),/DUPLICATE_LEAD_OR_EVIDENCE/)
 assert.throws(()=>withLead({capturedAt:'2026-10-20T00:00:00Z'}),/LEAD_OR_PERMISSION_INVALID/)
})
test('unverifiable lead scores, malformed evidence and over-followup are refused',()=>{
 assert.throws(()=>withLead({needScore:7}),/LEAD_OR_PERMISSION_INVALID/)
 assert.throws(()=>withLead({evidenceRef:'https://people.example/private'}),/LEAD_OR_PERMISSION_INVALID/)
 assert.throws(()=>withLead({followUpsCompleted:6}),/LEAD_OR_PERMISSION_INVALID/)
})
test('identical evidence provides stable digest regardless of input lead order',()=>{
 const another:AutomationLead={...baseline,leadRef:'lead:two',
  evidenceRef:'fixture:lead-two',permission:'WITHDRAWN'}
 const a=run({leads:[baseline,another]})
 const b=run({leads:[another,baseline]})
 assert.equal(a.evidenceDigest,b.evidenceDigest)
 assert.deepEqual(a.tasks,b.tasks)
})
