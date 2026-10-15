import assert from 'node:assert/strict'
import test from 'node:test'
import {createHmac} from 'node:crypto'
import {createStripeTestReadOnlyPort,reviewStripeSandboxWebhook,reviewRawStripeTestWebhook,verifyStripeTestWebhook,
 type StripeSandboxOrderBinding,type StripeTestReadOnlyPort} from './biz-purse-stripe-sandbox.js'
const now=1792018800
const secret='whsec_sandbox_only_one'
const binding:StripeSandboxOrderBinding={ownerUserId:'owner:a',orderId:'order:a',customerRef:'customer:1',
 sessionId:'cs_test_123ABC',paymentIntentId:'pi_123ABC',expectedAmountMinor:9900n,currency:'USD'}
const session={id:binding.sessionId,livemode:false,mode:'payment',status:'complete',payment_status:'paid',
 currency:'usd',amount_total:9900,client_reference_id:binding.orderId,payment_intent:binding.paymentIntentId,
 metadata:{owner_user_id:binding.ownerUserId,customer_ref:binding.customerRef}}
const intent={id:binding.paymentIntentId,livemode:false,status:'succeeded',currency:'usd',
 amount:9900,amount_received:9900,metadata:{owner_user_id:binding.ownerUserId,order_id:binding.orderId}}
const refund={id:'re_ABC1',livemode:false,status:'succeeded',payment_intent:binding.paymentIntentId,amount:2500,currency:'usd'}
const port=(overrides:{session?:unknown,intent?:unknown,refund?:unknown}={}):StripeTestReadOnlyPort=>({
 mode:'STRIPE_TEST_READ_ONLY',getCheckoutSession:async()=>overrides.session??session,
 getPaymentIntent:async()=>overrides.intent??intent,getRefund:async()=>overrides.refund??refund,
})
function makeWebhook(type='checkout.session.completed',objectId=binding.sessionId,options:{livemode?:boolean,timestamp?:number,secret?:string,objectLivemode?:boolean}={}){
 const event={id:'evt_123abc',object:'event',type,created:now,livemode:options.livemode??false,
 data:{object:{id:objectId,object:type.startsWith('refund.')?'refund':'checkout.session',livemode:options.objectLivemode??false}}}
 const rawBody=Buffer.from(JSON.stringify(event))
 const timestamp=options.timestamp??now
 const sig=createHmac('sha256',options.secret??secret).update(Buffer.concat([Buffer.from(String(timestamp)+'.'),rawBody])).digest('hex')
 return {rawBody,stripeSignature:'t='+timestamp+',v1='+sig}
}
const verify=(msg:ReturnType<typeof makeWebhook>)=>verifyStripeTestWebhook({...msg,endpointSecrets:[secret],nowSeconds:now})
test('signed raw bytes produce test-only receipt with canonical hash',()=>{
 const receipt=verify(makeWebhook());assert.equal(receipt.authority,'SIGNED_TEST_EVENT_ONLY')
 assert.equal(receipt.objectId,binding.sessionId);assert.equal(receipt.rawBodySha256.length,64)
})
test('valid signature followed by independent paid readback produces TEST evidence only',async()=>{
 const receipt=verify(makeWebhook())
 const review=await reviewStripeSandboxWebhook({signed:receipt,binding,port:port()})
 assert.equal(review.status,'TEST_PAYMENT_OBSERVED');assert.equal(review.proposedJournalKind,'PAYMENT_SETTLED')
 assert.equal(review.canCharge,false);assert.equal(review.canFulfill,false)
 assert.equal(review.canAppendJournal,false);assert.equal(review.canRecognizeCash,false)
})
test('HMAC verification rejects body tampering, bad header and stale/future timestamp',()=>{
 const w=makeWebhook()
 assert.throws(()=>verify({...w,rawBody:Buffer.concat([w.rawBody,Buffer.from(' ')])}),/SIGNATURE_INVALID/)
 assert.throws(()=>verify({...w,stripeSignature:'t=100,v1=bad'}),/SIGNATURE_HEADER_INVALID/)
 assert.throws(()=>verify(makeWebhook(undefined,undefined,{timestamp:now-301})),/STALE_OR_FUTURE/)
 assert.throws(()=>verify(makeWebhook(undefined,undefined,{timestamp:now+301})),/STALE_OR_FUTURE/)
})
test('live-mode events and body-level live-mode flags are rejected even when signed',()=>{
 assert.throws(()=>verify(makeWebhook(undefined,undefined,{livemode:true})),/TEST_EVENT_SHAPE_OR_MODE_INVALID/)
 assert.throws(()=>verify(makeWebhook(undefined,undefined,{objectLivemode:true})),/TEST_EVENT_SHAPE_OR_MODE_INVALID/)
})
test('rotation accepts old secret, but configuration never accepts untrusted signers',()=>{
 const w=makeWebhook(undefined,undefined,{secret:'whsec_rotated_old'})
 assert.equal(verifyStripeTestWebhook({...w,endpointSecrets:[secret,'whsec_rotated_old'],nowSeconds:now}).eventId,'evt_123abc')
 assert.throws(()=>verify(w),/SIGNATURE_INVALID/)
})
test('unsupported signed webhook never triggers readback',async()=>{
 let calls=0;const source={...port(),getCheckoutSession:async()=>{calls++;return session}}
 const signed=verify(makeWebhook('payment_intent.succeeded'))
 const ignored=await reviewStripeSandboxWebhook({signed,binding,port:source})
 assert.equal(ignored.status,'IGNORED');assert.equal(calls,0)
})
test('matching webhook object cannot override mismatched ownership or amount',async()=>{
 const receipt=verify(makeWebhook())
 for(const changes of [
  {session:{...session,client_reference_id:'other'}},
  {session:{...session,metadata:{...session.metadata,owner_user_id:'other'}}},
  {intent:{...intent,amount_received:0}},
  {intent:{...intent,livemode:true}},
  {session:{...session,payment_status:'unpaid'}},
 ]){
  const review=await reviewStripeSandboxWebhook({signed:receipt,binding,port:port(changes)})
  assert.equal(review.status,'BLOCKED');assert.equal(review.canRecognizeCash,false)
 }
})
test('checkout event cannot refer to some other checkout session',async()=>{
 const signed=verify(makeWebhook('checkout.session.completed','cs_test_SOMEONEELSE'))
 const review=await reviewStripeSandboxWebhook({signed,binding,port:port()})
 assert.equal(review.status,'BLOCKED');assert(review.reasons.includes('WEBHOOK_OBJECT_ID_MISMATCH'))
})
test('verified partial refund requires independent successful refund readback and matching payment',async()=>{
 const signed=verify(makeWebhook('refund.updated','re_ABC1'))
 const review=await reviewStripeSandboxWebhook({signed,binding,port:port()})
 assert.equal(review.status,'TEST_REFUND_OBSERVED');assert.equal(review.observedAmountMinor,'2500')
 assert.equal(review.providerRefundId,'re_ABC1');assert.equal(review.canRefund,false)
 for(const mismatch of [{...refund,status:'pending'}, {...refund,payment_intent:'pi_OTHER'}, {...refund,amount:9901}]){
  const result=await reviewStripeSandboxWebhook({signed,binding,port:port({refund:mismatch})})
  assert.equal(result.status,'BLOCKED')
 }
})
test('provider readback outage cannot create a successful payment result or retry a charge',async()=>{
 let calls=0
 const offline={...port(),getPaymentIntent:async()=>{calls++;throw Error('provider timeout')}}
 const review=await reviewStripeSandboxWebhook({signed:verify(makeWebhook()),binding,port:offline})
 assert.equal(review.status,'BLOCKED');assert.equal(calls,1);assert(review.reasons.includes('READ_ONLY_PROVIDER_FETCH_UNAVAILABLE'))
})
test('read-only Stripe transport sends GET to fixed host with test key only',async()=>{
 const calls:Array<{url:string,method:string|undefined,authorization:string|null}>=[]
 const fakeFetch:typeof fetch=async(input,init)=>{
  const url=String(input),headers=new Headers(init?.headers)
  calls.push({url,method:init?.method,authorization:headers.get('authorization')})
  return new Response(JSON.stringify(url.includes('refunds')?refund:url.includes('checkout')?session:intent),{status:200})
 }
 const client=createStripeTestReadOnlyPort({testApiKey:'sk_test_fixture',fetchImpl:fakeFetch})
 const result=await reviewStripeSandboxWebhook({signed:verify(makeWebhook()),binding,port:client})
 assert.equal(result.status,'TEST_PAYMENT_OBSERVED')
 assert.equal(calls.length,2);assert(calls.every(x=>x.method==='GET'))
 assert(calls.every(x=>x.url.startsWith('https://api.stripe.com/v1/')))
 assert(calls.every(x=>x.authorization==='Bearer sk_test_fixture'))
 await assert.rejects(client.getRefund('https://attacker.example'),/PROVIDER_ID_INVALID/)
 assert.throws(()=>createStripeTestReadOnlyPort({testApiKey:'sk_live_do_not_use'}),/TEST_KEY_REQUIRED/)
})

