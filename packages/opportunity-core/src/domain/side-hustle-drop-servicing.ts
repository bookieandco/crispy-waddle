import type {CommercialWorkOrder} from './side-hustle-commercial.js'
import type {OpportunityOutcome} from './outcome.js'

export type DropServicingProviderQuote={
  id:string
  opportunityId:string
  workOrderId:string
  family:'drop_servicing'
  providerRef:string
  scopeItemIds:string[]
  amount:number
  currency:string
  slaDueAt:string
  revisionsIncluded:number
  validUntil?:string
  evidenceRefs:string[]
  observedAt:string
  authority:'PROVIDER_QUOTE_EVIDENCE_ONLY'
  pricingCommitmentAuthorized:false
  assignmentAuthorized:false
  paymentAuthorized:false
}

export type DropServicingProviderAssignment={
  id:string
  opportunityId:string
  workOrderId:string
  family:'drop_servicing'
  quoteId:string
  providerRef:string
  scopeItemIds:string[]
  agreedAmount:number
  currency:string
  slaDueAt:string
  evidenceRefs:string[]
  plannedAt:string
  authority:'PROVIDER_ASSIGNMENT_PLAN_ONLY'
  assignmentAuthorized:false
  externalActionAuthorized:false
  paymentAuthorized:false
}

export type DropServicingIssueKind='dispute'|'rework'

export type DropServicingIssueReceipt={
  id:string
  opportunityId:string
  workOrderId:string
  family:'drop_servicing'
  assignmentId:string
  providerRef:string
  kind:DropServicingIssueKind
  deliveryRef?:string
  issue:string
  requestedResolution:string
  evidenceRefs:string[]
  observedAt:string
  authority:'PROVIDER_ISSUE_EVIDENCE_ONLY'
  externalActionAuthorized:false
  paymentAuthorized:false
}

export type DropServicingMarginModel={
  workOrderId:string
  opportunityId:string
  customerRevenue:number
  providerCost:number
  otherDirectCosts:number
  fees:number
  grossMargin:number
  grossMarginPct?:number
  currency:string
  providerAssignmentIds:string[]
  evidenceRefs:string[]
  authority:'COMMERCIAL_ANALYSIS_ONLY'
  paymentAuthorized:false
  moneyMovementAuthorized:false
}

export type DropServicingRecord=
  |DropServicingProviderQuote
  |DropServicingProviderAssignment
  |DropServicingIssueReceipt
  |DropServicingMarginModel

export type DropServicingRecordKind=
  |'provider_quote'
  |'provider_assignment'
  |'provider_issue'
  |'margin_model'

export function recordDropServicingProviderQuote(input:{
  workOrder:CommercialWorkOrder
  id:string
  providerRef:string
  scopeItemIds:string[]
  amount:number
  currency:string
  slaDueAt:string
  revisionsIncluded:number
  validUntil?:string
  evidenceRefs:string[]
  observedAt:string
}):DropServicingProviderQuote{
  requireDropServicing(input.workOrder)
  if(!['scope_locked','delivery_in_progress'].includes(input.workOrder.status)){
    throw new Error('Drop Servicing provider quote requires locked scope')
  }
  requireText(input.id,'quote.id')
  requireText(input.providerRef,'quote.providerRef')
  const scopeItemIds=validateScope(input.workOrder,input.scopeItemIds)
  validateMoney(input.amount,input.currency,'quote')
  requireDate(input.slaDueAt,'quote.slaDueAt')
  requireDate(input.observedAt,'quote.observedAt')
  if(Date.parse(input.slaDueAt)<=Date.parse(input.observedAt))throw new Error('Quote SLA must be in the future')
  if(!Number.isInteger(input.revisionsIncluded)||input.revisionsIncluded<0)throw new Error('quote.revisionsIncluded must be a non-negative integer')
  if(input.validUntil){
    requireDate(input.validUntil,'quote.validUntil')
    if(Date.parse(input.validUntil)<=Date.parse(input.observedAt))throw new Error('quote.validUntil must follow observation')
  }
  return{
    id:input.id.trim(),opportunityId:input.workOrder.opportunityId,workOrderId:input.workOrder.id,
    family:'drop_servicing',providerRef:input.providerRef.trim(),scopeItemIds,
    amount:roundMoney(input.amount),currency:input.currency.trim().toUpperCase(),
    slaDueAt:input.slaDueAt,revisionsIncluded:input.revisionsIncluded,validUntil:input.validUntil,
    evidenceRefs:requireEvidence(input.evidenceRefs,'provider quote'),observedAt:input.observedAt,
    authority:'PROVIDER_QUOTE_EVIDENCE_ONLY',pricingCommitmentAuthorized:false,
    assignmentAuthorized:false,paymentAuthorized:false,
  }
}

export function planDropServicingProviderAssignment(input:{
  workOrder:CommercialWorkOrder
  quote:DropServicingProviderQuote
  id:string
  evidenceRefs:string[]
  plannedAt:string
}):DropServicingProviderAssignment{
  requireDropServicing(input.workOrder)
  if(input.quote.workOrderId!==input.workOrder.id)throw new Error('Provider quote does not match work order')
  if(input.quote.validUntil&&Date.parse(input.quote.validUntil)<=Date.parse(input.plannedAt))throw new Error('Provider quote is expired')
  requireText(input.id,'assignment.id')
  requireDate(input.plannedAt,'assignment.plannedAt')
  return{
    id:input.id.trim(),opportunityId:input.workOrder.opportunityId,workOrderId:input.workOrder.id,
    family:'drop_servicing',quoteId:input.quote.id,providerRef:input.quote.providerRef,
    scopeItemIds:[...input.quote.scopeItemIds],agreedAmount:input.quote.amount,currency:input.quote.currency,
    slaDueAt:input.quote.slaDueAt,
    evidenceRefs:unique([...input.quote.evidenceRefs,...requireEvidence(input.evidenceRefs,'provider assignment')]),
    plannedAt:input.plannedAt,authority:'PROVIDER_ASSIGNMENT_PLAN_ONLY',
    assignmentAuthorized:false,externalActionAuthorized:false,paymentAuthorized:false,
  }
}

