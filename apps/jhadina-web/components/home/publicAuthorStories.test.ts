import {describe,expect,it} from "vitest"
import {publicAuthorStories} from "./publicAuthorStories"
const item=(overrides:Record<string,unknown>={})=>({
 provider:"bluesky",sourceTrust:"provider_verified",sourceAccount:"author.bsky.social",
 externalId:"at://did:plc:123/app.bsky.feed.post/abc",title:"A real post",
 summary:"A real public text post",occurredAt:new Date(Date.now()-60000).toISOString(),
 url:"https://bsky.app/profile/did:plc:123/post/abc",
 provenance:["bluesky:public-appview"],...overrides,
})
describe("public author preview Home adapter",()=>{
 it("shows only a verified author post and clearly marks preview state",()=>{
  const stories=publicAuthorStories([item()],"bluesky")
  expect(stories).toHaveLength(1)
  expect(stories[0].source).toBe("Bluesky")
  expect(stories[0].action?.href).toContain("bsky.app")
  expect(stories[0].details).toContainEqual({label:"Connection",value:"Public author preview, not a linked account"})
 })
 it("rejects unverified, mismatched, or unsafe provider URLs",()=>{
  expect(publicAuthorStories([item({sourceTrust:"owner_unverified"})],"bluesky")).toEqual([])
  expect(publicAuthorStories([item({provider:"mastodon"})],"bluesky")).toEqual([])
  expect(publicAuthorStories([item({url:"https://evil.example/post"})],"bluesky")).toEqual([])
  expect(publicAuthorStories([item({url:"http://bsky.app/post"})],"bluesky")).toEqual([])
  expect(publicAuthorStories([item({url:"https://bsky.app.evil.example/"})],"bluesky")).toEqual([])
 })
 it("bounds results and deduplicates within the preview",()=>{
  const list=Array.from({length:12},(_,i)=>item({externalId:String(i)}))
  expect(publicAuthorStories(list,"bluesky")).toHaveLength(10)
  expect(publicAuthorStories([item(),item()],"bluesky")).toHaveLength(1)
 })
 it("shows only verified public GitHub activity and bounds host",()=>{
  const rows=[item({provider:"github",url:"https://github.com/owner/repo",sourceAccount:"owner"})]
  expect(publicAuthorStories(rows,"github")[0].source).toBe("GitHub")
  expect(publicAuthorStories([item({provider:"github",url:"https://github.com.evil.invalid/"})],"github")).toEqual([])
 })
 it("can show public mastodon posts but never future dated updates",()=>{
  const m=item({provider:"mastodon",url:"https://mastodon.social/@author/123"})
  expect(publicAuthorStories([m],"mastodon")[0].source).toBe("Mastodon")
  expect(publicAuthorStories([item({occurredAt:new Date(Date.now()+3600000).toISOString()})],"bluesky")).toEqual([])
 })
})
