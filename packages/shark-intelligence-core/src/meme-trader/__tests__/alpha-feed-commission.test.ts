import {describe,expect,it} from 'vitest'
import {evaluateAlphaFeedCommission} from '../alpha-feed-commission'
const now='2026-10-17T20:00:00Z'
const policy={
 source:'BLUESKY' as const,ownerOptIn:true,accessReviewed:true,
 approvedReadScope:'PUBLIC_APPVIEW' as const,reviewEvidenceId:'terms:read:20261017',
 reviewedAt:'2026-10-17T19:00:00Z',budget:'FREE_ONLY' as const,maxCallsPerMinute:4,
}
const canary={
 source:'BLUESKY' as const,requestedAt:'2026-10-17T19:59:57Z',
 receivedAt:'2026-10-17T19:59:58Z',
 result:'BOUNDED_VALID_RESPONSE' as const,evidenceId:'bluesky:canary:42',
 responseDigest:'a'.repeat(64),sourceProof:'PROVIDER_UNATTESTED' as const,
}
describe('source read permission and canary readiness .13',()=>{
 it('requires explicit opt-in, correct scope and review evidence',()=>{
  expect(evaluateAlphaFeedCommission({policy:{...policy,ownerOptIn:false},asOf:now}).status).toBe('POLICY_BLOCKED')
  expect(evaluateAlphaFeedCommission({policy:{...policy,accessReviewed:false},asOf:now}).status).toBe('POLICY_BLOCKED')
  expect(evaluateAlphaFeedCommission({policy:{...policy,source:'X',approvedReadScope:'PUBLIC_APPVIEW'},asOf:now}).status).toBe('POLICY_BLOCKED')
  expect(evaluateAlphaFeedCommission({policy,asOf:now}).status).toBe('CANARY_REQUIRED')
 })
 it('only allows fresh source-only canary and never commissions a running worker or charges for API',()=>{
  const r=evaluateAlphaFeedCommission({policy,canary,asOf:now})
  expect(r.status).toBe('CANARY_PASSED_SOURCE_ONLY')
  expect(r.freshnessSeconds).toBe(2)
  expect(r.productionCommissioned).toBe(false)
  expect(r.liveDeliveryVerified).toBe(false)
  expect(r.budgetCharged).toBe(false)
  expect(r.canTrade).toBe(false)
  expect(evaluateAlphaFeedCommission({policy,canary,asOf:'2026-10-17T20:06:00Z'}).status).toBe('CANARY_REJECTED')
 })
 it('rejects future evidence and unapproved metered access',()=>{
  expect(()=>evaluateAlphaFeedCommission({policy,canary:{...canary,receivedAt:'2026-10-17T21:00:00Z'},asOf:now})).toThrow('canary_invalid')
  expect(evaluateAlphaFeedCommission({policy:{...policy,budget:'OWNER_APPROVED_METERED'},canary,asOf:now}).status).toBe('POLICY_BLOCKED')
 })
})
