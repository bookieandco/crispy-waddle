import {beforeEach,describe,expect,it,vi} from "vitest"
import {NextRequest} from "next/server"
const mocks=vi.hoisted(()=>({verify:vi.fn(),search:vi.fn()}))
vi.mock("@/lib/auth/request-identity",()=>({createRequestIdentityVerifier:async()=>({verify:mocks.verify})}))
vi.mock("@/lib/intelligence/wikipedia-public-research",async(importOriginal)=>{
 const actual=await importOriginal<typeof import("@/lib/intelligence/wikipedia-public-research")>()
 return {...actual,searchWikipediaPublic:mocks.search}
})
import {GET} from "./route"
const req=(q="open source models",owner="owner")=>new NextRequest("http://localhost/api/jhadina/research/wikipedia?q="+encodeURIComponent(q),{
 headers:owner?{"x-jhadina-user-id":owner}:{},
})
describe("owner-triggered public encyclopedia lookup",()=>{
 beforeEach(()=>{vi.resetAllMocks();mocks.verify.mockResolvedValue({userId:"owner"});mocks.search.mockResolvedValue({query:"open source models",items:[],authority:"READ_ONLY_SOURCE_CANDIDATES",verified:false})})
 it("denies unauthenticated or cross-owner calls before any lookup",async()=>{
  expect((await GET(req("open source models",""))).status).toBe(401)
  expect(mocks.search).not.toHaveBeenCalled()
  mocks.verify.mockRejectedValue(new Error("owner mismatch"))
  expect((await GET(req())).status).toBe(401)
  expect(mocks.search).not.toHaveBeenCalled()
 })
 it("accepts only bounded explicit search and excludes private chat context",async()=>{
  expect((await GET(req("a"))).status).toBe(400)
  const response=await GET(req())
  expect(response.status).toBe(200)
  expect(mocks.search).toHaveBeenCalledWith("open source models")
  expect((await response.json()).data.authority).toBe("READ_ONLY_SOURCE_CANDIDATES")
 })
 it("does not expose provider exceptions or source secrets",async()=>{
  mocks.search.mockRejectedValue(new Error("secret token"))
  const response=await GET(req())
  expect(response.status).toBe(503)
  expect(JSON.stringify(await response.json())).not.toContain("secret token")
 })
})
