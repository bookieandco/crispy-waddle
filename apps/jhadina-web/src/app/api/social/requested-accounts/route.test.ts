import {beforeEach,describe,expect,it,vi} from "vitest"
const state=vi.hoisted(()=>({
 authenticated:true,dbFailed:false,userId:"11111111-1111-4111-8111-111111111111",
 rows:[] as Record<string,unknown>[],
 selectedUser:"" as string,
}))
vi.mock("@/lib/auth/request-identity",()=>({
 createRequestIdentityVerifier:async()=>({verify:async()=>{
  if(!state.authenticated)throw Error("NOT_AUTHENTICATED")
  return {userId:state.userId}
 }}),
}))
vi.mock("@/lib/social/feed-storage-gate",()=>({
 assertOwnerUuid:(id:string)=>{if(id!==state.userId)throw Error("NOT_OWNER")},
}))
vi.mock("@/lib/supabase/server",()=>({
 createClient:async()=>({from:(table:string)=>{
  if(table!=="jhadina_feed_account_requests")throw Error("WRONG_TABLE")
  return {select:()=>({eq:(field:string,userId:string)=>{
   if(field!=="user_id")throw Error("WRONG_FILTER")
   state.selectedUser=userId
   return {order:()=>({limit:async()=>({
    data:state.rows,error:state.dbFailed?{message:"db down"}:null,
   })})}
  }})}
 }}),
}))
import {GET} from "./route"
const row={provider:"instagram",handle:"bookieandco",profile_url:"https://www.instagram.com/bookieandco/",
 status:"authorization_required",requested_at:"2026-10-21T20:00:00Z"}
describe("requested social accounts read-only API",()=>{
 beforeEach(()=>{state.authenticated=true;state.dbFailed=false;state.rows=[];state.selectedUser=""})
 it("never fetches private account requests before owner sign in",async()=>{
  state.authenticated=false
  const response=await GET()
  expect(response.status).toBe(401)
  expect((await response.json()).profiles).toEqual([])
  expect(state.selectedUser).toBe("")
 })
 it("reads only authenticated owner rows and labels unconnected",async()=>{
  state.rows=[row]
  const response=await GET()
  const body=await response.json()
  expect(response.status).toBe(200)
  expect(state.selectedUser).toBe(state.userId)
  expect(body.profiles[0].connection).toBe("not_connected")
  expect(body.profiles[0].status).toBe("authorization_required")
  expect(body.authorizedAccountCount).toBe(0)
  expect(response.headers.get("cache-control")).toContain("no-store")
 })
 it("fails closed on database problems, not imaginary connected profiles",async()=>{
  state.dbFailed=true
  const response=await GET()
  expect(response.status).toBe(503)
  expect((await response.json()).profiles).toEqual([])
 })
})
