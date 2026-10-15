import {createHmac,createHash,timingSafeEqual} from 'node:crypto'

/** BIZ-PURSE.16: Stripe test-mode observations ONLY, never financial authority. */
export type StripeSandboxEvent = Readonly<{
  id:string
  type:string
  data:Readonly<{object:Readonly<{id:string;object:string;livemode?:boolean}>}>
  livemode:false
  created:number
}>
export type VerifiedStripeSandboxWebhook=Readonly<{
  eventId:string
  type:string
  objectId:string
  created:number
  rawBodySha256:string
  authority:'SIGNED_TEST_EVENT_ONLY'
}>
export type StripeTestReadOnlyPort=Readonly<{
  mode:'STRIPE_TEST_READ_ONLY'
  getCheckoutSession(id:string):Promise<unknown>
  getPaymentIntent(id:string):Promise<unknown>
  getRefund(id:string):Promise<unknown>
}>
export type StripeSandboxOrderBinding=Readonly<{
  ownerUserId:string
  orderId:string
  customerRef:string
  sessionId:string
  paymentIntentId:string
  expectedAmountMinor:bigint
  currency:'USD'
}>
export type StripeSandboxReview=Readonly<{
  status:'TEST_PAYMENT_OBSERVED'|'TEST_REFUND_OBSERVED'|'BLOCKED'|'IGNORED'
  webhookEventId:string|null
  orderId:string
  ownerUserId:string
  providerSessionId:string
  providerPaymentIntentId:string
  providerRefundId:string|null
  observedAmountMinor:string|null
  proposedJournalKind:'PAYMENT_SETTLED'|'PAYMENT_REFUNDED'|null
  reasons:readonly string[]
  authority:'STRIPE_TEST_EVIDENCE_REVIEW_ONLY'
  canCharge:false
  canRefund:false
  canAppendJournal:false
  canFulfill:false
  canRecognizeCash:false
  canPayOwner:false
  canTrade:false
}>
const allowed=new Set(['checkout.session.completed','checkout.session.async_payment_succeeded','refund.created','refund.updated'])
const text=(x:unknown):x is string=>typeof x==='string'&&x.trim().length>0
const obj=(x:unknown):x is Record<string,unknown>=>!!x&&typeof x==='object'&&!Array.isArray(x)
const positive=(x:unknown):x is number=>typeof x==='number'&&Number.isSafeInteger(x)&&x>0
const sha=(x:Buffer)=>createHash('sha256').update(x).digest('hex')

