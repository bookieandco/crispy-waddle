import {createHash} from 'node:crypto'
import type {
 BusinessAutomationCycle,AutomationDraftTask,AutomationTaskKind,
} from './biz-purse-business-automation-playbook.js'
import type {BusinessDirectorReview} from './biz-purse-19-business-director.js'

/**
 * BIZ-PURSE.AUTOMATION.02: owner-review board for existing internal drafts.
 * This has no database, network, send, call, payment, or worker adapter.
 * "Approval" means only acceptance of a draft for further manual review.
 */
export type AutomationReviewDecision=Readonly<{
 receiptId:string
 taskId:string
 reviewerRef:string
 ownerUserId:string
 businessId:string
 observedAt:string
 verdict:'RETAIN_DRAFT'|'REJECT'|'ESCALATE'
 evidenceRef:string
}>
export type AutomationBoardItem=Readonly<{
 taskId:string
 kind:AutomationTaskKind
 subjectRef:string
 dueAt:string
 state:'WAITING_REVIEW'|'DRAFT_RETAINED'|'REJECTED'|'ESCALATED'|'OWNER_STOP_BLOCKED'
 receiptId:string|null
 humanApprovalRequired:true
 canSend:false
 canCall:false
 canPublish:false
 canCharge:false
}>
export type AutomationBoard=Readonly<{
 status:'BLOCKED'|'INTERNAL_REVIEW_ONLY'
 ownerUserId:string
 businessId:string
 asOf:string
 items:readonly AutomationBoardItem[]
 waitingCount:number
 retainedDraftCount:number
 rejectedCount:number
 escalatedCount:number
 suppressedLeadCount:number
 candidateLeadCount:number
 evidenceDigest:string
 reasons:readonly string[]
 authority:'INTERNAL_OWNER_REVIEW_ONLY'
 ownerReviewAuthenticated:false
 canDispatchTasks:false
 canSend:false
 canCall:false
 canPublish:false
 canCharge:false
 canAccessLiveCrm:false
 canMoveMoney:false
}>
const ref=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<=256&&s.trim()===s
const when=(s:unknown):s is string=>typeof s==='string'&&Number.isFinite(Date.parse(s))
const hash=(value:unknown):string=>createHash('sha256').update(JSON.stringify(value)).digest('hex')

