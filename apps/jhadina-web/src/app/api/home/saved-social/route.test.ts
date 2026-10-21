import {afterEach,beforeEach,describe,expect,it,vi} from "vitest"
const owner=vi.hoisted(()=>({signedIn:true,id:"aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"}))
const db=vi.hoisted(()=>({queried:0,error:null as unknown,rows:[] as unknown[]}))
vi.mock("@/lib/auth/request-identity",()=>({
 createRequestIdentityVerifier:async()=>({
  verify:async()=>{if(!owner.signedIn)throw Error("no JWT");return {userId:owner.id}},
 }),
}))
vi.mock("@/lib/supabase/server",()=>({
 createClient:async()=>({
  from:(_table:string)=>{
   db.queried++
   const q={
    select:()=>q,eq:()=>q,order:()=>q,
    limit:async()=>({data:db.rows,error:db.error}),
   }
   return q
  },
 }),
}))
import {GET} from "./route"
describe("JH-UX2 persisted feed endpoint",()=>{
 beforeEach(()=>{
  owner.signedIn=true;owner.id="aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
  db.queried=0;db.error=null;db.rows=[]
  process.env.NEXT_PUBLIC_SUPABASE_URL="https://kqbkaozfjubkjevdfvic.supabase.co"
  delete process.env.JHADINA_FEED_STORAGE_ENABLED
  delete process.env.JHADINA_FEED_STORAGE_PROJECT_REF
 })
 afterEach(()=>{
  delete process.env.JHADINA_FEED_STORAGE_ENABLED
  delete process.env.JHADINA_FEED_STORAGE_PROJECT_REF
  delete process.env.NEXT_PUBLIC_SUPABASE_URL
 })
 it("rejects anonymous requests and does not query storage",async()=>{
  owner.signedIn=false
  const response=await GET()
  expect(response.status).toBe(401)
  expect(db.queried).toBe(0)
 })
 it("does not query until the exact storage project is commissioned",async()=>{
  expect((await GET()).status).toBe(503)
  process.env.JHADINA_FEED_STORAGE_ENABLED="true"
  process.env.JHADINA_FEED_STORAGE_PROJECT_REF="ztjyewacsmttkzktnyxl"
  expect((await GET()).status).toBe(503)
  expect(db.queried).toBe(0)
 })
 it("never treats placeholder identity as owner",async()=>{
  owner.id="user_demo"
  expect((await GET()).status).toBe(401)
  expect(db.queried).toBe(0)
 })
 it("reads owner rows only when explicitly commissioned",async()=>{
  process.env.JHADINA_FEED_STORAGE_ENABLED="true"
  process.env.JHADINA_FEED_STORAGE_PROJECT_REF="kqbkaozfjubkjevdfvic"
  db.rows=[{
   user_id:owner.id,provider:"bluesky",source_account:"artist.bsky.social",
   external_id:"at:xyz",title:"Public post",summary:"Provider read",
   occurred_at:"2026-10-17T15:00:00Z",
   url:"https://bsky.app/profile/artist.bsky.social/post/xyz",
   provenance:["bluesky:public"],source_trust:"provider_verified",
  }]
  const response=await GET()
  const body=await response.json()
  expect(response.status).toBe(200)
  expect(body.items).toHaveLength(1)
  expect(body.durable).toBe(true)
  expect(response.headers.get("cache-control")).toContain("no-store")
  expect(db.queried).toBe(1)
 })
 it("fails closed on cross-owner rows or failed database query",async()=>{
  process.env.JHADINA_FEED_STORAGE_ENABLED="true"
  process.env.JHADINA_FEED_STORAGE_PROJECT_REF="kqbkaozfjubkjevdfvic"
  db.rows=[{user_id:"bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",source_trust:"provider_verified"}]
  expect((await GET()).status).toBe(503)
  db.rows=[];db.error={message:"private provider issue"}
  const response=await GET()
  expect(response.status).toBe(503)
  expect(JSON.stringify(await response.json())).not.toContain("private provider issue")
 })
})
