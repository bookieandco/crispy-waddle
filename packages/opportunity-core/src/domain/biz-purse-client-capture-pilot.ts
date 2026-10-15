import {createHash} from 'node:crypto'
import type {Opportunity} from './opportunity.js'
import {buildClientCaptureStudioDraft} from './biz-purse-client-capture.js'
import {
 createCommercialWorkOrder,lockCommercialWorkOrderScope,recordCommercialDeliveryStart,
 recordCommercialDelivery,recordCommercialAcceptance,
 type CommercialWorkOrderStatus,
} from './side-hustle-commercial.js'

export type ClientCapturePilotObservation=Readonly<{
 caseId:string
 stage:'INQUIRY'|'FIRST_RESPONSE'|'QUALIFIED'|'HANDOFF'|'EXCEPTION'
 occurredAt:string
 evidenceRef:string
}>
export type ClientCaptureAuditFinding=Readonly<{
 code:'RESPONSE_LATE'|'RESPONSE_MISSING'|'HANDOFF_MISSING'|'EXCEPTION_OPEN'|'BASELINE_LIMITED'
 affectedCases:number
 evidenceRefs:readonly string[]
 recommendation:string
}>
export type ClientCaptureAuditReport=Readonly<{
 reportId:string
 ownerUserId:string
 workOrderId:string
 periodStart:string
 periodEnd:string
 inquiryCount:number
 responsesObserved:number
 responsesOnTime:number
 handoffsObserved:number
 openExceptionCount:number
 targetResponseMinutes:number
 measuredResponseMinutes:readonly number[]
 findings:readonly ClientCaptureAuditFinding[]
 evidenceRefs:readonly string[]
 observedSource:'OWNER_SUPPLIED_SYNTHETIC_FIXTURE'
 generatedAt:string
 synthetic:true
 actualResultsVerified:false
 externalPublicationAuthorized:false
}>
export type ClientCapturePilotOutput=Readonly<{
 mode:'SYNTHETIC_REHEARSAL_ONLY'
 authority:'INTERNAL_PILOT_EVIDENCE_ONLY'
 ownerUserId:string
 customerRef:string
 opportunityId:string
 workOrderId:string
 quotedPriceUsd:99
 report:ClientCaptureAuditReport
 simulatedWorkOrderStages:readonly CommercialWorkOrderStatus[]
 simulatedDeliveryReceiptId:string|null
 simulatedAcceptanceDecision:'accepted'|'revision_required'|null
 simulatedAcceptanceReceiptId:string|null
 blockers:readonly string[]
 canCharge:false
 canDeliverToCustomer:false
 canRecordRealCustomerAcceptance:false
 canRecognizeRevenue:false
 canPublish:false
 canMoveMoney:false
}>
export type ClientCapturePilotInput=Readonly<{
 mode:'SYNTHETIC_REHEARSAL_ONLY'
 syntheticFixtureConfirmed:true
 ownerUserId:string
 customerRef:string
 workOrderId:string
 opportunity:Opportunity
 createdAt:string
 evaluatedAt:string
 targetResponseMinutes:number
 observations:readonly ClientCapturePilotObservation[]
 simulatedCustomerDecision:'accepted'|'revision_required'|'none'
}>
const text=(s:unknown):s is string=>typeof s==='string'&&s.length>0&&s.length<257&&s.trim()===s
const timestamp=(s:string)=>Number.isFinite(Date.parse(s))
const sha=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex')

/**
 * The input intentionally has no free-form lead names, emails, phone numbers,
 * addresses or message bodies. Only synthetic case IDs + evidence references.
 * This is a deterministic report generator, NOT a new AI executor.
 */