export function reviewBusinessAutomationBoard(input:Readonly<{
 ownerUserId:string
 businessId:string
 asOf:string
 ownerStopRequested:boolean
 director:BusinessDirectorReview
 cycle:BusinessAutomationCycle
 decisions:readonly AutomationReviewDecision[]
}>):AutomationBoard{
 if(!input||!ref(input.ownerUserId)||!ref(input.businessId)||!when(input.asOf)||
    !Array.isArray(input.decisions)||input.decisions.length>10000)
  throw Error('BIZ_PURSE_AUTOMATION_BOARD_INPUT_INVALID')
 const {cycle,director}=input
 if(!cycle||!director||cycle.ownerUserId!==input.ownerUserId||
   cycle.businessId!==input.businessId||director.ownerUserId!==input.ownerUserId||
   director.businessId!==input.businessId||cycle.asOf!==input.asOf||
   !Array.isArray(cycle.tasks)||!Array.isArray(director.completedSteps)||
   cycle.authority!=='AUTOMATION_PLAYBOOK_RESEARCH_ONLY'||
   director.authority!=='DIRECTOR_REVIEW_ONLY'||
   cycle.canSend!==false||cycle.canCall!==false||cycle.canCharge!==false||
   cycle.canPublish!==false||cycle.canMoveMoney!==false||
   director.canContactCustomers!==false||director.canMoveMoney!==false)
  throw Error('BIZ_PURSE_AUTOMATION_BOARD_TRUST_BOUNDARY_INVALID')

 const reasons:string[]=[]
 const halted=input.ownerStopRequested||cycle.status==='BLOCKED_OWNER_STOP'||director.status==='BLOCKED'
 if(input.ownerStopRequested||cycle.status==='BLOCKED_OWNER_STOP')reasons.push('OWNER_STOP_ACTIVE')
 if(director.status==='BLOCKED')reasons.push('BUSINESS_DIRECTOR_BLOCKED')
 if(director.status!=='INTERNAL_REHEARSAL_COMPLETE'&&director.status!=='WAITING_REVIEW'&&director.status!=='BLOCKED')
  reasons.push('DIRECTOR_STATE_INVALID')
 const tasks=new Map<string,AutomationDraftTask>()
 for(const t of cycle.tasks){
  if(!t||!ref(t.taskId)||!ref(t.subjectRef)||!when(t.dueAt)||
     t.humanApprovalRequired!==true||t.canSend!==false||t.canCall!==false||
     t.canPublish!==false||t.canCharge!==false||tasks.has(t.taskId))
   throw Error('BIZ_PURSE_AUTOMATION_BOARD_TASK_INVALID_OR_DUPLICATE')
  tasks.set(t.taskId,t)
 }
 const decisions=new Map<string,AutomationReviewDecision>()
 const ids=new Map<string,string>()
 for(const d of input.decisions){
  if(!d||!ref(d.receiptId)||!ref(d.taskId)||!ref(d.reviewerRef)||!ref(d.evidenceRef)||
   !when(d.observedAt)||Date.parse(d.observedAt)>Date.parse(input.asOf)||
   d.ownerUserId!==input.ownerUserId||d.businessId!==input.businessId||
   !['RETAIN_DRAFT','REJECT','ESCALATE'].includes(d.verdict)||!tasks.has(d.taskId))
    throw Error('BIZ_PURSE_AUTOMATION_BOARD_REVIEW_INVALID')
  const encoded=JSON.stringify(d)
  const prior=ids.get(d.receiptId)
  if(prior!==undefined){
   if(prior!==encoded)throw Error('BIZ_PURSE_AUTOMATION_BOARD_RECEIPT_REPLAY_CONFLICT')
   continue
  }
  if(decisions.has(d.taskId))throw Error('BIZ_PURSE_AUTOMATION_BOARD_MULTIPLE_DECISIONS')
  ids.set(d.receiptId,encoded)
  decisions.set(d.taskId,d)
 }
 const items=[...tasks.values()].map(t=>{
  const decision=decisions.get(t.taskId)
  const state=halted?'OWNER_STOP_BLOCKED' as const:
   decision?.verdict==='RETAIN_DRAFT'?'DRAFT_RETAINED' as const:
   decision?.verdict==='REJECT'?'REJECTED' as const:
   decision?.verdict==='ESCALATE'?'ESCALATED' as const:'WAITING_REVIEW' as const
  return Object.freeze({
   taskId:t.taskId,kind:t.kind,subjectRef:t.subjectRef,dueAt:t.dueAt,
   state,receiptId:decision?.receiptId??null,
   humanApprovalRequired:true as const,canSend:false as const,canCall:false as const,
   canPublish:false as const,canCharge:false as const,
  })
 }).sort((a,b)=>a.dueAt.localeCompare(b.dueAt)||a.taskId.localeCompare(b.taskId))
 const count=(state:AutomationBoardItem['state'])=>items.filter(i=>i.state===state).length
 // Decisions are caller-provided; no authentication or external permission
 // is inferred from a reviewerRef or a submitted receipt.
 reasons.push('REVIEWER_AUTHENTICATION_NOT_COMMISSIONED')
 reasons.push('CRM_AND_CHANNEL_DISPATCH_NOT_COMMISSIONED')
 return Object.freeze({
  status:reasons.some(r=>r==='OWNER_STOP_ACTIVE'||r==='BUSINESS_DIRECTOR_BLOCKED')?'BLOCKED' as const:'INTERNAL_REVIEW_ONLY' as const,
  ownerUserId:input.ownerUserId,businessId:input.businessId,asOf:input.asOf,
  items:Object.freeze(items),waitingCount:count('WAITING_REVIEW'),
  retainedDraftCount:count('DRAFT_RETAINED'),rejectedCount:count('REJECTED'),
  escalatedCount:count('ESCALATED'),suppressedLeadCount:cycle.suppressedLeadCount,
  candidateLeadCount:cycle.candidateCount,
  evidenceDigest:hash({ownerUserId:input.ownerUserId,businessId:input.businessId,
   asOf:input.asOf,stop:input.ownerStopRequested,directorDigest:director.digest,
   cycleDigest:cycle.evidenceDigest,items,decisionDigests:[...ids.values()].sort()}),
  reasons:Object.freeze(reasons),authority:'INTERNAL_OWNER_REVIEW_ONLY' as const,
  ownerReviewAuthenticated:false as const,canDispatchTasks:false as const,
  canSend:false as const,canCall:false as const,canPublish:false as const,
  canCharge:false as const,canAccessLiveCrm:false as const,canMoveMoney:false as const,
 })
}