/** The incoming body MUST be raw bytes. Multiple whsec_ secrets support rotation. */
export function verifyStripeTestWebhook(input:Readonly<{
  rawBody:Uint8Array
  stripeSignature:string
  endpointSecrets:readonly string[]
  nowSeconds:number
  toleranceSeconds?:number
}>):VerifiedStripeSandboxWebhook{
 const {rawBody,stripeSignature,endpointSecrets,nowSeconds}=input
 if(!(rawBody instanceof Uint8Array)||!rawBody.byteLength||rawBody.byteLength>262144)
  throw new Error('BIZ_PURSE_16_RAW_BODY_INVALID')
 if(!text(stripeSignature)||!Array.isArray(endpointSecrets)||endpointSecrets.length<1||endpointSecrets.length>3||
   endpointSecrets.some(s=>!text(s)||!s.startsWith('whsec_')))
  throw new Error('BIZ_PURSE_16_SIGNATURE_CONFIGURATION_INVALID')
 const tolerance=input.toleranceSeconds??300
 if(!Number.isSafeInteger(nowSeconds)||nowSeconds<=0||!Number.isSafeInteger(tolerance)||tolerance<1||tolerance>300)
  throw new Error('BIZ_PURSE_16_TIME_CONFIGURATION_INVALID')
 const parts=stripeSignature.split(',').map(part=>part.trim())
 const times=parts.filter(x=>/^t=\d+$/.test(x))
 const sigs=parts.filter(x=>/^v1=[0-9a-f]{64}$/.test(x)).map(x=>x.slice(3))
 if(times.length!==1||!sigs.length||sigs.length>6)throw new Error('BIZ_PURSE_16_SIGNATURE_HEADER_INVALID')
 const timestamp=Number(times[0].slice(2))
 if(!Number.isSafeInteger(timestamp)||timestamp<=0||Math.abs(nowSeconds-timestamp)>tolerance)
  throw new Error('BIZ_PURSE_16_STALE_OR_FUTURE_SIGNATURE')
 const body=Buffer.from(rawBody)
 const signed=Buffer.concat([Buffer.from(String(timestamp)+'.','utf8'),body])
 let matches=false
 for(const secret of endpointSecrets){
  const expected=createHmac('sha256',secret).update(signed).digest()
  for(const hex of sigs){if(timingSafeEqual(expected,Buffer.from(hex,'hex')))matches=true}
 }
 if(!matches)throw new Error('BIZ_PURSE_16_SIGNATURE_INVALID')
 let event:unknown
 try{event=JSON.parse(body.toString('utf8'))}catch{throw new Error('BIZ_PURSE_16_EVENT_JSON_INVALID')}
 if(!obj(event)||event.livemode!==false||!text(event.id)||!event.id.startsWith('evt_')||
   !text(event.type)||!positive(event.created)||!obj(event.data)||!obj(event.data.object)||
   !text(event.data.object.id)||!text(event.data.object.object)||event.data.object.livemode===true)
  throw new Error('BIZ_PURSE_16_TEST_EVENT_SHAPE_OR_MODE_INVALID')
 return Object.freeze({eventId:event.id,type:event.type,objectId:event.data.object.id,
  created:event.created,rawBodySha256:sha(body),authority:'SIGNED_TEST_EVENT_ONLY' as const})
}
function finish(binding:StripeSandboxOrderBinding,status:StripeSandboxReview['status'],eventId:string|null,reasons:readonly string[],refundId:string|null=null,amount:string|null=null):StripeSandboxReview{
 return Object.freeze({status,webhookEventId:eventId,orderId:binding.orderId,ownerUserId:binding.ownerUserId,
  providerSessionId:binding.sessionId,providerPaymentIntentId:binding.paymentIntentId,
  providerRefundId:refundId,observedAmountMinor:amount,
  proposedJournalKind:status==='TEST_PAYMENT_OBSERVED'?'PAYMENT_SETTLED':status==='TEST_REFUND_OBSERVED'?'PAYMENT_REFUNDED':null,
  reasons:Object.freeze([...new Set(reasons)]),authority:'STRIPE_TEST_EVIDENCE_REVIEW_ONLY' as const,
  canCharge:false as const,canRefund:false as const,canAppendJournal:false as const,
  canFulfill:false as const,canRecognizeCash:false as const,canPayOwner:false as const,canTrade:false as const})
}
/**
 * Any signed event is a notification, NOT payment truth. Every admitted event
 * requires independent GET readback of test-mode Checkout + PaymentIntent.
 * Refund requires an independent GET of the exact referenced Refund ID.
 */
