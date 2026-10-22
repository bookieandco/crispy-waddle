import {createHash} from 'node:crypto'
import type {CommercialWorkOrder,CommercialDeliveryReceipt,CommercialAcceptanceReceipt} from './side-hustle-commercial.js'

/** An independent evidence *review*, not a new Commerce or Money executor. */
export type BusinessCycleSettlementReview=Readonly<{
 orderId:string
 ownerUserId:string
 customerRef:string
 currency:string
 amountMinor:string
 providerMode:'STRIPE_TEST'|'LIVE'
 providerTransactionId:string
 providerPayoutId:string|null
 moneyCustodyReadbackId:string|null
 observedAt:string
 evidenceRefs:readonly string[]
 authority:'PROVIDER_EVIDENCE_FOR_REVIEW_ONLY'
 canMoveMoney:false
}>
export type FirstBusinessCycleAssessment=Readonly<{
 status:'BLOCKED'|'PAPER_TEST_ONLY'|'INDEPENDENT_REVIEW_REQUIRED'
 businessId:string
 workOrderId:string
 candidateRevenueMinor:string|null
 candidateNetAfterDirectCostsMinor:string|null
 reviewedEvidenceId:string
 blockers:readonly string[]
 authority:'NONPOSTING_FIRST_CYCLE_REVIEW_ONLY'
 verifiedRealizedRevenueMinor:null
 verifiedOwnerPaydayMinor:null
 canRecordRevenue:false
 canRecognizeProfit:false
 canFulfill:false
 canPayOwner:false
 canExecute:false
}>
const valid=(v:unknown):v is string=>typeof v==='string'&&v.trim().length>0
const time=(s:string)=>valid(s)&&Number.isFinite(Date.parse(s))
const minor=(s:string)=>/^(0|[1-9][0-9]{0,20})$/.test(s)
const unique=(a:readonly string[])=>a.length>0&&a.every(valid)&&new Set(a).size===a.length
const digest=(x:unknown)=>createHash('sha256').update(JSON.stringify(x)).digest('hex')

