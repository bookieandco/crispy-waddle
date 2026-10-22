import {beforeEach,describe,expect,it,vi} from "vitest"
import {NextRequest} from "next/server"

const state=vi.hoisted(()=>({signedIn:true,storage:true,rows:[] as {provider:string;source_account:string;source_kind:string;capability:string;state:string;last_verified_at:string}[]}))
const calls=vi.hoisted(()=>({read:vi.fn(),insert:vi.fn(),remove:vi.fn()}))
const ownerId="11111111-1111-4111-8111-111111111111"
vi.mock("@/lib/auth/request-identity",()=>({
 createRequestIdentityVerifier:async()=>({verify:async()=>{
  if(!state.signedIn)throw Error("UNAUTHENTICATED")
  return {userId:ownerId}
 }}),
}))
vi.mock("@/lib/social/feed-storage-gate",()=>({
 assertOwnerUuid:(id:string)=>{if(id!==ownerId)throw Error("UNVERIFIED")},
 assertRuntimeFeedStoreCommissioned:()=>{if(!state.storage)throw Error("NOT_ENABLED")},
}))
vi.mock("@/lib/social/owner-public-connections",async importOriginal=>{
 const originals=await importOriginal<typeof import("@/lib/social/owner-public-connections")>()
 return {...originals,readPublicAccount:calls.read}
})
vi.mock("@/lib/supabase/server",()=>({
 createClient:async()=>({from:()=>({
  select:()=>({eq:()=>({eq:()=>({
   order:()=>({limit:async()=>({data:state.rows,error:null})}),
   limit:async()=>({data:state.rows,error:null}),
  })})}),
 })}),
}))
vi.mock("@/lib/supabase/service-role",()=>({
 createRuntimeServiceRoleClient:async()=>({from:()=>({
  insert:calls.insert,
  delete:()=>({eq:()=>({eq:()=>({eq:()=>({eq:()=>({eq:calls.remove})})})})}),
 })}),
}))
import {GET,POST,DELETE} from "./route"
const request=(method:"POST"|"DELETE",data:unknown,origin="https://example.com")=>
 new NextRequest("https://example.com/api/social/feed-connections",{method,
  headers:{"content-type":"application/json",origin},body:JSON.stringify(data)})
describe("public feed connection owner security",()=>{
 beforeEach(()=>{
  state.signedIn=true;state.storage=true;state.rows=[]
  calls.read.mockReset();calls.insert.mockReset();calls.remove.mockReset()
 })
 it("fails closed on unauthenticated list",async()=>{
  state.signedIn=false
  const res=await GET()
  expect(res.status).toBe(401)
  expect((await res.json()).sources).toEqual([])
 })
 it("does not grant access without a commissioned store",async()=>{
  state.storage=false
  expect((await GET()).status).toBe(503)
  expect((await POST(request("POST",{provider:"github",handle:"owner"}))).status).toBe(503)
  expect(calls.read).not.toHaveBeenCalled()
 })
 it("rejects cross-origin writes before looking up owner",async()=>{
  const res=await POST(request("POST",{provider:"github",handle:"owner"},"https://evil.invalid"))
  expect(res.status).toBe(403)
  expect(calls.read).not.toHaveBeenCalled()
 })
 it("rejects unsupported or unverified sources; never writes",async()=>{
  expect((await POST(request("POST",{provider:"facebook",handle:"owner"}))).status).toBe(400)
  calls.read.mockResolvedValue([])
  const res=await POST(request("POST",{provider:"github",handle:"owner"}))
  expect(res.status).toBe(422)
  expect(calls.insert).not.toHaveBeenCalled()
 })
 it("lists owner public sources without reporting authenticated social grants",async()=>{
  state.rows=[{provider:"bluesky",source_account:"artist.bsky.social",source_kind:"public_author",capability:"public_read",state:"healthy",last_verified_at:"2026-10-21T00:00:00Z"}]
  const res=await GET()
  const data=await res.json()
  expect(res.status).toBe(200)
  expect(data.sources[0].authorizedPrivateFeed).toBe(false)
  expect(data.sources[0].handle).toBe("artist.bsky.social")
 })
})