export async function reviewStripeSandboxWebhook(input:Readonly<{
  signed:VerifiedStripeSandboxWebhook
  binding:StripeSandboxOrderBinding
  port:StripeTestReadOnlyPort
}>):Promise<StripeSandboxReview>{
 const {signed,binding,port}=input
 if(!binding||!text(binding.ownerUserId)||!text(binding.orderId)||!text(binding.customerRef)||
   !/^cs_test_[A-Za-z0-9]+$/.test(binding.sessionId)||
   !/^pi_[A-Za-z0-9]+$/.test(binding.paymentIntentId)||binding.currency!=='USD'||
   binding.expectedAmountMinor<=0n||binding.expectedAmountMinor>BigInt(Number.MAX_SAFE_INTEGER))
  throw new Error('BIZ_PURSE_16_ORDER_BINDING_INVALID')
 if(!signed||signed.authority!=='SIGNED_TEST_EVENT_ONLY'||!text(signed.eventId))
  throw new Error('BIZ_PURSE_16_SIGNED_EVENT_REQUIRED')
 if(!port||port.mode!=='STRIPE_TEST_READ_ONLY')throw new Error('BIZ_PURSE_16_READONLY_PORT_REQUIRED')
 if(!allowed.has(signed.type))return finish(binding,'IGNORED',signed.eventId,['UNSUPPORTED_EVENT'])
 const isRefund=signed.type.startsWith('refund.')
 if(isRefund?!/^re_[A-Za-z0-9]+$/.test(signed.objectId):signed.objectId!==binding.sessionId)
  return finish(binding,'BLOCKED',signed.eventId,['WEBHOOK_OBJECT_ID_MISMATCH'])
 let session:unknown,intent:unknown,refund:unknown
 try{
  [session,intent,refund]=await Promise.all([
   port.getCheckoutSession(binding.sessionId),port.getPaymentIntent(binding.paymentIntentId),
   isRefund?port.getRefund(signed.objectId):Promise.resolve(null),
  ])
 }catch{return finish(binding,'BLOCKED',signed.eventId,['READ_ONLY_PROVIDER_FETCH_UNAVAILABLE'])}
 const reasons:string[]=[]
 if(!obj(session)||session.id!==binding.sessionId||session.livemode!==false||session.mode!=='payment'||
   session.status!=='complete'||session.payment_status!=='paid'||session.currency!=='usd'||
   session.amount_total!==Number(binding.expectedAmountMinor)||session.client_reference_id!==binding.orderId||
   session.payment_intent!==binding.paymentIntentId||!obj(session.metadata)||
   session.metadata.owner_user_id!==binding.ownerUserId||session.metadata.customer_ref!==binding.customerRef)
   reasons.push('CHECKOUT_READBACK_MISMATCH')
 if(!obj(intent)||intent.id!==binding.paymentIntentId||intent.livemode!==false||intent.status!=='succeeded'||
   intent.currency!=='usd'||intent.amount!==Number(binding.expectedAmountMinor)||
   intent.amount_received!==Number(binding.expectedAmountMinor)||!obj(intent.metadata)||
   intent.metadata.owner_user_id!==binding.ownerUserId||intent.metadata.order_id!==binding.orderId)
   reasons.push('PAYMENT_INTENT_READBACK_MISMATCH')
 if(isRefund){
  if(!obj(refund)||refund.id!==signed.objectId||refund.livemode===true||refund.status!=='succeeded'||
     refund.payment_intent!==binding.paymentIntentId||refund.currency!=='usd'||
     !positive(refund.amount)||refund.amount>Number(binding.expectedAmountMinor))
    reasons.push('REFUND_READBACK_MISMATCH')
 }
 if(reasons.length)return finish(binding,'BLOCKED',signed.eventId,reasons)
 // A succeeded test-mode PI is not provider-settled cash, bank funds or tax profit.
 return finish(binding,isRefund?'TEST_REFUND_OBSERVED':'TEST_PAYMENT_OBSERVED',signed.eventId,[],
  isRefund?signed.objectId:null,String(isRefund?(refund as {amount:number}).amount:binding.expectedAmountMinor))
}
/** Never accepts sk_live_; no network POST/DELETE or credential serialization. */
export function createStripeTestReadOnlyPort(input:Readonly<{
  testApiKey:string
  fetchImpl?:typeof fetch
  timeoutMs?:number
}>):StripeTestReadOnlyPort{
 if(!text(input.testApiKey)||!input.testApiKey.startsWith('sk_test_'))throw new Error('BIZ_PURSE_16_STRIPE_TEST_KEY_REQUIRED')
 const timeout=input.timeoutMs??10000
 if(!Number.isSafeInteger(timeout)||timeout<100||timeout>30000)throw new Error('BIZ_PURSE_16_TIMEOUT_INVALID')
 const transport=input.fetchImpl??fetch
 async function get(prefix:'checkout/sessions'|'payment_intents'|'refunds',id:string,pattern:RegExp):Promise<unknown>{
  if(!pattern.test(id))throw new Error('BIZ_PURSE_16_PROVIDER_ID_INVALID')
  const controller=new AbortController()
  const timer=setTimeout(()=>controller.abort(),timeout)
  try{
   const response=await transport('https://api.stripe.com/v1/'+prefix+'/'+encodeURIComponent(id),{
    method:'GET',headers:{authorization:'Bearer '+input.testApiKey,accept:'application/json'},
    redirect:'error',signal:controller.signal,cache:'no-store',
   })
   if(!response.ok)throw new Error('BIZ_PURSE_16_PROVIDER_READBACK_UNAVAILABLE')
   return await response.json()
  }finally{clearTimeout(timer)}
 }
 return Object.freeze({mode:'STRIPE_TEST_READ_ONLY' as const,
  getCheckoutSession:(id:string)=>get('checkout/sessions',id,/^cs_test_[A-Za-z0-9]+$/),
  getPaymentIntent:(id:string)=>get('payment_intents',id,/^pi_[A-Za-z0-9]+$/),
  getRefund:(id:string)=>get('refunds',id,/^re_[A-Za-z0-9]+$/),
 })
}
