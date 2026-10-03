import {
  buildDropServicingMarginModel,
  dropServicingRecordKind,
  planDropServicingProviderAssignment,
  recordDropServicingIssue,
  recordDropServicingProviderQuote,
  type CommercialWorkOrder,
  type DropServicingIssueKind,
  type DropServicingMarginModel,
  type DropServicingProviderAssignment,
  type DropServicingProviderQuote,
  type DropServicingRecord,
  type DropServicingRecordKind,
  type OpportunityOutcome,
} from '@jhadina/opportunity-core'
import type {StoredDropServicingRecord} from './supabase-opportunity-repository'

export type DropServicingPersistence={
  getSideHustleCommercialWorkOrder(id:string):Promise<CommercialWorkOrder|undefined>
  getOutcome(id:string):Promise<OpportunityOutcome|undefined>
  getDropServicingRecord(id:string):Promise<StoredDropServicingRecord|undefined>
  listDropServicingRecords(input?:{
    opportunityId?:string
    workOrderId?:string
    kind?:DropServicingRecordKind
  }):Promise<StoredDropServicingRecord[]>
  saveDropServicingRecord(kind:DropServicingRecordKind,record:DropServicingRecord):Promise<DropServicingRecord>
}

export async function recordDropServicingProviderQuoteRuntime(input:{
  workOrderId:string
  id:string
  providerRef:string
  scopeItemIds:string[]
  amount:number
  currency:string
  slaDueAt:string
  revisionsIncluded:number
  validUntil?:string
  evidenceRefs:string[]
  observedAt?:string
},repository:DropServicingPersistence):Promise<DropServicingProviderQuote>{
  const workOrder=await requireWorkOrder(input.workOrderId,repository)
  return saveTyped(recordDropServicingProviderQuote({
    workOrder,id:input.id,providerRef:input.providerRef,scopeItemIds:input.scopeItemIds,
    amount:input.amount,currency:input.currency,slaDueAt:input.slaDueAt,
    revisionsIncluded:input.revisionsIncluded,validUntil:input.validUntil,
    evidenceRefs:input.evidenceRefs,observedAt:input.observedAt??new Date().toISOString(),
  }),repository)
}

export async function planDropServicingProviderAssignmentRuntime(input:{
  workOrderId:string
  quoteId:string
  id:string
  evidenceRefs:string[]
  plannedAt?:string
},repository:DropServicingPersistence):Promise<DropServicingProviderAssignment>{
  const [workOrder,quote]=await Promise.all([
    requireWorkOrder(input.workOrderId,repository),
    requirePayload<DropServicingProviderQuote>(input.quoteId,'provider_quote',repository),
  ])
  return saveTyped(planDropServicingProviderAssignment({
    workOrder,quote,id:input.id,evidenceRefs:input.evidenceRefs,
    plannedAt:input.plannedAt??new Date().toISOString(),
  }),repository)
}

export async function recordDropServicingIssueRuntime(input:{
  workOrderId:string
  assignmentId:string
  id:string
  kind:DropServicingIssueKind
  deliveryRef?:string
  issue:string
  requestedResolution:string
  evidenceRefs:string[]
  observedAt?:string
},repository:DropServicingPersistence){
  const [workOrder,assignment]=await Promise.all([
    requireWorkOrder(input.workOrderId,repository),
    requirePayload<DropServicingProviderAssignment>(input.assignmentId,'provider_assignment',repository),
  ])
  return saveTyped(recordDropServicingIssue({
    workOrder,assignment,id:input.id,kind:input.kind,deliveryRef:input.deliveryRef,
    issue:input.issue,requestedResolution:input.requestedResolution,
    evidenceRefs:input.evidenceRefs,observedAt:input.observedAt??new Date().toISOString(),
  }),repository)
}

export async function buildDropServicingMarginRuntime(input:{
  workOrderId:string
  outcomeId:string
  assignmentIds:string[]
  id:string
  evidenceRefs:string[]
},repository:DropServicingPersistence):Promise<DropServicingMarginModel & {id:string}>{
  const [workOrder,outcome]=await Promise.all([
    requireWorkOrder(input.workOrderId,repository),
    repository.getOutcome(requireText(input.outcomeId,'outcomeId')),
  ])
  if(!outcome)throw new Error('DROP_SERVICING_OUTCOME_NOT_FOUND')
  const assignments=await Promise.all(input.assignmentIds.map(id=>
    requirePayload<DropServicingProviderAssignment>(id,'provider_assignment',repository)
  ))
  const model=buildDropServicingMarginModel({
    workOrder,assignments,outcome,evidenceRefs:input.evidenceRefs,
  })
  const record={id:requireText(input.id,'margin.id'),...model}
  return await repository.saveDropServicingRecord('margin_model',record) as DropServicingMarginModel & {id:string}
}

export async function summarizeDropServicingRuntime(input:{
  workOrderId:string
},repository:DropServicingPersistence){
  const workOrder=await requireWorkOrder(input.workOrderId,repository)
  const records=await repository.listDropServicingRecords({workOrderId:workOrder.id})
  return{
    workOrderId:workOrder.id,
    opportunityId:workOrder.opportunityId,
    quotes:records.filter(r=>r.kind==='provider_quote').length,
    assignmentPlans:records.filter(r=>r.kind==='provider_assignment').length,
    issues:records.filter(r=>r.kind==='provider_issue').length,
    marginModels:records.filter(r=>r.kind==='margin_model').length,
    externalActionAuthorized:false as const,
    assignmentAuthorized:false as const,
    paymentAuthorized:false as const,
    moneyMovementAuthorized:false as const,
  }
}

async function requireWorkOrder(id:string,repository:DropServicingPersistence){
  const workOrder=await repository.getSideHustleCommercialWorkOrder(requireText(id,'workOrderId'))
  if(!workOrder)throw new Error('DROP_SERVICING_WORK_ORDER_NOT_FOUND')
  if(workOrder.family!=='drop_servicing')throw new Error('DROP_SERVICING_WORK_ORDER_FAMILY_MISMATCH')
  return workOrder
}

async function requirePayload<T extends DropServicingRecord>(
  id:string,kind:DropServicingRecordKind,repository:DropServicingPersistence,
):Promise<T>{
  const record=await repository.getDropServicingRecord(requireText(id,'recordId'))
  if(!record)throw new Error('DROP_SERVICING_RECORD_NOT_FOUND')
  if(record.kind!==kind)throw new Error('DROP_SERVICING_RECORD_KIND_MISMATCH')
  return record.payload as T
}

async function saveTyped<T extends DropServicingRecord>(
  record:T,repository:DropServicingPersistence,
):Promise<T>{
  const kind=dropServicingRecordKind(record)
  return await repository.saveDropServicingRecord(kind,record) as T
}

function requireText(value:string,field:string){
  if(typeof value!=='string'||!value.trim())throw new Error(`${field} is required`)
  return value.trim()
}
