import {beforeEach,describe,expect,it,vi} from "vitest"
import {NextRequest} from "next/server"
const state=vi.hoisted(()=>({error:false,validUser:true,verifiedCode:"" as string}))
vi.mock("@/lib/supabase/server",()=>({
 createClient:async()=>({auth:{
  exchangeCodeForSession:async(code:string)=>{
   state.verifiedCode=code;return {error:state.error?new Error("invalid or expired"):null}
  },
  getUser:async()=>({data:{user:state.validUser?{id:"owner",is_anonymous:false}:null},error:null})
 }}),
}))
import {GET} from "./route"
const req=(query:string)=>new NextRequest("https://preview.vercel.app/auth/callback?"+query)
describe("passwordless callback safely verifies session",()=>{
 beforeEach(()=>{state.error=false;state.validUser=true;state.verifiedCode=""})
 it("never permits an empty code or redirect to another origin",async()=>{
  const res=await GET(req("next=https%3A%2F%2Fevil.invalid"))
  expect(res.status).toBe(307)
  expect(res.headers.get("location")).toContain("/login?next=%2F")
  expect(state.verifiedCode).toBe("")
 })
 it("keeps successful session on the requested local path",async()=>{
  const res=await GET(req("code=valid-code&next=%2Fsocial%2Fconnections"))
  expect(state.verifiedCode).toBe("valid-code")
  expect(res.headers.get("location")).toBe("https://preview.vercel.app/social/connections")
  expect(res.headers.get("cache-control")).toContain("no-store")
 })
 it("does not pretend that a failed exchange signed someone in",async()=>{
  state.error=true
  const res=await GET(req("code=bad-code&next=%2Fsocial%2Fconnections"))
  expect(res.headers.get("location")).toContain("error=callback_failed")
  expect(res.headers.get("location")).toContain("/login")
 })
 it("fails closed when the code exchanges but identity is missing",async()=>{
  state.validUser=false
  const res=await GET(req("code=valid-but-unauthorized"))
  expect(res.headers.get("location")).toContain("/login")
 })
})
