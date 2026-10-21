import {describe,it,expect} from "vitest"
import {presentSavedFeed} from "./savedFeedPresentation"
const item={
 provider:"bluesky",sourceAccount:"artist.bsky.social",externalId:"at:post:xyz",
 title:"Verifiable post",summary:"An attributed example",occurredAt:"2026-10-17T15:00:00Z",
 url:"https://bsky.app/profile/artist.bsky.social/post/xyz",
 provenance:["bluesky-appview:public"],sourceTrust:"provider_verified",
}
const ready={ok:true,durable:true,items:[item]}
describe("Saved feed Home presentation",()=>{
 it("renders only explicitly durable owner-scoped response",()=>{
  expect(presentSavedFeed(ready)).toHaveLength(1)
  expect(presentSavedFeed({...ready,durable:false})).toEqual([])
  expect(presentSavedFeed({...ready,ok:false})).toEqual([])
  expect(presentSavedFeed({status:"storage_unavailable",items:[item]})).toEqual([])
 })
 it("rejects unverified, non-HTTPS and provider-spoofed items",()=>{
  expect(presentSavedFeed({...ready,items:[{...item,sourceTrust:"owner_unverified"}]})).toEqual([])
  expect(presentSavedFeed({...ready,items:[{...item,url:"https://bsky.app.attacker.test/p/xyz"}]})).toEqual([])
  expect(presentSavedFeed({...ready,items:[{...item,url:"javascript:alert(1)"}]})).toEqual([])
  expect(presentSavedFeed({...ready,items:[{...item,provider:"unknown"}]})).toEqual([])
 })
 it("deduplicates and bounds items without inferring a personal timeline",()=>{
  const stories=presentSavedFeed({...ready,items:Array.from({length:27},(_,i)=>({...item,externalId:i<2?"dupe":"post-"+i}))})
  expect(stories.length).toBe(24)
  expect(stories[0].action?.href).toBe(item.url)
  expect(stories[0].details?.some(x=>x.label==="Source trust")).toBe(true)
 })
})
