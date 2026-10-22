import {beforeEach,describe,expect,it,vi} from "vitest"
import {NextRequest} from "next/server"

const verify=vi.fn(async ({userId}:{userId:string})=>({userId,sessionId:"test-session"}))
const commons=vi.fn(async (query:string)=>({
  query,authority:"MEDIA_DISCOVERY_ONLY",relevanceVerified:false,images:[],
}))
vi.mock("@/lib/auth/request-identity",()=>({createRequestIdentityVerifier:async()=>({verify})}))
vi.mock("@/lib/intelligence/commons-media",async importOriginal=>{
  const actual=await importOriginal<typeof import("@/lib/intelligence/commons-media")>()
  return {...actual,searchCommonsImages:(query:string)=>commons(query)}
})
import {GET} from "./route"

function request(q="historic library",owner="user-1"){
  return new NextRequest("http://localhost/api/jhadina/visual-media?q="+encodeURIComponent(q),{
    headers:owner?{"x-jhadina-user-id":owner}:{},
  })
}
describe("owner-triggered JLLM public-media GET boundary",()=>{
  beforeEach(()=>{
    vi.clearAllMocks()
    verify.mockImplementation(async ({userId}:{userId:string})=>({userId,sessionId:"test-session"}))
    commons.mockImplementation(async(query:string)=>({query,authority:"MEDIA_DISCOVERY_ONLY",relevanceVerified:false,images:[]}))
  })
  it("requires signed-in identity and refuses invalid public terms before any network lookup",async()=>{
    expect((await GET(request("historic library",""))).status).toBe(401)
    expect((await GET(request("x"))).status).toBe(400)
    expect(commons).not.toHaveBeenCalled()
  })
  it("does not allow a forged user header to bypass canonical session verification",async()=>{
    verify.mockRejectedValue(new Error("identity mismatch"))
    const res=await GET(request("historic library","foreign-owner"))
    expect(res.status).toBe(401)
    expect(commons).not.toHaveBeenCalled()
  })
  it("returns attributed candidates only after real owner verification, without persistence",async()=>{
    const response=await GET(request("historic library"))
    expect(response.status).toBe(200)
    const body=await response.json()
    expect(body.data.authority).toBe("MEDIA_DISCOVERY_ONLY")
    expect(body.data.relevanceVerified).toBe(false)
    expect(verify).toHaveBeenCalledWith({userId:"user-1"})
    expect(commons).toHaveBeenCalledWith("historic library")
    expect(response.headers.get("cache-control")).toContain("no-store")
  })
  it("does not expose upstream failures or a secret provider error in response",async()=>{
    commons.mockRejectedValue(new Error("secret from external provider"))
    const response=await GET(request())
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain("secret from external provider")
  })
})