export function prepareClientCapturePilotReport(input:ClientCapturePilotInput):ClientCaptureAuditReport{
 if(input.mode!=='SYNTHETIC_REHEARSAL_ONLY'||input.syntheticFixtureConfirmed!==true)
  throw new Error('BIZ_PURSE_17_REAL_CUSTOMER_PIPELINE_NOT_COMMISSIONED')
 if(!text(input.ownerUserId)||!text(input.customerRef)||!text(input.workOrderId)||
    !timestamp(input.createdAt)||!timestamp(input.evaluatedAt)||
    Date.parse(input.evaluatedAt)<Date.parse(input.createdAt))
  throw new Error('BIZ_PURSE_17_IDENTITY_OR_TIME_INVALID')
 if(!Number.isInteger(input.targetResponseMinutes)||input.targetResponseMinutes<1||
    input.targetResponseMinutes>1440)
  throw new Error('BIZ_PURSE_17_RESPONSE_TARGET_INVALID')
 if(!Array.isArray(input.observations)||input.observations.length<1||
    input.observations.length>500)
  throw new Error('BIZ_PURSE_17_OBSERVATIONS_REQUIRED')
 const cases=new Map<string,Partial<Record<ClientCapturePilotObservation['stage'],ClientCapturePilotObservation>>>()
 const evidenceRefs=new Set<string>(),seen=new Set<string>()
 for(const observation of input.observations){
  if(!observation||!text(observation.caseId)||!text(observation.evidenceRef)||
      !observation.evidenceRef.startsWith('fixture:')||
      !timestamp(observation.occurredAt)||
      Date.parse(observation.occurredAt)<Date.parse(input.createdAt)||
      Date.parse(observation.occurredAt)>Date.parse(input.evaluatedAt)||
      !['INQUIRY','FIRST_RESPONSE','QUALIFIED','HANDOFF','EXCEPTION'].includes(observation.stage))
   throw new Error('BIZ_PURSE_17_OBSERVATION_INVALID_OR_UNVERIFIED')
  const key=observation.caseId+':'+observation.stage
  if(seen.has(key)||evidenceRefs.has(observation.evidenceRef))
   throw new Error('BIZ_PURSE_17_DUPLICATE_OBSERVATION_OR_EVIDENCE')
  seen.add(key);evidenceRefs.add(observation.evidenceRef)
  const record=cases.get(observation.caseId)||{}
  record[observation.stage]=observation
  cases.set(observation.caseId,record)
 }
 let inquiries=0,responses=0,onTime=0,handoffs=0,openExceptions=0
 const responseMinutes:number[]=[]
 const affected:Record<ClientCaptureAuditFinding['code'],Set<string>>={
  RESPONSE_LATE:new Set(),RESPONSE_MISSING:new Set(),HANDOFF_MISSING:new Set(),
  EXCEPTION_OPEN:new Set(),BASELINE_LIMITED:new Set(),
 }
 for(const [caseId,record] of cases){
  if(!record.INQUIRY)throw new Error('BIZ_PURSE_17_ORPHANED_STAGE_WITHOUT_INQUIRY')
  const inbound=Date.parse(record.INQUIRY.occurredAt)
  const responded=record.FIRST_RESPONSE?Date.parse(record.FIRST_RESPONSE.occurredAt):null
  const qualified=record.QUALIFIED?Date.parse(record.QUALIFIED.occurredAt):null
  const handoff=record.HANDOFF?Date.parse(record.HANDOFF.occurredAt):null
  const exception=record.EXCEPTION?Date.parse(record.EXCEPTION.occurredAt):null
  if([responded,qualified,handoff,exception].some(v=>v!==null&&v<inbound)||
     (handoff!==null&&(qualified===null||handoff<qualified))||
     (qualified!==null&&(responded===null||qualified<responded)))
   throw new Error('BIZ_PURSE_17_CASE_CHRONOLOGY_INVALID')
  inquiries++
  if(responded===null)affected.RESPONSE_MISSING.add(caseId)
  else{
   responses++
   const minutes=Math.round((responded-inbound)/60000*100)/100
   responseMinutes.push(minutes)
   if(minutes<=input.targetResponseMinutes)onTime++
   else affected.RESPONSE_LATE.add(caseId)
  }
  if(qualified!==null&&handoff===null)affected.HANDOFF_MISSING.add(caseId)
  if(handoff!==null)handoffs++
  if(exception!==null) {openExceptions++;affected.EXCEPTION_OPEN.add(caseId)}
 }
 if(inquiries<3)for(const id of cases.keys())affected.BASELINE_LIMITED.add(id)
 const recommendations:Record<ClientCaptureAuditFinding['code'],string>={
  RESPONSE_LATE:'Review first-response coverage and consented routing; validate a faster response in a later measured test.',
  RESPONSE_MISSING:'Implement an approved inquiry queue and manual fallback for unanswered requests.',
  HANDOFF_MISSING:'Record a verified handoff owner and completion receipt before automating sales follow-up.',
  EXCEPTION_OPEN:'Assign an owner to exceptions and test a safe retry/escalation path.',
  BASELINE_LIMITED:'Collect a larger authorized observation sample before estimating improvement or conversion.',
 }
 const findings=(Object.keys(affected) as ClientCaptureAuditFinding['code'][])
  .filter(code=>affected[code].size>0)
  .map(code=>Object.freeze({code,affectedCases:affected[code].size,
   evidenceRefs:Object.freeze([...cases].filter(([id])=>affected[code].has(id))
    .flatMap(([,r])=>Object.values(r).map(v=>v.evidenceRef)).sort()),
   recommendation:recommendations[code]}))
 const identity={ownerUserId:input.ownerUserId,workOrderId:input.workOrderId,
  observations:[...input.observations].sort((a,b)=>a.caseId.localeCompare(b.caseId)||a.stage.localeCompare(b.stage))}
 return Object.freeze({
  reportId:'client-capture-sim:'+sha(identity),ownerUserId:input.ownerUserId,
  workOrderId:input.workOrderId,periodStart:input.createdAt,periodEnd:input.evaluatedAt,
  inquiryCount:inquiries,responsesObserved:responses,responsesOnTime:onTime,
  handoffsObserved:handoffs,openExceptionCount:openExceptions,
  targetResponseMinutes:input.targetResponseMinutes,
  measuredResponseMinutes:Object.freeze(responseMinutes),
  findings:Object.freeze(findings),evidenceRefs:Object.freeze([...evidenceRefs].sort()),
  observedSource:'OWNER_SUPPLIED_SYNTHETIC_FIXTURE' as const,
  generatedAt:input.evaluatedAt,synthetic:true as const,
  actualResultsVerified:false as const,externalPublicationAuthorized:false as const,
 })
}

