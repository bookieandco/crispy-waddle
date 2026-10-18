import {describe,expect,it,vi} from 'vitest'
import {probeApprovedBlueskyAlphaFeed} from './alpha-feed-canary'
const policy={
 source:'BLUESKY' as const,ownerOptIn:true,accessReviewed:true,
 approvedReadScope:'PUBLIC_APPVIEW' as const,reviewEvidenceId:'owner:public:terms:10',
 reviewedAt:'2026-10-17T19:00:00Z',budget:'FREE_ONLY' as const,maxCallsPerMinute:4,
}
const permission={
 source:'bluesky' as const,access:'PUBLIC_APPVIEW' as const,termsApproved:true,ownerEnabled:true,
}
const stamp=['2026-10-17T19:59:57Z','2026-10-17T19:59:58Z',
  '2026-10-17T19:59:59Z','2026-10-17T20:00:00Z']
describe('owner-approved public source canary adapter .13',()=>{
 it('gates a single bounded public Bluesky read and emits non-production canary evidence',async()=>{
  const now=()=>stamp.shift()!
  const fetcher=vi.fn(async()=>({ok:true,text:async()=>JSON.stringify({posts:[]})}) as Response)
  const result=await probeApprovedBlueskyAlphaFeed({
   policy,permission,query:'pump',now,fetcher:fetcher as typeof fetch,
  })
  expect(fetcher).toHaveBeenCalledTimes(1)
  expect(result.postsAdmitted).toBe(0)
  expect(result.canary.responseDigest).toMatch(/^[a-f0-9]{64}$/)
  expect(result.readiness.status).toBe('CANARY_PASSED_SOURCE_ONLY')
  expect(result.readiness.productionCommissioned).toBe(false)
  expect(result.readiness.budgetCharged).toBe(false)
 })
 it('fails closed without explicit owner review and never calls provider',async()=>{
  const fetcher=vi.fn(async()=>{throw new Error('no call authorized')})
  await expect(probeApprovedBlueskyAlphaFeed({
    policy:{...policy,ownerOptIn:false},permission,query:'pump',
    now:()=> '2026-10-17T20:00:00Z',fetcher:fetcher as typeof fetch,
  })).rejects.toThrow('preflight_blocked')
  expect(fetcher).not.toHaveBeenCalled()
 })
})
