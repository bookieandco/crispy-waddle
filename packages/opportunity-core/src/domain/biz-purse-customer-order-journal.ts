/**
 * BIZ-PURSE.05/.06: replay-safe commercial order journal projection.
 * Provider observations are ONLY evidence to review: no payment, fulfillment,
 * cash transfer, or customer communication authority is granted here.
 * Durable uniqueness/fencing must be independently proven at the DB boundary.
 */
import {createHash} from 'node:crypto'
export type BusinessOrderJournalEvent=Readonly<{
  eventId:string
  sequence:number
  ownerUserId:string
  orderId:string
  kind:'ORDER_CREATED'|'PROVIDER_UNKNOWN'|'PAYMENT_SETTLED'|'PAYMENT_REFUNDED'|'DELIVERY_ACCEPTED'
  observedAt:string
  evidenceId:string
  providerPaymentId?:string
  providerReadbackVerified?:boolean
  providerSignatureVerified?:boolean
  amountMinor?:bigint
  currency?:string
  customerRef?:string
  synthetic?:boolean
}>
export type BusinessOrderJournalProjection=Readonly<{
 orderId:string
 ownerUserId:string
 status:'QUOTE_ONLY'|'UNKNOWN_PAYMENT'|'PAID_UNFULFILLED'|'REFUNDED'|'ACCEPTED'|'BLOCKED'
 grossSettledMinor:bigint
 refundedMinor:bigint
 netSettledMinor:bigint
 customerRef:string
 currency:string
 acceptedEvidenceIds:readonly string[]
 unresolvedReasonCodes:readonly string[]
 reviewDigest:string
 authority:'JOURNAL_PROJECTION_ONLY'
 canCharge:false
 canSendToCustomer:false
 canFulfill:false
 canRecognizeSpendableProfit:false
}>
function digest(event:BusinessOrderJournalEvent):string{
 return createHash('sha256').update(JSON.stringify(event,(_,v)=>typeof v==='bigint'?v.toString():v)).digest('hex')
}
/**
 * input order is causal and append-only. The same sequence and receipt identity
 * can be replayed if byte-equivalent, but conflicts and gaps fail closed.
 */
