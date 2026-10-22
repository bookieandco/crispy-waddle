import { beforeEach,describe,expect,it,vi } from "vitest"
import { NextRequest } from "next/server"
const mocks=vi.hoisted(()=>({verify:vi.fn(),exchange:vi.fn(),encrypt:vi.fn(),hash:vi.fn(),state:vi.fn(),url:vi.fn()}))
vi.mock("@/lib/auth/request-identity",()=>({createRequestIdentityVerifier:async()=>({verify:mocks.verify})}))
vi.mock("@/lib/youtube-oauth",()=>({
 hashState:mocks.hash,newOAuthState:mocks.state,
 youtubeAuthorizationUrl:mocks.url,
 exchangeYouTubeCode:mocks.exchange,encryptSecret:mocks.encrypt,
}))
import { GET as START } from "./start/route"
import { GET as CALLBACK } from "./callback/route"
describe("YouTube OAuth is explicitly bound to Jhadina owner",()=>{
 beforeEach(()=>{
  vi.clearAllMocks()
  mocks.verify.mockResolvedValue({userId:"owner-a"})
  mocks.state.mockReturnValue("random-nonce")
  mocks.hash.mockImplementation((v:string)=>"hashed:"+v)
  mocks.url.mockReturnValue("https://accounts.google.com/o/oauth2/v2/auth?state=random-nonce")
  mocks.exchange.mockResolvedValue({access_token:"private-access-token",expires_in:3600})
  mocks.encrypt.mockReturnValue("sealed")
 })
 it("does not start OAuth before a verified Jhadina sign-in",async()=>{
  mocks.verify.mockRejectedValue(Error("signed out"))
  const response=await START()
  expect(response.status).toBe(401)
  expect(mocks.url).not.toHaveBeenCalled()
 })
 it("binds the state cookie to both nonce and current owner",async()=>{
  const response=await START()
  expect(response.status).toBe(307)
  expect(mocks.hash).toHaveBeenCalledWith("owner-a:random-nonce")
  expect(response.cookies.get("jhadina_youtube_oauth_owner")?.httpOnly).toBe(true)
 })
 it("prevents owner-switched callback from exchanging any code",async()=>{
  mocks.verify.mockResolvedValue({userId:"owner-b"})
  const request=new NextRequest("https://app.example/api/auth/youtube/callback?code=abc&state=random-nonce",{
   headers:{cookie:"jhadina_youtube_oauth_state=hashed%3Arandom-nonce; jhadina_youtube_oauth_owner=hashed%3Aowner-a%3Arandom-nonce"},
  })
  expect((await CALLBACK(request)).status).toBe(401)
  expect(mocks.exchange).not.toHaveBeenCalled()
 })
 it("allows the matching owner only after state+cookie verification",async()=>{
  const request=new NextRequest("https://app.example/api/auth/youtube/callback?code=abc&state=random-nonce",{
   headers:{cookie:"jhadina_youtube_oauth_state=hashed%3Arandom-nonce; jhadina_youtube_oauth_owner=hashed%3Aowner-a%3Arandom-nonce"},
  })
  const response=await CALLBACK(request)
  expect(response.status).toBe(307)
  expect(mocks.exchange).toHaveBeenCalledWith("abc")
  expect(response.cookies.get("jhadina_youtube_access")?.httpOnly).toBe(true)
 })
})