export function reviewFirstBusinessCycle(input:Readonly<{
 ownerUserId:string
 businessId:string
 workOrder:CommercialWorkOrder
 delivery:CommercialDeliveryReceipt
 acceptance:CommercialAcceptanceReceipt
 payment:BusinessCycleSettlementReview
 directCostsMinor:string
 providerFeesMinor:string
 taxAndObligationHoldMinor:string
 operatingReserveMinor:string
 assessedAt:string
}>):FirstBusinessCycleAssessment {
 if(!input||!valid(input.ownerUserId)||!valid(input.businessId)||!time(input.assessedAt))throw Error('PURSE_CYCLE_IDENTITY_OR_TIME_INVALID')
 const {workOrder:w,delivery:d,acceptance:a,payment:p}=input
 if(!w||!d||!a||!p)throw Error('PURSE_CYCLE_EVIDENCE_INCOMPLETE')
 const blockers:string[]=[]
 if(w.authority!=='COMMERCIAL_SCOPE_ONLY'||w.externalActionAuthorized!==false||w.paymentAuthorized!==false||
    !valid(w.id)||!valid(w.opportunityId)||!valid(w.customerRef)||!valid(w.title)||
    w.status!=='accepted'||!unique(w.evidenceRefs)||!time(w.createdAt))
    blockers.push('CANONICAL_ACCEPTED_ORDER_REQUIRED')
 if(d.authority!=='OBSERVATION_ONLY'||d.externalActionAuthorized!==false||
    d.workOrderId!==w.id||d.opportunityId!==w.opportunityId||
    !valid(d.id)||!valid(d.deliveryRef)||!unique(d.evidenceRefs)||!d.deliverableRefs?.length||
    !time(d.deliveredAt))
    blockers.push('DELIVERY_EVIDENCE_MISMATCH')
 if(a.authority!=='CUSTOMER_EVIDENCE_ONLY'||a.externalActionAuthorized!==false||a.paymentAuthorized!==false||
    a.workOrderId!==w.id||a.opportunityId!==w.opportunityId||
    a.customerRef!==w.customerRef||a.deliveryReceiptId!==d.id||
    a.decision!=='accepted'||!valid(a.id)||!unique(a.evidenceRefs)||!time(a.observedAt))
    blockers.push('INDEPENDENT_CUSTOMER_ACCEPTANCE_REQUIRED')
 if(p.authority!=='PROVIDER_EVIDENCE_FOR_REVIEW_ONLY'||p.canMoveMoney!==false||
    p.orderId!==w.id||p.ownerUserId!==input.ownerUserId||p.customerRef!==w.customerRef||
    p.currency!==w.price?.currency||!valid(p.providerTransactionId)||!unique(p.evidenceRefs)||
    !time(p.observedAt)||!minor(p.amountMinor)||p.amountMinor==='0')
    blockers.push('PAYMENT_AND_OWNER_BINDING_MISMATCH')
 if(p.providerMode!=='LIVE')blockers.push('TEST_MODE_IS_NOT_REAL_REVENUE')
 if(!valid(p.providerPayoutId)||!valid(p.moneyCustodyReadbackId)||
    p.providerPayoutId===p.providerTransactionId||p.moneyCustodyReadbackId===p.providerTransactionId||
    p.providerPayoutId===p.moneyCustodyReadbackId)
    blockers.push('INDEPENDENT_PAYOUT_AND_CUSTODY_READBACK_REQUIRED')
 if(![input.directCostsMinor,input.providerFeesMinor,input.taxAndObligationHoldMinor,input.operatingReserveMinor].every(minor))
    throw Error('PURSE_CYCLE_COSTS_INVALID')
 if(!time(d.deliveredAt)||!time(a.observedAt)||!time(p.observedAt)||
    Date.parse(d.deliveredAt)<Date.parse(w.createdAt)||
    Date.parse(a.observedAt)<Date.parse(d.deliveredAt)||
    Date.parse(p.observedAt)>Date.parse(input.assessedAt)||
    Date.parse(a.observedAt)>Date.parse(input.assessedAt))
    blockers.push('CHRONOLOGY_INVALID')
 if(w.price?.currency!=='USD'||p.currency!=='USD'||!Number.isSafeInteger(w.price.amount)||
    w.price.amount<=0||!Number.isSafeInteger(w.price.amount*100)||
    String(Math.round(w.price.amount*100))!==p.amountMinor)
    blockers.push('QUOTED_PRICE_AND_PAYMENT_MISMATCH')
 const ids=[w.id,d.id,a.id,p.providerTransactionId,p.providerPayoutId,p.moneyCustodyReadbackId].filter(valid)
 if(new Set(ids).size!==ids.length)blockers.push('DUPLICATED_ECONOMIC_ID')
 const candidate=minor(p.amountMinor)?BigInt(p.amountMinor):0n
 const expense=BigInt(input.directCostsMinor)+BigInt(input.providerFeesMinor)+
   BigInt(input.taxAndObligationHoldMinor)+BigInt(input.operatingReserveMinor)
 const candidateNet=candidate>expense?candidate-expense:0n
 // A review bundle is untrusted until independent Commerce, provider, customer,
 // and Money custody readbacks. It must NEVER write revenue or authorize payday.
 return Object.freeze({
  status:blockers.length?'BLOCKED':p.providerMode==='STRIPE_TEST'?'PAPER_TEST_ONLY':'INDEPENDENT_REVIEW_REQUIRED',
  businessId:input.businessId,workOrderId:w.id,
  candidateRevenueMinor:blockers.length?null:candidate.toString(),
  candidateNetAfterDirectCostsMinor:blockers.length?null:candidateNet.toString(),
  reviewedEvidenceId:'purse-first-cycle:'+digest({orderId:w.id,deliveryId:d.id,acceptanceId:a.id,
     transactionId:p.providerTransactionId,custodyId:p.moneyCustodyReadbackId,assessedAt:input.assessedAt}),
  blockers:Object.freeze([...new Set(blockers)]),authority:'NONPOSTING_FIRST_CYCLE_REVIEW_ONLY',
  verifiedRealizedRevenueMinor:null,verifiedOwnerPaydayMinor:null,
  canRecordRevenue:false,canRecognizeProfit:false,canFulfill:false,canPayOwner:false,canExecute:false,
 })
}
