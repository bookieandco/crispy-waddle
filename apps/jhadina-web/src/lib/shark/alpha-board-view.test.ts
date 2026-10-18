import {describe,expect,it} from 'vitest'
import {buildAlphaBoardSnapshot,parseAlphaBoardSnapshot} from './alpha-board-view'
const mint='3cLSxG6eXcCD9NSMawkhUcrvVCUC8KHKHMCxx6bhpump'
const health={
 platform:'BLUESKY' as const,status:'OK' as const,lastCheckedAt:'2026-10-17T19:00:00Z',
 captures:1,postsRequested:1,postsAdmitted:1,postsIgnored:0,acceptanceRate:1,
 coverage:'UNKNOWN_NOT_ALL_PLATFORM_POSTS' as const,sampleSize:1,evidenceIds:['api-receipt'],
 authority:'DESCRIPTIVE_ONLY' as const,canTrade:false as const,
}
const comparison={
 mint,chainEventId:'create:1',asOf:'2026-10-17T19:01:00Z',
 matchCount:1,independentOriginCount:1,duplicateRisk:'LOW' as const,
 earliestSocialAvailableAt:'2026-10-17T19:00:00Z',firstAvailabilityLeadMs:5000,
 timing:'SOCIAL_AVAILABLE_BEFORE_CHAIN_RECEIPT' as const,retrospectiveOnly:false,
 caveats:['unattested'],mentions:[],authority:'RESEARCH_ONLY' as const,
 canAuthorizeTrade:false as const,canAutoCopy:false as const,
}
describe('mobile browser-local Alpha Board',()=>{
 it('serializes aggregate evidence only without message text, social usernames or model-trading authority',()=>{
  const snapshot=buildAlphaBoardSnapshot({
    generatedAt:'2026-10-17T19:01:00Z',sourceHealth:[health],comparisons:[comparison],
  })
  const parsed=parseAlphaBoardSnapshot(JSON.parse(JSON.stringify(snapshot)))
  expect(parsed.candidates[0]?.independentOriginCount).toBe(1)
  expect(parsed.candidates[0]?.firstAvailabilityLeadMs).toBe(5000)
  expect(parsed.sources[0]?.platform).toBe('BLUESKY')
  expect(parsed.verifiedLiveDelivery).toBe(false)
  expect(parsed.canAuthorizeTrade).toBe(false)
  const raw=JSON.stringify(parsed)
  expect(raw).not.toContain('accessToken')
  expect(raw).not.toContain('sourceHandle')
 })
 it('refuses fabricated trading/live credentials and malformed token identity',()=>{
  const snapshot=buildAlphaBoardSnapshot({
    generatedAt:'2026-10-17T19:01:00Z',sourceHealth:[health],comparisons:[comparison],
  })
  expect(()=>parseAlphaBoardSnapshot({...snapshot,canAuthorizeTrade:true})).toThrow('schema_invalid')
  expect(()=>parseAlphaBoardSnapshot({...snapshot,verifiedLiveDelivery:true})).toThrow('schema_invalid')
  expect(()=>parseAlphaBoardSnapshot({...snapshot,candidates:[{...snapshot.candidates[0],mint:'fake'}]})).toThrow('candidate_invalid')
  expect(()=>parseAlphaBoardSnapshot({...snapshot,candidates:[{
    ...snapshot.candidates[0],independentOriginCount:2,
  }]})).toThrow('candidate_invalid')
 })
})
