import {describe,it,expect} from "vitest"
import {assertFeedStoreCommissioned,assertOwnerUuid,validateStoredFeedRows,type FeedStorageRow} from "./feed-storage-gate"
const ownerA="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const ownerB="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
const row:FeedStorageRow={
 user_id:ownerA,provider:"bluesky",source_account:"artist.bsky.social",external_id:"at:3xy",
 title:"Public author example",summary:"Sample only",occurred_at:"2026-10-17T15:00:00Z",
 url:"https://bsky.app/profile/artist.bsky.social/post/3xy",
 provenance:["bluesky:public-account"],source_trust:"provider_verified",
}
describe("JH-UX2 storage commissioning: fail closed",()=>{
 it("requires authenticated real UUID, not placeholder identity",()=>{
  expect(()=>assertOwnerUuid("owner-one")).toThrow("FEED_OWNER_ID_UNVERIFIED")
  expect(()=>assertOwnerUuid(ownerA)).not.toThrow()
 })
 it("requires explicit switch and exact selected Supabase project URL",()=>{
  const good={flag:"true",ref:"kqbkaozfjubkjevdfvic",configuredUrl:"https://kqbkaozfjubkjevdfvic.supabase.co"}
  expect(()=>assertFeedStoreCommissioned({...good,flag:"false"})).toThrow("FEED_STORE_NOT_COMMISSIONED")
  expect(()=>assertFeedStoreCommissioned({...good,ref:"ztjyewacsmttkzktnyxl"})).toThrow("FEED_STORE_PROJECT_MISMATCH")
  expect(()=>assertFeedStoreCommissioned(good)).not.toThrow()
 })
 it("enforces owner isolation and rejects unverified/forged links",()=>{
  expect(validateStoredFeedRows(ownerA,[row])).toHaveLength(1)
  expect(()=>validateStoredFeedRows(ownerB,[row])).toThrow("FEED_STORE_ROW_NOT_OWNER_VERIFIED")
  expect(()=>validateStoredFeedRows(ownerA,[{...row,source_trust:"owner_unverified"}])).toThrow("FEED_STORE_ROW_NOT_OWNER_VERIFIED")
  expect(()=>validateStoredFeedRows(ownerA,[{...row,url:"https://bsky.app.attacker.test/post/1"}])).toThrow("FEED_URL_PROVIDER_MISMATCH")
 })
 it("never permits unbounded feed rows",()=>{
  expect(()=>validateStoredFeedRows(ownerA,Array.from({length:26},()=>row))).toThrow("FEED_STORE_RESULT_LIMIT")
 })
})