/**
 * Exercises the canonical Side Hustle lifecycle in memory. Raw acceptance
 * receipts/work orders are deliberately NOT returned, since the simulated
 * customer decision is never a genuine commercial customer attestation.
 */
export function rehearseClientCaptureStudioPilot(input:ClientCapturePilotInput):ClientCapturePilotOutput{
 const report=prepareClientCapturePilotReport(input)
 if(!['accepted','revision_required','none'].includes(input.simulatedCustomerDecision))
  throw new Error('BIZ_PURSE_17_SIMULATED_DECISION_INVALID')
 const opportunity=input.opportunity
 if(!opportunity||!['ready','approved','pursuing'].includes(opportunity.status))
  throw new Error('BIZ_PURSE_17_CANONICAL_OPPORTUNITY_NOT_REVIEWED')
 const quote=buildClientCaptureStudioDraft({
  opportunity,workOrderId:input.workOrderId,customerRef:input.customerRef,offer:'AUDIT',
  evidenceRefs:report.evidenceRefs,createdAt:input.createdAt,
 })
 const original=createCommercialWorkOrder({...quote.draft,opportunity,createdAt:input.createdAt})
 const stages:CommercialWorkOrderStatus[]=[original.status]
 const locked=lockCommercialWorkOrderScope({workOrder:original,
  evidenceRefs:['fixture:scope:'+input.workOrderId],lockedAt:input.evaluatedAt})
 stages.push(locked.status)
 const owner=locked.executionOwners[0]
 if(!owner)throw new Error('BIZ_PURSE_17_REGISTERED_EXECUTION_OWNER_REQUIRED')
 const start=recordCommercialDeliveryStart({workOrder:locked,
  receiptId:'fixture:start:'+input.workOrderId,executionOwner:owner,
  executionRef:'fixture:execution:'+report.reportId,
  evidenceRefs:report.evidenceRefs.length? [...report.evidenceRefs]:['fixture:source'],
  startedAt:input.evaluatedAt})
 stages.push(start.workOrder.status)
 const delivery=recordCommercialDelivery({workOrder:start.workOrder,startReceipt:start.receipt,
  receiptId:'fixture:delivery:'+input.workOrderId,
  deliveryRef:'fixture:report:'+report.reportId,
  deliverableRefs:['fixture:report:'+report.reportId],
  evidenceRefs:report.evidenceRefs.length? [...report.evidenceRefs]:['fixture:source'],
  deliveredAt:input.evaluatedAt})
 stages.push(delivery.workOrder.status)
 const blockers=['SYNTHETIC_CUSTOMER_AND_AUDIT_EVIDENCE',
  'REAL_PROVIDER_SETTLEMENT_AND_CUSTOMER_ACCEPTANCE_NOT_VERIFIED',
  'SUPABASE_ORDER_JOURNAL_AND_EXTERNAL_DELIVERY_NOT_COMMISSIONED']
 let decision:null|'accepted'|'revision_required'=null,receiptId:string|null=null
 if(input.simulatedCustomerDecision!=='none'){
  const criteria=delivery.workOrder.acceptanceCriteria.filter(c=>c.required).map(c=>c.id)
  const final=recordCommercialAcceptance({workOrder:delivery.workOrder,
   deliveryReceipt:delivery.receipt,receiptId:'fixture:acceptance:'+input.workOrderId,
   customerRef:input.customerRef,decision:input.simulatedCustomerDecision,
   criteriaMet:input.simulatedCustomerDecision==='accepted'?criteria:[],
   criteriaMissed:input.simulatedCustomerDecision==='revision_required'?criteria:[],
   evidenceRefs:['fixture:synthetic-customer-decision:'+input.workOrderId],
   observedAt:input.evaluatedAt})
  stages.push(final.workOrder.status)
  decision=final.receipt.decision as 'accepted'|'revision_required'
  receiptId=final.receipt.id
 }else blockers.push('SIMULATED_CUSTOMER_DECISION_NOT_RECORDED')
 return Object.freeze({
  mode:'SYNTHETIC_REHEARSAL_ONLY' as const,authority:'INTERNAL_PILOT_EVIDENCE_ONLY' as const,
  ownerUserId:input.ownerUserId,customerRef:input.customerRef,
  opportunityId:opportunity.id,workOrderId:original.id,quotedPriceUsd:99 as const,
  report,simulatedWorkOrderStages:Object.freeze(stages),
  simulatedDeliveryReceiptId:delivery.receipt.id,
  simulatedAcceptanceDecision:decision,simulatedAcceptanceReceiptId:receiptId,
  blockers:Object.freeze(blockers),
  canCharge:false as const,canDeliverToCustomer:false as const,
  canRecordRealCustomerAcceptance:false as const,canRecognizeRevenue:false as const,
  canPublish:false as const,canMoveMoney:false as const,
 })
}
