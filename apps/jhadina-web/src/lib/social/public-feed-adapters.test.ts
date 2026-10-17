import {describe,it,expect,vi} from "vitest"
import {readBlueskyPublicAuthor,readMastodonPublicAuthor} from "./public-feed-adapters"
import {normalizeAuthorizedMetaPagePosts,normalizeAuthorizedInstagramMedia} from "./meta-read-only"
const date="2026-10-17T18:00:00Z"
describe("Provider-only public source reads",()=>{
 it("maps genuine Bluesky AppView author posts with provenance",async()=>{
  const mock=vi.fn(async (_url:RequestInfo|URL)=>Response.json({feed:[{
    post:{uri:"at://did:plc:abc123/app.bsky.feed.post/3m4kx2",
      author:{handle:"artist.bsky.social",displayName:"Artist"},
      record:{text:"New work, documented",createdAt:date}}
  }]})) as typeof fetch
  const records=await readBlueskyPublicAuthor("artist.bsky.social",mock)
  expect(records).toHaveLength(1)
  expect(records[0].sourceTrust).toBe("provider_verified")
  expect(records[0].provider).toBe("bluesky")
  expect(records[0].url).toContain("/post/3m4kx2")
  expect(String(vi.mocked(mock).mock.calls[0][0])).toContain("public.api.bsky.app")
 })
 it("rejects invalid public handles before network",async()=>{
  const mock=vi.fn() as unknown as typeof fetch
  await expect(readBlueskyPublicAuthor("127.0.0.1/secret",mock)).rejects.toThrow("PUBLIC_HANDLE_INVALID")
  expect(mock).not.toHaveBeenCalled()
 })
 it("uses fixed allowed Mastodon host, public visibility only",async()=>{
  const mock=vi.fn(async (url:RequestInfo|URL)=>{
    const uri=String(url)
    if(uri.includes("/lookup"))return Response.json({id:"42",acct:"artist",username:"artist"})
    return Response.json([{id:"123",content:"<p>Hello &amp; welcome</p>",visibility:"public",created_at:date,
      url:"https://mastodon.social/@artist/123"},
      {id:"124",content:"<p>Private</p>",visibility:"private",created_at:date,url:"https://mastodon.social/@artist/124"}])
  }) as typeof fetch
  const records=await readMastodonPublicAuthor({handle:"artist"},mock)
  expect(records).toHaveLength(1)
  expect(records[0].provider).toBe("mastodon")
  expect(records[0].summary).not.toContain("<p>")
  await expect(readMastodonPublicAuthor({handle:"artist",instance:"localhost"},mock)).rejects.toThrow("NOT_ALLOWLISTED")
 })
})
describe("Meta-owned account response normalization",()=>{
 it("requires owner/Graph evidence and page-bound post identifiers",()=>{
  expect(()=>normalizeAuthorizedMetaPagePosts({pageId:"123",pageName:"Brand",
    response:{data:[]},providerEvidenceId:"unverified"})).toThrow("META_PAGE_OWNER_EVIDENCE_REQUIRED")
  const rows=normalizeAuthorizedMetaPagePosts({pageId:"123",pageName:"Brand",
    providerEvidenceId:"meta-graph:owner-grant-receipt",response:{data:[
      {id:"123_456",message:"Our product video",created_time:date,permalink_url:"https://www.facebook.com/123/posts/456"},
      {id:"999_2",message:"Other owner's post",created_time:date,permalink_url:"https://www.facebook.com/999/posts/2"},
    ]}})
  expect(rows).toHaveLength(1)
  expect(rows[0].provider).toBe("facebook_page")
  expect(rows[0].sourceTrust).toBe("owner_unverified")
 })
 it("accepts only authorized professional-media payload with HTTPS provenance",()=>{
  const rows=normalizeAuthorizedInstagramMedia({accountId:"123",accountName:"Brand",
    providerEvidenceId:"meta-graph:owner-grant-receipt",response:{data:[
      {id:"18865",caption:"Behind the scenes",timestamp:date,permalink:"https://www.instagram.com/p/example/"}
    ]}})
  expect(rows).toHaveLength(1)
  expect(rows[0].provider).toBe("instagram_professional")
  expect(rows[0].summary).toContain("Behind the scenes")
  expect(rows[0].sourceTrust).toBe("owner_unverified")
 })
})
