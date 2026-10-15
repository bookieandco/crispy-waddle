import type {StripeSandboxReview} from './biz-purse-stripe-sandbox.js'
/** BIZ-PURSE.24: simulated payment -> journal -> delivery canary review. */
export function reviewClientCaptureSandboxCanary(input:Readonly<{
 ownerUserId:string;orderId:string;testPayment:StripeSandboxReview;
 journalOwnerUserId:string;journalOrderId:string;durableTestReadback:boolean;
 syntheticDeliveryAccepted:boolean;testRefund?:StripeSandboxReview
}>){
 const reasons:string[]=[]
 if(!input.ownerUserId||!input.orderId||input.testPayment.ownerUserId!==input.ownerUserId||
  input.testPayment.orderId!==input.orderId||input.journalOwnerUserId!==input.ownerUserId||
  input.journalOrderId!==input.orderId)reasons.push('OWNER_ORDER_BINDING_MISMATCH')
 if(input.testPayment.status!=='TEST_PAYMENT_OBSERVED'||input.testPayment.authority!=='STRIPE_TEST_EVIDENCE_REVIEW_ONLY')
  reasons.push('STRIPE_SANDBOX_PAYMENT_NOT_VERIFIED')
 if(!input.durableTestReadback)reasons.push('JOURNAL_TEST_READBACK_REQUIRED')
 if(!input.syntheticDeliveryAccepted)reasons.push('SYNTHETIC_ACCEPTANCE_MISSING')
 if(input.testRefund &&(input.testRefund.status!=='TEST_REFUND_OBSERVED'||
  input.testRefund.orderId!==input.orderId||input.testRefund.ownerUserId!==input.ownerUserId))
  reasons.push('SANDBOX_REFUND_MISMATCH')
 return Object.freeze({status:reasons.length?'BLOCKED' as const:'SANDBOX_CANARY_REVIEW_ONLY' as const,
  ownerUserId:input.ownerUserId,orderId:input.orderId,reasons:Object.freeze(reasons),
  authority:'NO_LIVE_PAYMENT_CERTIFICATION' as const,
  canCharge:false as const,canPublish:false as const,canDeliverRealOrder:false as const,
  canRecognizeRevenue:false as const,canMoveMoney:false as const})
}