export function projectBusinessOrderJournal(events:readonly BusinessOrderJournalEvent[]):BusinessOrderJournalProjection{
 if(!events.length)throw new Error('BIZ_PURSE_ORDER_JOURNAL_EMPTY')
 const seen=new Map<string,string>(),reasons:string[]=[],evidence:string[]=[]
 let orderId='',owner='',customer='',currency='',expected=0n,settled=0n,refunded=0n
 let status:BusinessOrderJournalProjection['status']='QUOTE_ONLY'
 let nextSequence=1,accepted=false,unknown=false
 const paymentIds=new Set<string>(),refundedPayments=new Set<string>()
 for(const e of events){
  const fingerprint=digest(e)
  const previous=seen.get(e.eventId)
  if(previous){if(previous!==fingerprint)throw new Error('BIZ_PURSE_ORDER_EVENT_ID_CONFLICT');continue}
  if(!e.eventId||!e.orderId||!e.ownerUserId||!e.evidenceId||!Number.isFinite(Date.parse(e.observedAt)))throw new Error('BIZ_PURSE_ORDER_EVENT_INVALID')
  if(!Number.isInteger(e.sequence)||e.sequence!==nextSequence)throw new Error('BIZ_PURSE_ORDER_JOURNAL_GAP_OR_REORDER')
  if(!orderId&&e.kind!=='ORDER_CREATED')throw new Error('BIZ_PURSE_ORDER_CREATE_REQUIRED')
  if(orderId&&(orderId!==e.orderId||owner!==e.ownerUserId))throw new Error('BIZ_PURSE_ORDER_OWNER_CROSSOVER')
  if(e.synthetic===true)reasons.push('SYNTHETIC_ORDER_EVIDENCE')
  seen.set(e.eventId,fingerprint);nextSequence++;evidence.push(e.evidenceId)
  if(e.kind==='ORDER_CREATED'){
   if(orderId)throw new Error('BIZ_PURSE_ORDER_DUPLICATE_CREATE')
   if(!e.customerRef||!e.currency||e.amountMinor===undefined||e.amountMinor<=0n)throw new Error('BIZ_PURSE_ORDER_SCOPE_INVALID')
   orderId=e.orderId;owner=e.ownerUserId;customer=e.customerRef;currency=e.currency;expected=e.amountMinor
   continue
  }
  if(e.kind==='PROVIDER_UNKNOWN'){unknown=true;status='UNKNOWN_PAYMENT';continue}
  if(e.kind==='PAYMENT_SETTLED'){
   if(accepted)reasons.push('LATE_SETTLEMENT_AFTER_ACCEPTANCE')
   if(!e.providerPaymentId||paymentIds.has(e.providerPaymentId))throw new Error('BIZ_PURSE_DUPLICATE_SETTLEMENT_ID')
   if(e.providerReadbackVerified!==true||e.providerSignatureVerified!==true)reasons.push('PROVIDER_SETTLEMENT_UNVERIFIED')
   if(e.amountMinor!==expected||e.currency!==currency)reasons.push('PROVIDER_PAYMENT_AMOUNT_MISMATCH')
   paymentIds.add(e.providerPaymentId);settled+=e.amountMinor??0n;unknown=false
   status='PAID_UNFULFILLED'
   continue
  }
  if(e.kind==='PAYMENT_REFUNDED'){
   if(!e.providerPaymentId||!paymentIds.has(e.providerPaymentId)||refundedPayments.has(e.providerPaymentId))throw new Error('BIZ_PURSE_REFUND_NOT_BOUND_TO_SETTLEMENT')
   if(e.providerReadbackVerified!==true||e.providerSignatureVerified!==true)reasons.push('PROVIDER_REFUND_UNVERIFIED')
   if(e.amountMinor===undefined||e.amountMinor<=0n||refunded+e.amountMinor>settled)throw new Error('BIZ_PURSE_REFUND_AMOUNT_INVALID')
   refundedPayments.add(e.providerPaymentId);refunded+=e.amountMinor
   if(settled-refunded<expected)status='REFUNDED'
   if(accepted)reasons.push('REFUND_AFTER_ACCEPTANCE_REQUIRES_REVERSAL')
   continue
  }
  if(e.kind==='DELIVERY_ACCEPTED'){
   if(e.customerRef!==customer||!e.customerRef)reasons.push('CUSTOMER_ACCEPTANCE_IDENTITY_MISMATCH')
   if(unknown||settled-refunded<expected||status==='REFUNDED')reasons.push('ACCEPTANCE_WITHOUT_UNREVERSED_SETTLEMENT')
   if(accepted)throw new Error('BIZ_PURSE_DUPLICATE_CUSTOMER_ACCEPTANCE')
   accepted=true;status='ACCEPTED'
  }
 }
 if(unknown)reasons.push('UNKNOWN_PROVIDER_OUTCOME_REQUIRES_RECONCILIATION')
 if(settled-refunded>expected)reasons.push('OVERPAYMENT_REQUIRES_RECONCILIATION')
 const net=settled-refunded
 if(reasons.length)status='BLOCKED'
 return Object.freeze({
  orderId,ownerUserId:owner,status,grossSettledMinor:settled,refundedMinor:refunded,netSettledMinor:net,
  customerRef:customer,currency,acceptedEvidenceIds:Object.freeze([...evidence]),
  unresolvedReasonCodes:Object.freeze([...new Set(reasons)]),
  reviewDigest:createHash('sha256').update([...seen.values()].join(':')).digest('hex'),
  authority:'JOURNAL_PROJECTION_ONLY' as const,
  canCharge:false as const,canSendToCustomer:false as const,
  canFulfill:false as const,canRecognizeSpendableProfit:false as const,
 })
}