export function recordDropServicingIssue(input:{
  workOrder:CommercialWorkOrder
  assignment:DropServicingProviderAssignment
  id:string
  kind:DropServicingIssueKind
  deliveryRef?:string
  issue:string
  requestedResolution:string
  evidenceRefs:string[]
  observedAt:string
}):DropServicingIssueReceipt{
  requireDropServicing(input.workOrder)
  if(input.assignment.workOrderId!==input.workOrder.id)throw new Error('Provider assignment does not match work order')
  requireText(input.id,'issue.id')
  requireText(input.issue,'issue.issue')
  requireText(input.requestedResolution,'issue.requestedResolution')
  requireDate(input.observedAt,'issue.observedAt')
  return{
    id:input.id.trim(),opportunityId:input.workOrder.opportunityId,workOrderId:input.workOrder.id,
    family:'drop_servicing',assignmentId:input.assignment.id,providerRef:input.assignment.providerRef,
    kind:input.kind,deliveryRef:input.deliveryRef?.trim()||undefined,issue:input.issue.trim(),
    requestedResolution:input.requestedResolution.trim(),evidenceRefs:requireEvidence(input.evidenceRefs,'provider issue'),
    observedAt:input.observedAt,authority:'PROVIDER_ISSUE_EVIDENCE_ONLY',
    externalActionAuthorized:false,paymentAuthorized:false,
  }
}

export function buildDropServicingMarginModel(input:{
  workOrder:CommercialWorkOrder
  assignments:DropServicingProviderAssignment[]
  outcome:OpportunityOutcome
  evidenceRefs:string[]
}):DropServicingMarginModel{
  requireDropServicing(input.workOrder)
  if(input.outcome.opportunityId!==input.workOrder.opportunityId)throw new Error('Outcome does not match work order opportunity')
  if(input.assignments.some(a=>a.workOrderId!==input.workOrder.id))throw new Error('Provider assignment does not match work order')
  const currencies=unique(input.assignments.map(a=>a.currency))
  if(currencies.length>1|| (currencies.length===1&&currencies[0]!==input.outcome.currency.toUpperCase())){
    throw new Error('Drop Servicing margin model requires one currency')
  }
  const providerCost=roundMoney(input.assignments.reduce((n,a)=>n+a.agreedAmount,0))
  const customerRevenue=roundMoney(input.outcome.grossRevenue-input.outcome.refunds)
  const otherDirectCosts=roundMoney(Math.max(0,input.outcome.directCosts-providerCost))
  const fees=roundMoney(input.outcome.fees)
  const grossMargin=roundMoney(customerRevenue-providerCost-otherDirectCosts-fees)
  return{
    workOrderId:input.workOrder.id,opportunityId:input.workOrder.opportunityId,
    customerRevenue,providerCost,otherDirectCosts,fees,grossMargin,
    grossMarginPct:customerRevenue>0?Math.round((grossMargin/customerRevenue)*10000)/100:undefined,
    currency:input.outcome.currency.toUpperCase(),providerAssignmentIds:input.assignments.map(a=>a.id),
    evidenceRefs:unique([...input.outcome.evidenceRefs,...input.evidenceRefs,...input.assignments.flatMap(a=>a.evidenceRefs)]),
    authority:'COMMERCIAL_ANALYSIS_ONLY',paymentAuthorized:false,moneyMovementAuthorized:false,
  }
}

export function dropServicingRecordKind(record:DropServicingRecord):DropServicingRecordKind{
  if('pricingCommitmentAuthorized'in record)return'provider_quote'
  if('quoteId'in record)return'provider_assignment'
  if('requestedResolution'in record)return'provider_issue'
  return'margin_model'
}

function requireDropServicing(workOrder:CommercialWorkOrder){
  if(workOrder.family!=='drop_servicing')throw new Error('Drop Servicing runtime requires drop_servicing work order')
}
function validateScope(workOrder:CommercialWorkOrder,scopeItemIds:string[]){
  const ids=unique(scopeItemIds);if(!ids.length)throw new Error('Provider quote requires scope items')
  const valid=new Set(workOrder.scopeItems.map(x=>x.id))
  const bad=ids.filter(id=>!valid.has(id));if(bad.length)throw new Error('Provider quote contains unknown scope items')
  return ids
}
function validateMoney(amount:number,currency:string,label:string){
  if(!Number.isFinite(amount)||amount<0)throw new Error(`${label} amount must be non-negative`)
  requireText(currency,`${label}.currency`)
}
function requireText(value:string,field:string){if(typeof value!=='string'||!value.trim())throw new Error(`${field} is required`);return value.trim()}
function requireDate(value:string,field:string){if(!Number.isFinite(Date.parse(value)))throw new Error(`${field} must be a valid date`);return value}
function requireEvidence(values:readonly string[],field:string){const out=unique(values);if(!out.length)throw new Error(`${field} evidence is required`);return out}
function unique(values:readonly string[]){return[...new Set(values.map(v=>v.trim()).filter(Boolean))]}
function roundMoney(value:number){return Math.round(value*100)/100}
