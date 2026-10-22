import {beforeEach,describe,expect,it,vi} from "vitest"
const uuid="11111111-1111-4111-8111-111111111111"
const state=vi.hoisted(()=>({signedIn:true,commissioned:true,rows:[] as {provider:string;source_account:string}[]}))
const reads=vi.hoisted(()=>({fetch:vi.fn()}))
vi.mock("@/lib/auth/request-identity",()=>({
 createRequestIdentityVerifier:async()=>({verify:async()=>{
  if(!state.signedIn)throw Error("unauthorized")
  return {userId:uuid}
 }}),
}))
vi.mock("@/lib/social/feed-storage-gate",()=>({
 assertOwnerUuid:(id:string)=>{if(id!==uuid)throw Error("bad owner")},
 assertRuntimeFeedStoreCommissioned:()=>{if(!state.commissioned)throw Error("not ready")},
}))
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({
 from:()=>({select:()=>({eq:()=>({eq:()=>({eq:()=>({eq:()=>({
  order:()=>({limit:async()=>({data:state.rows,error:null})}),
 })})})})})}),
})}))
vi.mock("@/lib/social/owner-public-connections",async importOriginal=>{
 const originals=await importOriginal<typeof import("@/lib/social/owner-public-connections")>()
 return {...originals,readPublicAccount:reads.fetch}
})
import {GET} from "./route"
describe("saved public feeds are read on demand only",()=>{
 beforeEach(()=>{state.signedIn=true;state.commissioned=true;state.rows=[];reads.fetch.mockReset()})
 it("requires an owner session",async()=>{
  state.signedIn=false
  expect((await GET()).status).toBe(401)
  expect(reads.fetch).not.toHaveBeenCalled()
 })
 it("respects uncommissioned storage with zero provider reads",async()=>{
  state.commissioned=false
  expect((await GET()).status).toBe(503)
  expect(reads.fetch).not.toHaveBeenCalled()
 })
 it("returns no fabricated posts when a requested provider fails",async()=>{
  state.rows=[{provider:"bluesky",source_account:"owner.bsky.social"}]
  reads.fetch.mockRejectedValue(Error("upstream"))
  const result=await GET()
  const data=await result.json()
  expect(result.status).toBe(200)
  expect(data.items).toEqual([])
  expect(data.failed).toBe(1)
  expect(data.privateAccountConnected).toBe(false)
  expect(data.autoSync).toBe(false)
 })
 it("reads only fixed public providers with real provenance",async()=>{
  state.rows=[{provider:"github",source_account:"bookieandco"},{provider:"facebook",source_account:"impostor"}]
  reads.fetch.mockResolvedValue([{provider:"github",sourceTrust:"provider_verified",sourceAccount:"bookieandco",externalId:"123"}])
  const data=await(await GET()).json()
  expect(reads.fetch).toHaveBeenCalledTimes(1)
  expect(data.items).toHaveLength(1)
  expect(data.items[0].sourceAccount).toBe("bookieandco")
 })
})
