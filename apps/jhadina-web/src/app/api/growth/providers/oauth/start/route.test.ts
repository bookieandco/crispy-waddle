import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const verify = vi.fn()
vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify }),
}))
import { GET, POST } from "./route"

const keys = [
  "JHADINA_ADS_OWNER_USER_ID", "ETSY_API_KEY", "ETSY_SHOP_ID", "ETSY_OAUTH_REDIRECT_URI",
  "REDDIT_ADS_CLIENT_ID", "REDDIT_ADS_CLIENT_SECRET",
  "REDDIT_ADS_ACCOUNT_ID", "REDDIT_ADS_REDIRECT_URI", "ADS_OAUTH_SESSION_SECRET",
] as const
const original = Object.fromEntries(keys.map(k => [k, process.env[k]])) as Record<string, string | undefined>
function req(body?: unknown): NextRequest {
  return new NextRequest("https://ads.test/api/growth/providers/oauth/start", body === undefined
    ? {} : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
}
function setup() {
  process.env.JHADINA_ADS_OWNER_USER_ID = "owner-1"
  process.env.ADS_OAUTH_SESSION_SECRET = "test-cookie-encryption-secret-at-least-32-chars"
  process.env.ETSY_API_KEY = "abc1234567:private-key"
  process.env.ETSY_SHOP_ID = "123"
  process.env.ETSY_OAUTH_REDIRECT_URI = "https://ads.test/api/growth/providers/oauth/callback"
  process.env.REDDIT_ADS_CLIENT_ID = "reddit-app"
  process.env.REDDIT_ADS_CLIENT_SECRET = "reddit-private-secret"
  process.env.REDDIT_ADS_ACCOUNT_ID = "reddit-account-1"
  process.env.REDDIT_ADS_REDIRECT_URI = "https://ads.test/api/growth/providers/oauth/callback"
}
describe("ADS-CONNECT.LIVE OAuth owner initiation", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const k of keys) delete process.env[k]
    verify.mockResolvedValue({ userId: "owner-1", sessionId: "synthetic" })
  })
  afterEach(() => {
    for (const k of keys) {
      if (original[k] === undefined) delete process.env[k]
      else process.env[k] = original[k]
    }
  })
  it("requires session, configured owner, and exact identity", async () => {
    verify.mockRejectedValue(new Error("no session"))
    expect((await GET(req())).status).toBe(401)
    expect((await POST(req({ platform: "etsy" }))).status).toBe(401)
    verify.mockResolvedValue({ userId: "owner-1" })
    expect((await GET(req())).status).toBe(503)
    process.env.JHADINA_ADS_OWNER_USER_ID = "owner-1"
    verify.mockResolvedValue({ userId: "other" })
    expect((await POST(req({ platform: "etsy" }))).status).toBe(403)
  })
  it("reports only setup readiness, never credentials", async () => {
    setup()
    const res = await GET(req())
    const body = await res.json()
    expect(body.providers.etsy).toEqual({ readyToAuthorize: true, scope: "shops_r" })
    expect(body.providers.reddit_ads).toEqual({ readyToAuthorize: true, scope: "adsread" })
    expect(body.spendAuthorized).toBe(false)
    expect(JSON.stringify(body)).not.toContain("private")
  })
  it("creates encrypted HttpOnly state only after explicit owner POST", async () => {
    setup()
    const res = await POST(req({ platform: "etsy" }))
    expect(res.status).toBe(200)
    const cookie = res.headers.get("set-cookie") ?? ""
    expect(cookie).toContain("HttpOnly")
    expect(cookie).toContain("SameSite=lax")
    expect(cookie).toContain("Secure")
    const body = await res.json()
    const url = new URL(body.authorizeUrl)
    expect(url.hostname).toBe("www.etsy.com")
    expect(url.searchParams.get("scope")).toBe("shops_r")
    expect(body.spendAuthorized).toBe(false)
    expect(cookie).not.toContain(url.searchParams.get("state")!)
    expect(JSON.stringify(body)).not.toContain("private-key")
  })
  it("allows only known platforms and safe exact callback", async () => {
    setup()
    expect((await POST(req({ platform: "meta" }))).status).toBe(400)
    process.env.ETSY_OAUTH_REDIRECT_URI = "https://other.test/api/growth/providers/oauth/callback"
    expect((await POST(req({ platform: "etsy" }))).status).toBe(503)
  })
})
