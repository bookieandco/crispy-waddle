import {beforeEach,describe,expect,it,vi} from "vitest"
import {NextRequest} from "next/server"
import type {JhadinaWorkSession} from "@jhadina/core-spine"

const mocks=vi.hoisted(()=>({verify:vi.fn(),get:vi.fn(),save:vi.fn()}))
vi.mock("@/lib/auth/request-identity",()=>({createRequestIdentityVerifier:async()=>({verify:mocks.verify})}))
vi.mock("@/lib/supabase/service-role",()=>({createServiceRoleClient:()=>({})}))
vi.mock("@/lib/work-session/supabase-work-session-repository",()=>({
 SupabaseWorkSessionRepository:class{get=mocks.get;save=mocks.save},
}))
import {PUT} from "./route"

function request(body:unknown){return new NextRequest("https://example.test/api/jhadina/work-sessions/ws-1",{
 method:"PUT",headers:{"content-type":"application/json","x-jhadina-user-id":"owner-a"},body:JSON.stringify(body),
})}
const route={params:Promise.resolve({id:"ws-1"})}

describe("WorkSession continuity writes",()=>{
 beforeEach(()=>{
  vi.resetAllMocks()
  mocks.verify.mockResolvedValue({userId:"owner-a"})
  let saved:JhadinaWorkSession|null=null
  mocks.get.mockImplementation(async()=>saved)
  mocks.save.mockImplementation(async(value:JhadinaWorkSession)=>{saved=value})
 })
 it("retains the first turn's references and subsystems on creation",async()=>{
  const body={goal:"research contracts",activeSubsystems:["opportunity"],decisionRefs:["decision-1"],outputRefs:["result-1"],artifactRefs:[{id:"artifact-1",kind:"data",provenanceRef:"artifact:artifact-1",admitted:true}]}
  const response=await PUT(request(body),route)
  expect(response.status).toBe(200)
  expect((await response.json()).session).toMatchObject({...body,id:"ws-1",ownerUserId:"owner-a"})
 })
 it("does not treat a claimed identity as authentication",async()=>{
  mocks.verify.mockRejectedValue(new Error("IDENTITY_MISMATCH"))
  const response=await PUT(request({goal:"x"}),route)
  expect(response.status).toBe(401)
  expect(mocks.get).not.toHaveBeenCalled()
  expect(mocks.save).not.toHaveBeenCalled()
 })
 it("returns not-found when storage refuses a foreign ID collision",async()=>{
  mocks.save.mockRejectedValue(new Error("WORK_SESSION_NOT_FOUND"))
  const response=await PUT(request({goal:"x"}),route)
  expect(response.status).toBe(404)
  expect((await response.json()).success).toBe(false)
 })
 it("does not report success without storage read-back",async()=>{
  mocks.save.mockResolvedValue(undefined)
  const response=await PUT(request({goal:"x"}),route)
  expect(response.status).toBe(503)
  expect((await response.json()).error).toBe("WORK_SESSION_VERIFY_FAILED")
 })
})
