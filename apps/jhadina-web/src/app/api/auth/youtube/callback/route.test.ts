import {afterEach,beforeEach,describe,expect,it,vi} from "vitest"
import {NextRequest} from "next/server"
import {decryptSecret,encryptSecret,hashState} from "@/lib/youtube-oauth"

const owner=vi.hoisted(()=>({id:"owner-one",signedIn:true}))
vi.mock("@/lib/auth/request-identity",()=>({
 createRequestIdentityVerifier:async()=>({
  verify:async()=>{if(!owner.signedIn)throw Error("not signed in");return {userId:owner.id}},
 }),
}))
import {GET} from "./route"
const make=(id="owner-one",state="state-123",returnedState="state-123")=>
 new NextRequest("https://jhadina.example/api/auth/youtube/callback?code=fake-code&state="+encodeURIComponent(returnedState),{
  headers:{cookie:"jhadina_youtube_oauth_state="+hashState(state)+"; jhadina_youtube_oauth_owner="+encodeURIComponent(encryptSecret(id))},
 })
describe("YouTube OAuth owner isolation",()=>{
 beforeEach(()=>{
  owner.id="owner-one";owner.signedIn=true
  process.env.JHADINA_OAUTH_ENCRYPTION_KEY="test-cookie-key-for-oauth-owner-isolation"
  process.env.GOOGLE_CLIENT_ID="test-google-client"
  process.env.GOOGLE_CLIENT_SECRET="test-google-secret"
  process.env.YOUTUBE_REDIRECT_URI="https://jhadina.example/api/auth/youtube/callback"
 })
 afterEach(()=>{
  vi.unstubAllGlobals()
  delete process.env.JHADINA_OAUTH_ENCRYPTION_KEY
  delete process.env.GOOGLE_CLIENT_ID
  delete process.env.GOOGLE_CLIENT_SECRET
  delete process.env.YOUTUBE_REDIRECT_URI
 })
 it("refuses a callback bound to a different Jhadina owner before token exchange",async()=>{
  const fetcher=vi.fn()
  vi.stubGlobal("fetch",fetcher)
  const result=await GET(make("owner-two"))
  expect(result.status).toBe(401)
  expect(fetcher).not.toHaveBeenCalled()
 })
 it("refuses a mismatched OAuth CSRF state",async()=>{
  const fetcher=vi.fn()
  vi.stubGlobal("fetch",fetcher)
  const result=await GET(make("owner-one","original","tampered"))
  expect(result.status).toBe(400)
  expect(fetcher).not.toHaveBeenCalled()
 })
 it("deletes any previous path=/api refresh token if Google does not return one",async()=>{
  const fetcher=vi.fn(async()=>Response.json({access_token:"fresh-access",expires_in:3600}))
  vi.stubGlobal("fetch",fetcher)
  const result=await GET(make())
  expect(result.status).toBe(307)
  expect(decryptSecret(result.cookies.get("jhadina_youtube_owner")!.value)).toBe("owner-one")
  expect(decryptSecret(result.cookies.get("jhadina_youtube_access")!.value)).toBe("fresh-access")
  expect(result.cookies.get("jhadina_youtube_refresh")?.path).toBe("/api")
  expect(result.cookies.get("jhadina_youtube_refresh")?.maxAge).toBe(0)
  expect(fetcher).toHaveBeenCalledTimes(1)
 })
 it("installs only the new refresh credential when Google supplies it",async()=>{
  vi.stubGlobal("fetch",vi.fn(async()=>Response.json({access_token:"new-access",refresh_token:"new-refresh",expires_in:3600})))
  const result=await GET(make())
  const value=result.cookies.get("jhadina_youtube_refresh")
  expect(value?.path).toBe("/api")
  expect(decryptSecret(value!.value)).toBe("new-refresh")
  expect(value?.httpOnly).toBe(true)
 })
})
