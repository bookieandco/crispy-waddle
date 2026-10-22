import { describe,expect,it,vi,beforeEach } from "vitest"
import { NextRequest } from "next/server"
const mocks=vi.hoisted(()=>({verify:vi.fn(),read:vi.fn()}))
vi.mock("@/lib/auth/request-identity",()=>({createRequestIdentityVerifier:async()=>({verify:mocks.verify})}))
vi.mock("@/lib/social/public-feed-transport",()=>({readPublicFeed:mocks.read}))
import { GET } from "./route"
const req=(q:string)=>new NextRequest("https://app.example/api/social/feed/preview?"+q)
describe("owner-only SuperFeed preview",()=>{
 beforeEach(()=>{vi.clearAllMocks();mocks.verify.mockResolvedValue({userId:"owner-a"});mocks.read.mockImplementation(async source=>({source,state:"ok",items:[{id:source.label+":1",sourceId:source.label,provider:source.provider,title:"Test",url:"https://example.com/"+source.provider,publishedAt:"2026-10-21T10:00:00Z",summary:"Public",provenance:"official_public_feed"}]}))})
 it("blocks unauthenticated requests before any provider reads",async()=>{
  mocks.verify.mockRejectedValue(Error("no auth"))
  expect((await GET(req("source=github%3Abookieandco"))).status).toBe(401)
  expect(mocks.read).not.toHaveBeenCalled()
 })
 it("rejects arbitrary hosts and path traversal",async()=>{
  for(const x of ["source=github%3A127.0.0.1","source=wordpress%3Afoo.example.com","source=youtube%3Ainvalid","source=github%3Auser%2Fsecret"]){
   expect((await GET(req(x))).status).toBe(400)
  }
  expect(mocks.read).not.toHaveBeenCalled()
 })
 it("returns ephemeral balanced public feed without granting posting",async()=>{
  const response=await GET(req("source=github%3Abookieandco&source=wordpress%3Apups"))
  expect(response.status).toBe(200)
  const data=(await response.json()).data
  expect(data.items).toHaveLength(2)
  expect(data.persisted).toBe(false)
  expect(data.authorizedToPublish).toBe(false)
  expect(response.headers.get("cache-control")).toContain("no-store")
  expect(mocks.read).toHaveBeenCalledTimes(2)
 })
 it("does not fetch a duplicate or more than four sources",async()=>{
  expect((await GET(req("source=github%3Abookieandco&source=github%3Abookieandco"))).status).toBe(400)
  expect((await GET(req("source=github%3Aa&source=github%3Ab&source=github%3Ac&source=github%3Ad&source=github%3Ae"))).status).toBe(400)
  expect(mocks.read).not.toHaveBeenCalled()
 })
})