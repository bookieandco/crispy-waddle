import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
const verify = vi.fn()
const unseal = vi.fn()
const settings = vi.fn()
const assertCallback = vi.fn()
const finish = vi.fn()
vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify }),
}))
vi.mock("@/lib/growth/ads-readonly-oauth", () => ({
  unsealAdsOAuthSession: (...a: unknown[]) => unseal(...a),
  adsOAuthSettings: (...a: unknown[]) => settings(...a),
  assertAdsOAuthCallback: (...a: unknown[]) => assertCallback(...a),
  finishAdsOAuthReadCanary: (...a: unknown[]) => finish(...a),
}))
import { GET } from "./route"

const previous = {
  JHADINA_ADS_OWNER_USER_ID: process.env.JHADINA_ADS_OWNER_USER_ID,
  ADS_OAUTH_SESSION_SECRET: process.env.ADS_OAUTH_SESSION_SECRET,
}
function req(params = "?state=expected&code=private-code") {
  return new NextRequest("https://ads.test/api/growth/providers/oauth/callback" + params, {
    headers: { cookie: "jhadina_ads_oauth_pending=encrypted-cookie" },
  })
}
describe("ADS-CONNECT.LIVE callback fail closed", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.JHADINA_ADS_OWNER_USER_ID = "owner-1"
    process.env.ADS_OAUTH_SESSION_SECRET = "private-cookie-secret-at-least-32-bytes"
    verify.mockResolvedValue({ userId: "owner-1" })
    unseal.mockReturnValue({
      platform: "etsy", ownerUserId: "owner-1", state: "expected",
      verifier: "a".repeat(43), expiresAt: Date.now() + 100000,
    })
    settings.mockReturnValue({
      platform: "etsy", clientId: "app", account: "123",
      callback: "https://ads.test/api/growth/providers/oauth/callback",
    })
    finish.mockResolvedValue({
      platform: "etsy", readVerified: true, tokensPersisted: false, spendAuthorized: false,
    })
  })
  afterEach(() => {
    if (previous.JHADINA_ADS_OWNER_USER_ID === undefined) delete process.env.JHADINA_ADS_OWNER_USER_ID
    else process.env.JHADINA_ADS_OWNER_USER_ID = previous.JHADINA_ADS_OWNER_USER_ID
    if (previous.ADS_OAUTH_SESSION_SECRET === undefined) delete process.env.ADS_OAUTH_SESSION_SECRET
    else process.env.ADS_OAUTH_SESSION_SECRET = previous.ADS_OAUTH_SESSION_SECRET
  })
  it("completes only a temporary read-only canary, clears pending cookie, leaks no code", async () => {
    const res = await GET(req())
    expect(res.status).toBe(303)
    expect(res.headers.get("location")).toBe("https://ads.test/growth/ads/connect?oauth=verified-temporary")
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0")
    expect(res.headers.get("cache-control")).toBe("no-store")
    expect(res.headers.get("location")).not.toContain("private-code")
    expect(finish).toHaveBeenCalledTimes(1)
  })
  it("refuses foreign and absent owner sessions before token exchange", async () => {
    verify.mockResolvedValue({ userId: "someone-else" })
    const res = await GET(req())
    expect(res.headers.get("location")).toContain("oauth=failed")
    expect(finish).not.toHaveBeenCalled()
  })
  it("rejects tampered state before token exchange", async () => {
    assertCallback.mockImplementation(() => { throw new Error("state mismatch") })
    const res = await GET(req("?state=wrong&code=secret"))
    expect(res.headers.get("location")).toContain("oauth=failed")
    expect(finish).not.toHaveBeenCalled()
  })
  it("honors denied consent and clears state", async () => {
    const res = await GET(req("?state=expected&error=access_denied"))
    expect(res.headers.get("location")).toContain("oauth=denied")
    expect(finish).not.toHaveBeenCalled()
  })
  it("does not report read verification when provider token or target check fails", async () => {
    finish.mockRejectedValue(new Error("secret-token-not-authorized"))
    const res = await GET(req())
    expect(res.headers.get("location")).toContain("oauth=failed")
    expect(res.headers.get("location")).not.toContain("secret-token")
    expect(res.headers.get("set-cookie")).toContain("Max-Age=0")
  })
})
