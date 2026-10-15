import test from 'node:test'
import assert from 'node:assert/strict'
import {planBusinessAutomationCycle,type BusinessAutomationInput} from './biz-purse-business-automation-playbook.js'
import {reviewBusinessDirector,type BusinessDirectorReceipt} from './biz-purse-19-business-director.js'
import {reviewBusinessAutomationBoard,type AutomationReviewDecision} from './biz-purse-business-automation-review-board.js'

const asOf='2026-10-14T23:00:00Z'
const base:BusinessAutomationInput={
 ownerUserId:'owner:one',businessId:'client-capture',asOf,ownerStopRequested:false,
 leads:[{leadRef:'lead:one',ownerUserId:'owner:one',businessId:'client-capture',
  source:'INBOUND_FORM',channel:'EMAIL',purpose:'SERVICE_REQUEST',
  capturedAt:'2026-10-13T21:00:00Z',lastInboundAt:'2026-10-13T21:00:00Z',
  initialReplyAt:null,permission:'SERVICE_REQUEST_ONLY',permissionEvidenceRef:null,
  evidenceRef:'fixture:one',followUpsCompleted:0,
  needScore:5,serviceFitScore:4,timingScore:5,authorityScore:3}],
 operations:{customerOnboarding:null,supportCases:[{caseRef:'case:1',severity:'SAFETY',evidenceRef:'fixture:safety'}],
  contentDrafts:[],cashSnapshot:null},
}
const director=()=>{
 const steps=['RESEARCH','REVIEW_OFFER','SCOPE_ORDER','REVIEW_DELIVERY','REVIEW_OUTCOME'] as const
 const receipts:BusinessDirectorReceipt[]=steps.map((step,i)=>({
  id:'director:'+i,sequence:i+1,ownerUserId:'owner:one',businessId:'client-capture',
  step,verdict:'PASS',evidenceId:'fixture:director:'+i,at:asOf,source:'SIMULATED',
 }))
 return reviewBusinessDirector({ownerUserId:'owner:one',businessId:'client-capture',asOf,
  receipts,stopRequested:false,authorizedResearchFamilies:['business_automation'],
  businessFamily:'business_automation'})
}
const input=()=>({ownerUserId:'owner:one',businessId:'client-capture',asOf,
 ownerStopRequested:false,director:director(),cycle:planBusinessAutomationCycle(base),
 decisions:[] as AutomationReviewDecision[]})
const decision=(taskId:string):AutomationReviewDecision=>({
 receiptId:'review:one',taskId,reviewerRef:'reviewer:claimed',ownerUserId:'owner:one',
 businessId:'client-capture',observedAt:asOf,verdict:'RETAIN_DRAFT',evidenceRef:'fixture:review',
})
test('actual automation planner connects with Business Director, awaiting human review only',()=>{
 const board=reviewBusinessAutomationBoard(input())
 assert.equal(board.status,'INTERNAL_REVIEW_ONLY')
 assert.deepEqual(board.items.map(x=>x.kind).sort(),['DRAFT_INITIAL_REPLY','ESCALATE_SUPPORT'])
 assert.equal(board.waitingCount,2);assert.equal(board.canSend,false)
 assert.equal(board.canDispatchTasks,false);assert.equal(board.ownerReviewAuthenticated,false)
})
test('retained human draft remains non-dispatchable and never counts revenue',()=>{
 const original=input()
 const choice=decision(original.cycle.tasks[0].taskId)
 const board=reviewBusinessAutomationBoard({...original,decisions:[choice]})
 assert.equal(board.retainedDraftCount,1)
 assert.equal(board.items.find(x=>x.taskId===choice.taskId)?.state,'DRAFT_RETAINED')
 assert.equal(board.canSend,false);assert.equal(board.canMoveMoney,false)
})
test('duplicate receipt exact replay is idempotent, changed receipt conflicts',()=>{
 const original=input(),d=decision(original.cycle.tasks[0].taskId)
 const once=reviewBusinessAutomationBoard({...original,decisions:[d]})
 const twice=reviewBusinessAutomationBoard({...original,decisions:[d,d]})
 assert.equal(once.evidenceDigest,twice.evidenceDigest)
 assert.throws(()=>reviewBusinessAutomationBoard({...original,decisions:[d,{...d,verdict:'REJECT'}]}),/RECEIPT_REPLAY_CONFLICT/)
})
test('double decision, phantom task, other owner and future approval are rejected',()=>{
 const original=input(),d=decision(original.cycle.tasks[0].taskId)
 assert.throws(()=>reviewBusinessAutomationBoard({...original,decisions:[d,{...d,receiptId:'review:two',verdict:'REJECT'}]}),/MULTIPLE_DECISIONS/)
 assert.throws(()=>reviewBusinessAutomationBoard({...original,decisions:[{...d,taskId:'automation:phantom'}]}),/REVIEW_INVALID/)
 assert.throws(()=>reviewBusinessAutomationBoard({...original,decisions:[{...d,ownerUserId:'other'}]}),/REVIEW_INVALID/)
 assert.throws(()=>reviewBusinessAutomationBoard({...original,decisions:[{...d,observedAt:'2026-10-15T01:00:00Z'}]}),/REVIEW_INVALID/)
})
test('owner stop or blocked Director forbids retained draft and external actions',()=>{
 const original=input(),d=decision(original.cycle.tasks[0].taskId)
 const halt=reviewBusinessAutomationBoard({...original,ownerStopRequested:true,decisions:[d]})
 assert.equal(halt.status,'BLOCKED');assert.equal(halt.retainedDraftCount,0)
 assert(halt.items.every(x=>x.state==='OWNER_STOP_BLOCKED'))
 const blockedDirector=reviewBusinessDirector({ownerUserId:'owner:one',businessId:'client-capture',
  asOf,receipts:[],stopRequested:true,authorizedResearchFamilies:[],
  businessFamily:'business_automation'})
 const blocked=reviewBusinessAutomationBoard({...original,director:blockedDirector})
 assert.equal(blocked.status,'BLOCKED');assert.equal(blocked.canDispatchTasks,false)
})
test('cross-tenant automation cycle and fake executable task are rejected',()=>{
 const original=input()
 assert.throws(()=>reviewBusinessAutomationBoard({...original,ownerUserId:'other'}),/TRUST_BOUNDARY_INVALID/)
 const forgedCycle={...original.cycle,tasks:original.cycle.tasks.map((x,i)=>i===0?{...x,canSend:true as const}:x)}
 assert.throws(()=>reviewBusinessAutomationBoard({...original,cycle:forgedCycle}),/TASK_INVALID_OR_DUPLICATE/)
})
