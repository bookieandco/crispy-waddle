import {createHash} from 'node:crypto'

/**
 * BIZ-PURSE.AUTOMATION.01 — internally proposed business workflow tasks.
 * Incorporates educational automation playbooks without their ROI assertions.
 *
 * No network, LLM, CRM, email, phone, social, payment, or database API.
 */
export type AutomationLeadSource='INBOUND_FORM'|'INBOUND_DM'|'COMMENT'|'FOLLOW'|'STORY_VIEW'
export type AutomationChannel='EMAIL'|'IG_DM'|'SMS'|'VOICE'
export type AutomationPermission='EXPLICIT_MARKETING_OPT_IN'|'SERVICE_REQUEST_ONLY'|'UNKNOWN'|'WITHDRAWN'
export type AutomationLead=Readonly<{
 leadRef:string
 ownerUserId:string
 businessId:string
 source:AutomationLeadSource
 channel:AutomationChannel
 purpose:'SERVICE_REQUEST'|'GENERAL_INTEREST'
 capturedAt:string
 lastInboundAt:string|null
 initialReplyAt:string|null
 permission:AutomationPermission
 permissionEvidenceRef:string|null
 evidenceRef:string
 followUpsCompleted:number
 needScore:number
 serviceFitScore:number
 timingScore:number
 authorityScore:number
}>
export type AutomationOperations=Readonly<{
 customerOnboarding:Readonly<{orderRef:string;firstWinDefined:boolean;lastActiveAt:string;identityVerifiedExternally:boolean}>|null
 supportCases:readonly Readonly<{caseRef:string;severity:'ROUTINE'|'COMPLAINT'|'REFUND'|'SAFETY';evidenceRef:string}>[]
 contentDrafts:readonly Readonly<{assetRef:string;brandReviewed:boolean;usageRightsVerified:boolean}>[]
 cashSnapshot:Readonly<{asOf:string;externalCustodyVerified:boolean;unresolvedExceptions:number}>|null
}>
export type AutomationTaskKind='REVIEW_LEAD'|'DRAFT_INITIAL_REPLY'|'DRAFT_VALUE_FOLLOWUP'|
 'REVIEW_FIRST_WEEK_WIN'|'ESCALATE_SUPPORT'|'REVIEW_SUPPORT_REPLY'|'REVIEW_CONTENT'|'REVIEW_DAILY_CASH'
export type AutomationDraftTask=Readonly<{
 taskId:string
 kind:AutomationTaskKind
 subjectRef:string
 dueAt:string
 rationale:string
 humanApprovalRequired:true
 canSend:false
 canCall:false
 canPublish:false
 canCharge:false
}>
export type BusinessAutomationCycle=Readonly<{
 status:'BLOCKED_OWNER_STOP'|'INTERNAL_DRAFT_ONLY'
 ownerUserId:string
 businessId:string
 asOf:string
 candidateCount:number
 suppressedLeadCount:number
 qualifyingLeadCount:number
 followUpDraftCount:number
 tasks:readonly AutomationDraftTask[]
 blockers:readonly string[]
 evidenceDigest:string
 authority:'AUTOMATION_PLAYBOOK_RESEARCH_ONLY'
 verifiedRevenueMinor:0
 canSend:false
 canCall:false
 canPublish:false
 canCharge:false
 canMoveMoney:false
 canPurchaseSoftware:false
 canTreatClaimsAsROI:false
}>
export type BusinessAutomationInput=Readonly<{
 ownerUserId:string
 businessId:string
 asOf:string
 ownerStopRequested:boolean
 leads:readonly AutomationLead[]
 operations:AutomationOperations
}>
const DAY=86_400_000
const TOUCH_OFFSETS_DAYS=[1,3,7,14,21] as const
const identifier=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=160&&v===v.trim()
const time=(v:string):number=>Date.parse(v)
const validTime=(v:unknown):v is string=>typeof v==='string'&&Number.isFinite(time(v))
const score=(n:unknown):n is number=>typeof n==='number'&&Number.isInteger(n)&&n>=0&&n<=5
const hash=(data:unknown):string=>createHash('sha256').update(JSON.stringify(data)).digest('hex')
function task(kind:AutomationTaskKind,subjectRef:string,dueAt:string,rationale:string):AutomationDraftTask{
 return Object.freeze({taskId:'automation:'+hash([kind,subjectRef,dueAt]),kind,subjectRef,dueAt,
  rationale,humanApprovalRequired:true as const,canSend:false as const,canCall:false as const,
  canPublish:false as const,canCharge:false as const})
}

/**
 * Follow-up timings are a study sequence (24h / 3d / 7d / 14d / 21d), not an
 * instruction to message anyone. Follows/comments/story views do not confer
 * permission; service requests permit only an internal initial-reply draft.
 */