test('combined entry never contacts provider when incoming signature is invalid',async()=>{
 let calls=0
 const source={...port(),getCheckoutSession:async()=>{calls++;return session}}
 const inbound=makeWebhook()
 await assert.rejects(reviewRawStripeTestWebhook({...inbound,stripeSignature:'t=1,v1=bad',
  endpointSecrets:[secret],nowSeconds:now,binding,port:source}),/SIGNATURE_HEADER_INVALID/)
 assert.equal(calls,0)
})
test('signed event type must agree with object type, and refund readback must be test mode',async()=>{
 const inbound=makeWebhook()
 const raw=JSON.parse(inbound.rawBody.toString()) as {data:{object:{object:string}}}
 raw.data.object.object='payment_intent'
 const rawBody=Buffer.from(JSON.stringify(raw))
 const timestamp=now
 const sig=createHmac('sha256',secret).update(Buffer.concat([Buffer.from(String(timestamp)+'.'),rawBody])).digest('hex')
 const signed=verify({rawBody,stripeSignature:'t='+timestamp+',v1='+sig})
 const review=await reviewStripeSandboxWebhook({signed,binding,port:port()})
 assert.equal(review.status,'BLOCKED');assert(review.reasons.includes('WEBHOOK_OBJECT_TYPE_MISMATCH'))
 const refundSigned=verify(makeWebhook('refund.updated','re_ABC1'))
 const missingMode=await reviewStripeSandboxWebhook({signed:refundSigned,binding,port:port({refund:{...refund,livemode:undefined}})})
 assert.equal(missingMode.status,'BLOCKED')
})
