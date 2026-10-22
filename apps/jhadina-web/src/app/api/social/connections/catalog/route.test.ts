import { describe,expect,it,vi,beforeEach,afterEach } from "vitest"
const mocks=vi.hoisted(()=>({verify:vi.fn(),accounts:vi.fn(),get:vi.fn()}))
vi.mock("@/lib/auth/request-identity",()=>({createRequestIdentityVerifier:async()=>({verify:mocks.verify})}))
vi.mock("@/lib/social/repository",()=>({createSocialRepository:()=>({listAccounts:mocks.accounts})}))
vi.mock("next/headers",()=>({cookies:()=>({get:mocks.get})}))
import { GET } from "./route"
describe("authenticated provider connection catalog",()=>{
 beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("GOOGLE_CLIENT_ID","fake");vi.stubEnv("GOOGLE_CLIENT_SECRET","secret");vi.stubEnv("JHADINA_OAUTH_ENCRYPTION_KEY","key");mocks.verify.mockResolvedValue({userId:"owner-a"});mocks.accounts.mockResolvedValue([]);mocks.get.mockReturnValue(undefined)})
 afterEach(()=>vi.unstubAllEnvs())
 it("requires owner session",async()=>{mocks.verify.mockRejectedValue(Error("not signed in"));expect((await GET()).status).toBe(401);expect(mocks.accounts).not.toHaveBeenCalled()})
 it("shows real OAuth as consent-available, not logged in or publish-ready",async()=>{
  const response=await GET();expect(response.status).toBe(200)
  const json=await response.json()
  expect(json.data.youtube.state).toBe("owner_consent_available")
  expect(json.data.youtube.authorizedToPublish).toBe(false)
  expect(json.data.publicFeeds.map((x:{id:string})=>x.id)).toEqual(["github","youtube","wordpress"])
  expect(json.data.direct.every((p:{state:string})=>p.state==="official_oauth_not_configured")).toBe(true)
  expect(JSON.stringify(json)).not.toContain("secret")
 })
 it("presence of encrypted browser token does not establish verified profile",async()=>{
  mocks.get.mockReturnValue({value:"encrypted-cookie-not-exposed"})
  const data=(await (await GET()).json()).data
  expect(data.youtube.state).toBe("browser_credential_present_unverified")
  expect(data.youtube.verifiedProfile).toBe(false)
  expect(JSON.stringify(data)).not.toContain("encrypted-cookie-not-exposed")
 })
})