export function planBusinessAutomationCycle(input:BusinessAutomationInput):BusinessAutomationCycle{
 if(!input||!identifier(input.ownerUserId)||!identifier(input.businessId)||
    !validTime(input.asOf)||!Array.isArray(input.leads)||input.leads.length>2000||
    !input.operations||!Array.isArray(input.operations.supportCases)||
    !Array.isArray(input.operations.contentDrafts))
  throw Error('BIZ_PURSE_AUTOMATION_INPUT_INVALID')
 const now=time(input.asOf),tasks:AutomationDraftTask[]=[]
 const seen=new Set<string>(),evidence=new Set<string>()
 let suppressed=0,qualified=0,followupDrafts=0
 for(const lead of input.leads){
  if(!lead||!identifier(lead.leadRef)||!/^lead:[A-Za-z0-9_-]+$/.test(lead.leadRef)||
   lead.ownerUserId!==input.ownerUserId||lead.businessId!==input.businessId||
   !['INBOUND_FORM','INBOUND_DM','COMMENT','FOLLOW','STORY_VIEW'].includes(lead.source)||
   !['EMAIL','IG_DM','SMS','VOICE'].includes(lead.channel)||
   !['SERVICE_REQUEST','GENERAL_INTEREST'].includes(lead.purpose)||
   !['EXPLICIT_MARKETING_OPT_IN','SERVICE_REQUEST_ONLY','UNKNOWN','WITHDRAWN'].includes(lead.permission)||
   !identifier(lead.evidenceRef)||!lead.evidenceRef.startsWith('fixture:')||
   (lead.permissionEvidenceRef!==null&&!identifier(lead.permissionEvidenceRef))||
   (lead.permission==='EXPLICIT_MARKETING_OPT_IN'&&!lead.permissionEvidenceRef)||
   !validTime(lead.capturedAt)||time(lead.capturedAt)>now||
   (lead.lastInboundAt!==null&&(!validTime(lead.lastInboundAt)||time(lead.lastInboundAt)<time(lead.capturedAt)||time(lead.lastInboundAt)>now))||
   (lead.initialReplyAt!==null&&(!validTime(lead.initialReplyAt)||time(lead.initialReplyAt)<time(lead.capturedAt)||time(lead.initialReplyAt)>now))||
   !Number.isSafeInteger(lead.followUpsCompleted)||lead.followUpsCompleted<0||
   lead.followUpsCompleted>5||
   ![lead.needScore,lead.serviceFitScore,lead.timingScore,lead.authorityScore].every(score))
   throw Error('BIZ_PURSE_AUTOMATION_LEAD_OR_PERMISSION_INVALID')
  if(seen.has(lead.leadRef)||evidence.has(lead.evidenceRef))
   throw Error('BIZ_PURSE_AUTOMATION_DUPLICATE_LEAD_OR_EVIDENCE')
  seen.add(lead.leadRef);evidence.add(lead.evidenceRef)
  if(lead.permission==='WITHDRAWN'||lead.permission==='UNKNOWN'){
   suppressed++;continue
  }
  const leadScore=5*(lead.needScore+lead.serviceFitScore+lead.timingScore+lead.authorityScore)
  const isQualified=leadScore>=70
  if(isQualified)qualified++
  if(input.ownerStopRequested)continue
  if(!isQualified){
   tasks.push(task('REVIEW_LEAD',lead.leadRef,input.asOf,'Insufficient documented service-fit evidence; request human review.'))
   continue
  }
  const hasInboundRequest=lead.purpose==='SERVICE_REQUEST'&&
    ['INBOUND_FORM','INBOUND_DM'].includes(lead.source)
  if(hasInboundRequest&&lead.initialReplyAt===null){
   tasks.push(task('DRAFT_INITIAL_REPLY',lead.leadRef,input.asOf,
    'In-scope incoming request: compose a factual reply draft; no message is sent.'))
  }
  // An Instagram follow/story view/comment is NOT itself a request or opt-in.
  if(lead.permission!=='EXPLICIT_MARKETING_OPT_IN'||lead.initialReplyAt===null||
    lead.followUpsCompleted===TOUCH_OFFSETS_DAYS.length)continue
  // A new inbound reply suspends the automated follow-up chain for human review.
  if(lead.lastInboundAt!==null&&time(lead.lastInboundAt)>time(lead.initialReplyAt))continue
  const due=time(lead.initialReplyAt)+TOUCH_OFFSETS_DAYS[lead.followUpsCompleted]*DAY
  if(now>=due){
   tasks.push(task('DRAFT_VALUE_FOLLOWUP',lead.leadRef,new Date(due).toISOString(),
    'Optional value-first follow-up suggestion only. Confirm current opt-in, channel window, suppression, disclosure and human approval.'))
   followupDrafts++
  }
 }
 const op=input.operations
 if(op.customerOnboarding){
  const c=op.customerOnboarding
  if(!identifier(c.orderRef)||!validTime(c.lastActiveAt)||time(c.lastActiveAt)>now||
    typeof c.firstWinDefined!=='boolean'||typeof c.identityVerifiedExternally!=='boolean')
   throw Error('BIZ_PURSE_AUTOMATION_ONBOARDING_INVALID')
  if(!input.ownerStopRequested&&(!c.firstWinDefined||now-time(c.lastActiveAt)>=3*DAY))
   tasks.push(task('REVIEW_FIRST_WEEK_WIN',c.orderRef,input.asOf,
    'Review a smallest-useful-first-win onboarding task and any inactivity; payment and delivery remain independently gated.'))
 }
 if(op.supportCases.length>300||op.contentDrafts.length>300)
  throw Error('BIZ_PURSE_AUTOMATION_OPERATIONS_CAP_EXCEEDED')
 const supportIds=new Set<string>(),contentIds=new Set<string>()
 for(const s of op.supportCases){
  if(!s||!identifier(s.caseRef)||!identifier(s.evidenceRef)||
    !['ROUTINE','COMPLAINT','REFUND','SAFETY'].includes(s.severity)||
    supportIds.has(s.caseRef))throw Error('BIZ_PURSE_AUTOMATION_SUPPORT_INVALID')
  supportIds.add(s.caseRef)
  if(!input.ownerStopRequested)tasks.push(task(s.severity==='ROUTINE'?'REVIEW_SUPPORT_REPLY':'ESCALATE_SUPPORT',
   s.caseRef,input.asOf,s.severity==='ROUTINE'?'Draft FAQ response for owner review; no unverified policy answers.':
    'Escalate complaint, refund or safety issue to an authorized human.'))
 }
 for(const c of op.contentDrafts){
  if(!c||!identifier(c.assetRef)||typeof c.brandReviewed!=='boolean'||
    typeof c.usageRightsVerified!=='boolean'||contentIds.has(c.assetRef))
   throw Error('BIZ_PURSE_AUTOMATION_CONTENT_INVALID')
  contentIds.add(c.assetRef)
  if(!input.ownerStopRequested)tasks.push(task('REVIEW_CONTENT',c.assetRef,input.asOf,
   !c.usageRightsVerified?'Rights or licensing evidence missing; do not publish.':
    !c.brandReviewed?'Brand and factual claims need editorial review.':
    'Editorially reviewed draft; scheduling/publishing still requires separate approval.'))
 }
 if(op.cashSnapshot){
  const c=op.cashSnapshot
  if(!validTime(c.asOf)||time(c.asOf)>now||typeof c.externalCustodyVerified!=='boolean'||
    !Number.isSafeInteger(c.unresolvedExceptions)||c.unresolvedExceptions<0)
   throw Error('BIZ_PURSE_AUTOMATION_FINANCE_INVALID')
  if(!input.ownerStopRequested)tasks.push(task('REVIEW_DAILY_CASH','cash:'+input.businessId,input.asOf,
   'Review reconciled cash, fees, taxes, refunds and exceptions; do not recognize synthetic receipts or initiate transfers.'))
 }
 tasks.sort((a,b)=>a.kind.localeCompare(b.kind)||a.subjectRef.localeCompare(b.subjectRef)||a.dueAt.localeCompare(b.dueAt))
 return Object.freeze({
  status:input.ownerStopRequested?'BLOCKED_OWNER_STOP' as const:'INTERNAL_DRAFT_ONLY' as const,
  ownerUserId:input.ownerUserId,businessId:input.businessId,asOf:input.asOf,
  candidateCount:input.leads.length,suppressedLeadCount:suppressed,qualifyingLeadCount:qualified,
  followUpDraftCount:input.ownerStopRequested?0:followupDrafts,
  tasks:Object.freeze(input.ownerStopRequested?[]:tasks),
  blockers:Object.freeze(input.ownerStopRequested?['OWNER_STOP_ACTIVE','NOT_EXTERNALLY_COMMISSIONED']:
   ['NOT_EXTERNALLY_COMMISSIONED','CHANNEL_COMPLIANCE_AND_OPT_OUT_NOT_VERIFIED',
    'CRM_AND_PAYMENT_TRUST_ROOT_NOT_CONNECTED','CONTENT_AND_FINANCE_READBACK_REQUIRED']),
  evidenceDigest:hash({ownerUserId:input.ownerUserId,businessId:input.businessId,asOf:input.asOf,
   leads:[...input.leads].sort((a,b)=>a.leadRef.localeCompare(b.leadRef)),
   operations:op}),
  authority:'AUTOMATION_PLAYBOOK_RESEARCH_ONLY' as const,
  verifiedRevenueMinor:0 as const,canSend:false as const,canCall:false as const,
  canPublish:false as const,canCharge:false as const,canMoveMoney:false as const,
  canPurchaseSoftware:false as const,canTreatClaimsAsROI:false as const,
 })
}
