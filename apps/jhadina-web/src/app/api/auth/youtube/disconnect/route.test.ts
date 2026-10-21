import {afterEach,describe,expect,it,vi} from "vitest"
import {NextRequest} from "next/server"

const mock=vi.hoisted(()=>({loggedIn:true}))
vi.mock("@/lib/auth/request-identity",()=>({
 createRequestIdentityVerifier:async()=>({
  verify:async()=>{if(!mock.loggedIn)throw Error("not authenticated");return {userId:"owner"}}
 }),
}))
import {POST} from "./route"
const request=(origin?:string)=>new NextRequest("https://jhadina.example/api/auth/youtube/disconnect",{
 method:"POST",headers:origin?{origin}:{},
})

describe("Browser-local YouTube disconnect",()=>{
 afterEach(()=>{mock.loggedIn=true})
 it("does not mutate cookies for anonymous callers",async()=>{
  mock.loggedIn=false
  const result=await POST(request("https://jhadina.example"))
  expect(result.status).toBe(401)
  expect(result.cookies.get("jhadina_youtube_access")).toBeUndefined()
 })
 it("denies requests from unrelated origins",async()=>{
  const result=await POST(request("https://other.example"))
  expect(result.status).toBe(403)
  expect(result.cookies.get("jhadina_youtube_access")).toBeUndefined()
 })
 it("clears both regular owner credentials and the path-specific refresh cookie",async()=>{
  const result=await POST(request("https://jhadina.example"))
  expect(result.status).toBe(200)
  expect(result.headers.get("cache-control")).toContain("no-store")
  expect((await result.json()).connection).toBe("disconnected")
  for(const name of ["jhadina_youtube_owner","jhadina_youtube_access","jhadina_youtube_oauth_owner","jhadina_youtube_oauth_state"])expect(result.cookies.get(name)?.maxAge).toBe(0)
  expect(result.cookies.get("jhadina_youtube_refresh")?.path).toBe("/api")
  expect(result.cookies.get("jhadina_youtube_refresh")?.maxAge).toBe(0)
 })
})
