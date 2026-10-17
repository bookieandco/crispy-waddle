import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const verify = vi.fn()
const reddit = vi.fn()
const etsy = vi.fn()
vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify }),
}))
vi.mock("@/lib/growth/external-ads-probes", () => ({
  probeRedditAdsAccount: (...args: unknown[]) => reddit(...args),
  probeEtsyPublicShop: (...args: unknown[]) => etsy(...args),
}))
import { GET } from "./route"

const keys = ["JHADINA_ADS_OWNER_USER_ID", "REDDIT_ADS_ACCESS_TOKEN", "REDDIT_ADS_ACCOUNT_ID", "ETSY_API_KEY", "ETSY_SHOP_ID"] as const
const original = Object.fromEntries(keys.map(k => [k, process.env[k]])) as Record<string, string | undefined>
function request(platform = "etsy", probe = "0") {
  return new NextRequest("http://localhost/api/growth/providers/external/health?platform=" + platform + "&probe=" + probe)
}
describe("owner-only external ad account probes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    keys.forEach(k => delete process.env[k])
    verify.mockResolvedValue({ userId: "owner-1" })
  })
  afterEach(() => {
    for (const k of keys) {
      if (original[k] === undefined) delete process.env[k]
      else process.env[k] = original[k]
    }
  })
  it("rejects unauthenticated access before exposing metadata", async () => {
    verify.mockRejectedValue(new Error("unauthorized"))
    expect((await GET(request())).status).toBe(401)
    expect(reddit).not.toHaveBeenCalled()
    expect(etsy).not.toHaveBeenCalled()
  })
  it("requires explicit owner selection and rejects foreign sessions", async () => {
    expect((await GET(request())).status).toBe(503)
    process.env.JHADINA_ADS_OWNER_USER_ID = "owner-1"
    verify.mockResolvedValue({ userId: "someone-else" })
    expect((await GET(request())).status).toBe(403)
  })
  it("does not probe external providers unless explicitly requested", async () => {
    process.env.JHADINA_ADS_OWNER_USER_ID = "owner-1"
    process.env.ETSY_API_KEY = "secret-key"
    process.env.ETSY_SHOP_ID = "123"
    const response = await GET(request())
    const body = await response.json()
    expect(body.status).toBe("CREDENTIALS_PRESENT_NOT_VERIFIED")
    expect(body.launchAuthorized).toBe(false)
    expect(etsy).not.toHaveBeenCalled()
    expect(JSON.stringify(body)).not.toContain("secret-key")
  })
  it("runs an explicit Etsy read and returns permission-limited evidence", async () => {
    process.env.JHADINA_ADS_OWNER_USER_ID = "owner-1"
    process.env.ETSY_API_KEY = "secret-key"
    process.env.ETSY_SHOP_ID = "123"
    etsy.mockResolvedValue({
      platform: "etsy_marketplace", verifiedRead: true, permission: "public_shop_read",
      targetMatched: true, accountOwned: false, publishAuthorized: false,
      spendAuthorized: false, endpoint: "etsy_open_api_v3_get_shop",
    })
    const response = await GET(request("etsy", "1"))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.status).toBe("READ_ONLY_VERIFIED")
    expect(body.spendAuthorized).toBe(false)
    expect(etsy).toHaveBeenCalledTimes(1)
  })
  it("Reddit Ads uses only the dedicated Ads API proof, not Devvit", async () => {
    process.env.JHADINA_ADS_OWNER_USER_ID = "owner-1"
    process.env.REDDIT_ADS_ACCESS_TOKEN = "secret-oauth"
    process.env.REDDIT_ADS_ACCOUNT_ID = "reddit-account"
    reddit.mockResolvedValue({
      platform: "reddit_ads", verifiedRead: true, permission: "adsread",
      targetMatched: true, accountOwned: false, publishAuthorized: false,
      spendAuthorized: false, endpoint: "reddit_ads_v3_get_ad_account",
    })
    const response = await GET(request("reddit_ads", "1"))
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.proof.permission).toBe("adsread")
    expect(JSON.stringify(body)).not.toContain("secret-oauth")
  })
  it("fails closed on provider errors, missing credentials, and unknown platform", async () => {
    process.env.JHADINA_ADS_OWNER_USER_ID = "owner-1"
    expect((await GET(request("etsy", "1"))).status).toBe(503)
    expect((await GET(request("devvit", "1"))).status).toBe(400)
    process.env.ETSY_API_KEY = "secret"
    process.env.ETSY_SHOP_ID = "123"
    etsy.mockRejectedValue(new Error("secret token leaked by provider"))
    const response = await GET(request("etsy", "1"))
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain("token leaked")
  })
})
