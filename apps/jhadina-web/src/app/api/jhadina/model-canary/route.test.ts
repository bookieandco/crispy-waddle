import {beforeEach,describe,expect,it,vi} from "vitest"
import {NextRequest} from "next/server"

const mocks=vi.hoisted(()=>({verify:vi.fn(),transport:vi.fn(),selected:vi.fn(),connection:vi.fn()}))
vi.mock("@/lib/auth/request-identity",()=>({createRequestIdentityVerifier:async()=>({verify:mocks.verify})}))
vi.mock("@/lib/intelligence/production-model-provider",()=>({configuredJllmSelection:mocks.selected}))
vi.mock("@/lib/intelligence/ollama-local-transport",()=>({
 createOllamaLocalInferenceTransport:()=>({generate:mocks.transport}),
 resolveLocalModelConnection:mocks.connection,
}))
import {POST} from "./route"
const request=(userId?:string)=>new NextRequest("http://localhost/api/jhadina/model-canary",{
 method:"POST",headers:userId?{"x-jhadina-user-id":userId}:{},
})
describe("owner-triggered nonbillable local model acceptance",()=>{
 beforeEach(()=>{
  vi.clearAllMocks()
  mocks.verify.mockResolvedValue({userId:"owner"})
  mocks.selected.mockReturnValue("local")
  mocks.connection.mockReturnValue({baseUrl:"http://127.0.0.1:11434",model:"qwen3:4b"})
  mocks.transport.mockResolvedValue({text:JSON.stringify({
   disposition:"DEFER",recommendation:"LOCAL_MODEL_CANARY_OK",rationale:"test",evidence:[],uncertainty:[],alternatives:[],
  })})
 })
 it("requires verified owner",async()=>{
  expect((await POST(request())).status).toBe(401)
  expect(mocks.transport).not.toHaveBeenCalled()
  mocks.verify.mockRejectedValue(new Error("foreign principal"))
  expect((await POST(request("other"))).status).toBe(401)
  expect(mocks.transport).not.toHaveBeenCalled()
 })
 it("refuses any selected cloud model rather than spending",async()=>{
  mocks.selected.mockReturnValue("gemini")
  expect((await POST(request("owner"))).status).toBe(409)
  expect(mocks.transport).not.toHaveBeenCalled()
 })
 it("requires an actual local response and schema readback",async()=>{
  const response=await POST(request("owner"))
  expect(response.status).toBe(200)
  expect((await response.json()).data).toMatchObject({provider:"local",readiness:"ANSWERED_SCHEMA_CANARY",externallyVerified:false})
  expect(mocks.transport).toHaveBeenCalledTimes(1)
 })
 it("fails closed on model parser error without returning raw text",async()=>{
  mocks.transport.mockResolvedValue({text:"<secret>not json"})
  const response=await POST(request("owner"))
  expect(response.status).toBe(503)
  expect(JSON.stringify(await response.json())).not.toContain("<secret>")
 })
})
