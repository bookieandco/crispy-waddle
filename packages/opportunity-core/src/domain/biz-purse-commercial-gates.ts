/** BIZ-PURSE.03/.05/.06 — observational admission gates, not provider authority. */
export type BusinessEvidenceRef=Readonly<{
 id:string
 sourceUrl:string
 observedAt:string
 independentlyObserved:boolean
 synthetic:boolean
}>
export type BusinessGateResult=Readonly<{
 status:'BLOCKED'|'REVIEW_READY'
 reasons:readonly string[]
 evidenceIds:readonly string[]
 externalActionAuthorized:false
 paymentAuthorized:false
 fulfillmentAuthorized:false
 moneyMovementAuthorized:false
 authority:'EVIDENCE_REVIEW_ONLY'
}>
function validateTime(value:string):number{
 const parsed=Date.parse(value)
 if(!Number.isFinite(parsed))throw new Error('BIZ_PURSE_TIMESTAMP_INVALID')
 return parsed
}
function gate(reasons:string[], evidence:readonly string[]):BusinessGateResult {
 return Object.freeze({status:reasons.length?'BLOCKED':'REVIEW_READY',reasons:Object.freeze([...new Set(reasons)]),
   evidenceIds:Object.freeze([...new Set(evidence)]),externalActionAuthorized:false as const,
   paymentAuthorized:false as const,fulfillmentAuthorized:false as const,
   moneyMovementAuthorized:false as const,authority:'EVIDENCE_REVIEW_ONLY' as const})
}
function verifyEvidence(items:readonly BusinessEvidenceRef[],asOf:string,maximumAgeMs:number):string[]{
 const reasons:string[]=[]
 const at=validateTime(asOf)
 if(!items.length)reasons.push('SOURCE_EVIDENCE_MISSING')
 if(new Set(items.map(x=>x.id)).size!==items.length)reasons.push('EVIDENCE_DUPLICATE_ID')
 for(const e of items){
  if(!e.id?.trim()||!/^https:\/\//.test(e.sourceUrl))reasons.push('EVIDENCE_PROVENANCE_INVALID')
  const stamp=validateTime(e.observedAt)
  if(stamp>at)reasons.push('EVIDENCE_FROM_FUTURE')
  if(at-stamp>maximumAgeMs)reasons.push('EVIDENCE_STALE')
  if(!e.independentlyObserved||e.synthetic)reasons.push('UNVERIFIED_OR_SYNTHETIC_EVIDENCE')
 }
 return reasons
}
export function assessVentureScoutResearch(input:Readonly<{
 family:string
 approvedFamily:string
 observedAt:string
 evidence:readonly BusinessEvidenceRef[]
 maxAgeDays:number
 distinctSourcesRequired:number
}>):BusinessGateResult{
 if(!Number.isInteger(input.maxAgeDays)||input.maxAgeDays<1||input.maxAgeDays>90||!Number.isInteger(input.distinctSourcesRequired)||input.distinctSourcesRequired<1)throw new Error('BIZ_PURSE_SCOUT_LIMIT_INVALID')
 const reasons=verifyEvidence(input.evidence,input.observedAt,input.maxAgeDays*86400000)
 if(!input.family||input.family!==input.approvedFamily)reasons.push('BUSINESS_FAMILY_NOT_APPROVED')
 const domains=new Set<string>()
 for(const x of input.evidence){try { const url=new URL(x.sourceUrl);if(url.protocol==='https:')domains.add(url.hostname.toLowerCase()) } catch { reasons.push('EVIDENCE_PROVENANCE_INVALID') }}
 if(domains.size<input.distinctSourcesRequired)reasons.push('INSUFFICIENT_INDEPENDENT_SOURCE_DOMAINS')
 return gate(reasons,input.evidence.map(x=>x.id))
}
export type BusinessPaymentObservation=Readonly<{
 orderId:string
 ownerUserId:string
 providerAccountOwnerId:string
 paymentOrderId:string
 providerPaymentId:string
 amountMinor:bigint
 expectedAmountMinor:bigint
 currency:string
 expectedCurrency:string
 providerState:'SETTLED'|'PENDING'|'FAILED'|'REFUNDED'|'UNKNOWN'
 providerReadbackVerified:boolean
 webhookSignatureVerified:boolean
 providerReceiptId:string
 synthetic:boolean
 observedAt:string
 asOf:string
}>
export function assessCommercialPayment(input:BusinessPaymentObservation):BusinessGateResult{
 const reasons:string[]=[]
 const at=validateTime(input.asOf), observed=validateTime(input.observedAt)
 if(observed>at||at-observed>86400000)reasons.push('PAYMENT_OBSERVATION_STALE_OR_FUTURE')
 if(!input.orderId||!input.providerPaymentId||!input.providerReceiptId)reasons.push('PAYMENT_IDENTITY_MISSING')
 if(!input.ownerUserId||input.providerAccountOwnerId!==input.ownerUserId)reasons.push('PAYMENT_OWNER_MISMATCH')
 if(input.paymentOrderId!==input.orderId)reasons.push('PAYMENT_ORDER_MISMATCH')
 if(input.amountMinor<=0n||input.amountMinor!==input.expectedAmountMinor||input.currency!==input.expectedCurrency)reasons.push('PAYMENT_AMOUNT_CURRENCY_MISMATCH')
 if(input.providerState!=='SETTLED')reasons.push('PAYMENT_NOT_SETTLED')
 if(!input.providerReadbackVerified||!input.webhookSignatureVerified||input.synthetic)reasons.push('PAYMENT_NOT_INDEPENDENTLY_VERIFIED')
 return gate(reasons,input.providerReceiptId?[input.providerReceiptId]:[])
}
export function assessCommercialDelivery(input:Readonly<{
 orderId:string
 workOrderId:string
 orderOwnerId:string
 workOrderOwnerId:string
 workOrderStatus:'draft'|'scope_locked'|'delivery_in_progress'|'delivered'|'accepted'|'cancelled'
 payment:BusinessGateResult
 deliveryReceipt?:BusinessEvidenceRef
 acceptanceReceipt?:BusinessEvidenceRef
 asOf:string
}>):BusinessGateResult{
 const reasons:string[]=[]
 if(!input.orderId||input.orderId!==input.workOrderId)reasons.push('ORDER_WORK_ORDER_IDENTITY_MISMATCH')
 if(!input.orderOwnerId||input.orderOwnerId!==input.workOrderOwnerId)reasons.push('WORK_ORDER_OWNER_MISMATCH')
 if(input.payment.status!=='REVIEW_READY')reasons.push('PAYMENT_NOT_ADMITTED')
 if(input.workOrderStatus!=='accepted')reasons.push('CUSTOMER_ACCEPTANCE_NOT_RECORDED')
 if(!input.deliveryReceipt||!input.acceptanceReceipt)reasons.push('DELIVERY_AND_ACCEPTANCE_RECEIPTS_REQUIRED')
 const evidences=[input.deliveryReceipt,input.acceptanceReceipt].filter((r):r is BusinessEvidenceRef=>r!==undefined)
 reasons.push(...verifyEvidence(evidences,input.asOf,90*86400000))
 if(evidences.length&&new Set(evidences.map(r=>r.id)).size!==evidences.length)reasons.push('DUPLICATE_DELIVERY_EVIDENCE')
 return gate(reasons,evidences.map(e=>e.id))
}
