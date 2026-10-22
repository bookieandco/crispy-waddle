import {beforeEach,describe,expect,it,vi} from "vitest"
import {NextRequest} from "next/server"
const verify=vi.fn(async ({userId}:{userId:string})=>({userId}))
vi.mock("@/lib/auth/request-identity",()=>({createRequestIdentityVerifier:async()=>({verify})}))
import {GET} from "./route"
const req=(userId?:string)=>new NextRequest("https://localhost/api/jhadina/model-status",{headers:userId?{"x-jhadina-user-id":userId}:{}})
describe("private JLLM model readiness",()=>{
 beforeEach(()=>{vi.resetAllMocks();verify.mockImplementation(async({userId}:{userId:string})=>({userId}))})
 it("rejects anonymous lookups",async()=>{expect((await GET(req())).status).toBe(401);expect(verify).not.toHaveBeenCalled()})
 it("rejects identity mismatch",async()=>{verify.mockRejectedValue(new Error("foreign owner"));expect((await GET(req("other"))).status).toBe(401)})
 it("returns non-secret configuration-only receipt",async()=>{
  const response=await GET(req("owner"))
  expect(response.status).toBe(200)
  expect(response.headers.get("cache-control")).toContain("no-store")
  const body=await response.json()
  expect(body.data.generalReasoningReady).toBe(false)
  expect(["local","anthropic","gemini"]).toContain(body.data.selected)
  expect(["NOT_CONFIGURED","CONFIGURED_UNVERIFIED"]).toContain(body.data.status)
  expect(JSON.stringify(body)).not.toMatch(/(?:sk-|AIza)[A-Za-z0-9]{12}/)
 })
})
