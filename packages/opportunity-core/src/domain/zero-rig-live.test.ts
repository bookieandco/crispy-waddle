import assert from 'node:assert/strict'
import { createZeroRigSuperteamReader } from './zero-rig-live-transport.js'
import { assessZeroRigOwnerEligibility } from './zero-rig-live-eligibility.js'
import { normalizeSuperteamAgentListings } from './zero-rig-superteam.js'

const now='2026-10-17T20:00:00.000Z'
const raw={result:[{
  id:'b123',slug:'new-bounty',title:'Build original research',status:'OPEN',type:'bounty',
  agentAccess:'AGENT_ALLOWED',deadline:'2026-11-19T00:00:00.000Z',
  skills:['Research'],rewardAmount:100,token:'USDC',
}]}
let observedUrl=''
let calls=0
const key='sk_testKeyOnly123456'
const goodFetch:typeof fetch=async (request,options)=>{
  calls++;observedUrl=String(request)
  assert.equal(options?.method,'GET')
  assert.equal(options?.redirect,'error')
  assert.equal(options?.cache,'no-store')
  assert.equal(new Headers(options?.headers).get('authorization'),'Bearer '+key)
  assert.equal(new URL(observedUrl).hostname,'superteam.fun')
  return new Response(JSON.stringify(raw),{status:200,headers:{'content-type':'application/json'}})
}
const reader=createZeroRigSuperteamReader({apiKey:key,fetchImpl:goodFetch})
const data=await reader.readLiveListings({take:20,deadline:now})
const result=normalizeSuperteamAgentListings(data,now)
assert.equal(calls,1)
assert.equal(result.listings.length,1)
assert.equal(result.listings[0].submissionAuthorized,false)
assert.equal(new URL(observedUrl).searchParams.get('take'),'20')
assert.equal(new URL(observedUrl).searchParams.get('deadline'),now)
await assert.rejects(()=>reader.readLiveListings({take:51,deadline:now}),/TAKE_OUT_OF_BOUNDS/)
assert.equal(calls,1)
assert.throws(()=>createZeroRigSuperteamReader({apiKey:'not-a-key'}),/CREDENTIAL_NOT_CONFIGURED/)
for(const status of [401,429,502]){
 const r=createZeroRigSuperteamReader({
   apiKey:key,fetchImpl:async()=>new Response('secret should never appear in errors',{status}),
 })
 await assert.rejects(()=>r.readLiveListings({take:2,deadline:now}),
   status===401?/AUTH_REJECTED/:status===429?/RATE_LIMITED/:/UNAVAILABLE/)
}
const badCt=createZeroRigSuperteamReader({apiKey:key,fetchImpl:async()=>new Response('<html></html>',{headers:{'content-type':'text/html'}})})
await assert.rejects(()=>badCt.readLiveListings({take:2,deadline:now}),/CONTENT_TYPE_INVALID/)
const tooBig=createZeroRigSuperteamReader({apiKey:key,maxBodyBytes:1024,
 fetchImpl:async()=>new Response('x'.repeat(1200),{headers:{'content-type':'application/json'}})})
await assert.rejects(()=>tooBig.readLiveListings({take:2,deadline:now}),/RESPONSE_TOO_LARGE/)
const badJson=createZeroRigSuperteamReader({apiKey:key,fetchImpl:async()=>new Response('no-json',{headers:{'content-type':'application/json'}})})
await assert.rejects(()=>badJson.readLiveListings({take:2,deadline:now}),/JSON_INVALID/)
const requestFails=createZeroRigSuperteamReader({apiKey:key,fetchImpl:async()=>{throw new Error('Authorization: Bearer secret')}})
await assert.rejects(()=>requestFails.readLiveListings({take:2,deadline:now}),/^Error: ZERO_RIG_PROVIDER_REQUEST_FAILED$/)
const candidate=result.listings[0]
const base={
 listing:candidate,asOf:now,operatorCountry:'US',
 allowedCountryCodes:['US'],agentTermsAcknowledged:true,
 humanClaimantProfileVerified:true,originalWorkPlanEvidence:['plan:original-work'],
 listingDetailEvidence:['superteam:official-detail'],requiredEligibilityAnswersReviewed:true,
 projectTelegramUrlConfirmed:false,
}
let eligibility=assessZeroRigOwnerEligibility(base)
assert.equal(eligibility.status,'eligible_for_research')
assert.equal(eligibility.submissionAuthorized,false)
assert.equal(eligibility.payoutEligibilityVerified,false)
assert.equal(assessZeroRigOwnerEligibility({...base,allowedCountryCodes:null}).status,'needs_owner_review')
assert.equal(assessZeroRigOwnerEligibility({...base,operatorCountry:'CA'}).status,'blocked')
assert.equal(assessZeroRigOwnerEligibility({...base,humanClaimantProfileVerified:false}).status,'needs_owner_review')
assert.equal(assessZeroRigOwnerEligibility({...base,listingDetailEvidence:[]}).status,'needs_owner_review')
assert.equal(assessZeroRigOwnerEligibility({...base,agentTermsAcknowledged:false}).status,'needs_owner_review')
assert.equal(assessZeroRigOwnerEligibility({...base,asOf:'2026-12-20T00:00:00.000Z'}).status,'blocked')
const project={...candidate,listingType:'project' as const}
assert.equal(assessZeroRigOwnerEligibility({...base,listing:project}).status,'needs_owner_review')
console.log('ZERO-RIG.LIVE.01/.02 mock transport and eligibility gates passed (no live provider access)')
