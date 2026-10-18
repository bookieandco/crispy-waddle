import {describe,it,expect} from "vitest"
import {buildVerifiedFeedSyncPlan,proposeFeedRetry,type FeedSyncSnapshot} from "./feed-sync-plan"
const now="2026-10-18T12:00:00.000Z"
const owner="11111111-1111-4111-8111-111111111111"
const source={
 provider:"bluesky" as const,identityLabel:"artist.bsky.social",state:"healthy" as const,
 capability:"public_read" as const,grantedScopes:[] as string[]
}
const item={
 provider:"bluesky" as const,sourceAccount:"artist.bsky.social",externalId:"at://post/123",
 title:"Verified public example",summary:"Feed body",occurredAt:"2026-10-17T12:00:00Z",
 url:"https://bsky.app/profile/artist.bsky.social/post/123",
 provenance:["provider:appview"],sourceTrust:"provider_verified" as const
}
const input:FeedSyncSnapshot={
 ownerId:owner,storage:{flag:"true",ref:"kqbkaozfjubkjevdfvic",configuredUrl:"https://kqbkaozfjubkjevdfvic.supabase.co"},
 connection:source,requestedAccount:"artist.bsky.social",
 verifiedProviderRead:true,ownerConsent:true,verifiedOwnerGrant:false,
 storedCursorAtRead:"cursor-1",nextCursorBefore:"cursor-1",nextCursorAfter:"cursor-2",items:[item],observedAt:now,
}
describe("JH-UX2.STORAGE.06 source-only ingestion planner",()=>{
 it("plans deduplicated, bounded, expiring owner records",()=>{
  const result=buildVerifiedFeedSyncPlan({...input,items:[item,item]})
  expect(result.writes).toHaveLength(1)
  expect(result.writes[0].user_id).toBe(owner)
  expect(result.cursorBefore).toBe("cursor-1")
  expect(result.cursorAfter).toBe("cursor-2")
  expect(result.expiresAt).toBe("2026-11-17T12:00:00.000Z")
 })
 it("requires exact commissioned database and owner UUID",()=>{
  expect(()=>buildVerifiedFeedSyncPlan({...input,storage:{...input.storage,flag:"false"}})).toThrow("FEED_STORE_NOT_COMMISSIONED")
  expect(()=>buildVerifiedFeedSyncPlan({...input,storage:{...input.storage,ref:"ztjyewacsmttkzktnyxl"}})).toThrow("FEED_STORE_PROJECT_MISMATCH")
  expect(()=>buildVerifiedFeedSyncPlan({...input,ownerId:"user_demo"})).toThrow("FEED_OWNER_ID_UNVERIFIED")
 })
 it("rejects a stale connection cursor before planning a sync",()=>{
  expect(()=>buildVerifiedFeedSyncPlan({...input,storedCursorAtRead:"another-cursor"})).toThrow("FEED_SYNC_STALE_CURSOR")
 })
 it("does not accept missing consent or assumed provider evidence",()=>{
  expect(()=>buildVerifiedFeedSyncPlan({...input,ownerConsent:false})).toThrow("FEED_SYNC_OWNER_CONSENT_REQUIRED")
  expect(()=>buildVerifiedFeedSyncPlan({...input,verifiedProviderRead:false})).toThrow("FEED_SYNC_PROVIDER_NOT_VERIFIED")
  expect(()=>buildVerifiedFeedSyncPlan({...input,connection:{...source,state:"stale"}})).toThrow("FEED_SYNC_SOURCE_NOT_HEALTHY")
 })
 it("requires independently verified owner grants for account-read feeds",()=>{
  const social={...source,provider:"youtube" as const,capability:"authorized_owner_read" as const,grantedScopes:["youtube.readonly"]}
  const video={...item,provider:"youtube" as const,sourceAccount:"different.youtube.channel",url:"https://www.youtube.com/watch?v=1234"}
  expect(()=>buildVerifiedFeedSyncPlan({...input,connection:social,items:[video]})).toThrow("FEED_SYNC_PROVIDER_GRANT_NOT_VERIFIED")
  expect(()=>buildVerifiedFeedSyncPlan({...input,connection:social,verifiedOwnerGrant:true,items:[video]})).toThrow("FEED_SYNC_ITEM_SOURCE_MISMATCH")
 })
 it("rejects unverified, cross-source, spoofed and excessive results",()=>{
  expect(()=>buildVerifiedFeedSyncPlan({...input,items:[{...item,sourceTrust:"owner_unverified"}]})).toThrow("FEED_SYNC_UNVERIFIED_ITEM")
  expect(()=>buildVerifiedFeedSyncPlan({...input,items:[{...item,sourceAccount:"other.bsky.social"}]})).toThrow("FEED_SYNC_ITEM_SOURCE_MISMATCH")
  expect(()=>buildVerifiedFeedSyncPlan({...input,items:[{...item,url:"https://bsky.app.evil.test/post"}]})).toThrow("FEED_URL_PROVIDER_MISMATCH")
  expect(()=>buildVerifiedFeedSyncPlan({...input,items:Array.from({length:26},()=>item)})).toThrow("FEED_SYNC_RESULT_LIMIT")
 })
 it("calculates bounded retry and keeps the cursor unchanged",()=>{
  const retry=proposeFeedRetry({attempt:2,observedAt:now,cursor:"cursor-1",errorCode:"RATE_LIMITED"})
  expect(retry).toMatchObject({status:"retry",cursorAfter:"cursor-1",retryAt:"2026-10-18T13:00:00.000Z"})
  expect(()=>proposeFeedRetry({attempt:5,observedAt:now,cursor:null,errorCode:"RATE_LIMITED"})).toThrow("FEED_SYNC_RETRY_EXHAUSTED")
 })
})
