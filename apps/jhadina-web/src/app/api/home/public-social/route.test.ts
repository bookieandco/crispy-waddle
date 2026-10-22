import {beforeEach,describe,expect,it,vi} from "vitest"
import {NextRequest} from "next/server"

const state=vi.hoisted(()=>({authenticated:true}))
const provider=vi.hoisted(()=>({bluesky:vi.fn(),mastodon:vi.fn(),github:vi.fn()}))
vi.mock("@/lib/auth/request-identity",()=>({
 createRequestIdentityVerifier:async()=>({
  verify:async()=>{if(!state.authenticated)throw Error("Not authenticated");return {userId:"owner-1"}},
 }),
}))
vi.mock("@/lib/social/public-feed-adapters",()=>({
 readBlueskyPublicAuthor:provider.bluesky,
 readMastodonPublicAuthor:provider.mastodon,
 readGitHubPublicActivity:provider.github,
}))
import {GET} from "./route"
const req=(query:string)=>new NextRequest("https://jhadina.example/api/home/public-social?"+query)

describe("Public author preview is always authenticated and read-only",()=>{
 beforeEach(()=>{state.authenticated=true;provider.bluesky.mockReset();provider.mastodon.mockReset();provider.github.mockReset()})
 it("rejects unauthenticated reads without contacting third parties",async()=>{
  state.authenticated=false
  const response=await GET(req("provider=bluesky&account=artist.bsky.social"))
  expect(response.status).toBe(401)
  expect((await response.json()).items).toEqual([])
  expect(provider.bluesky).not.toHaveBeenCalled()
  expect(provider.mastodon).not.toHaveBeenCalled()
  expect(provider.github).not.toHaveBeenCalled()
  expect(response.headers.get("cache-control")).toContain("no-store")
 })
 it("disallows unsupported providers before network access",async()=>{
  const response=await GET(req("provider=facebook&account=private"))
  expect(response.status).toBe(400)
  expect(provider.bluesky).not.toHaveBeenCalled()
 })
 it("labels public Bluesky posts as previews, not saved or private feed",async()=>{
  provider.bluesky.mockResolvedValue([{provider:"bluesky",externalId:"id-1",sourceTrust:"provider_verified"}])
  const response=await GET(req("provider=bluesky&account=artist.bsky.social"))
  expect(response.status).toBe(200)
  const body=await response.json()
  expect(body.kind).toBe("public_author_preview")
  expect(body.ownerConnected).toBe(false)
  expect(body.durable).toBe(false)
  expect(body.items).toHaveLength(1)
  expect(provider.bluesky).toHaveBeenCalledWith("artist.bsky.social")
  expect(response.headers.get("cache-control")).toContain("no-store")
 })
 it("reads only requested public GitHub activity without claiming a connection",async()=>{
  provider.github.mockResolvedValue([{provider:"github",sourceTrust:"provider_verified",externalId:"123"}])
  const response=await GET(req("provider=github&account=sample-user"))
  expect(response.status).toBe(200)
  const data=await response.json()
  expect(data.ownerConnected).toBe(false)
  expect(data.durable).toBe(false)
  expect(data.items).toHaveLength(1)
  expect(provider.github).toHaveBeenCalledWith("sample-user")
 })
 it("does not fabricate posts when the upstream request fails",async()=>{
  provider.mastodon.mockRejectedValue(Error("do not leak upstream response"))
  const response=await GET(req("provider=mastodon&account=artist"))
  expect(response.status).toBe(502)
  const data=await response.json()
  expect(data.items).toEqual([])
  expect(JSON.stringify(data)).not.toContain("do not leak upstream response")
 })
})
