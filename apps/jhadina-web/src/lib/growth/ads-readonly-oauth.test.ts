import { describe, expect, it, vi } from "vitest"
import {
  adsOAuthAuthorizeUrl, adsOAuthSettings, assertAdsOAuthCallback,
  finishAdsOAuthReadCanary, sealAdsOAuthSession, unsealAdsOAuthSession,
  type AdsOAuthSession,
} from "./ads-readonly-oauth"

const secret = "unit-test-isolated-cookie-secret-at-least-32-characters"
const etsyEnv = {
  ETSY_API_KEY: "etsyclient123:shared-secret",
  ETSY_SHOP_ID: "123",
  ETSY_OAUTH_REDIRECT_URI: "https://ads.test/api/growth/providers/oauth/callback",
}
const redditEnv = {
  REDDIT_ADS_CLIENT_ID: "reddit-app",
  REDDIT_ADS_CLIENT_SECRET: "private-reddit-secret",
  REDDIT_ADS_ACCOUNT_ID: "reddit-ad-account",
  REDDIT_ADS_REDIRECT_URI: "https://ads.test/api/growth/providers/oauth/callback",
}
const response = (data: unknown, status = 200) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => data }) as Response

describe("ADS-CONNECT.LIVE read-only OAuth proof", () => {
  it("requires exact HTTPS callback origin and account configuration", () => {
    expect(adsOAuthSettings(etsyEnv, "etsy", "https://ads.test")?.clientId).toBe("etsyclient123")
    expect(adsOAuthSettings(etsyEnv, "etsy", "https://evil.test")).toBeUndefined()
    expect(adsOAuthSettings({ ...etsyEnv, ETSY_OAUTH_REDIRECT_URI: "http://ads.test/api/growth/providers/oauth/callback" }, "etsy", "http://ads.test")).toBeUndefined()
    expect(adsOAuthSettings({ ...etsyEnv, ETSY_SHOP_ID: "../" }, "etsy", "https://ads.test")).toBeUndefined()
    expect(adsOAuthSettings(redditEnv, "reddit_ads", "https://ads.test")?.clientId).toBe("reddit-app")
  })

  it("Etsy is S256 PKCE and shops_r only, Reddit is adsread only", () => {
    const e = adsOAuthAuthorizeUrl(adsOAuthSettings(etsyEnv, "etsy", "https://ads.test")!, "owner-1")
    const eu = new URL(e.authorizeUrl)
    expect(eu.host).toBe("www.etsy.com")
    expect(eu.searchParams.get("scope")).toBe("shops_r")
    expect(eu.searchParams.get("code_challenge_method")).toBe("S256")
    expect(eu.searchParams.get("code_challenge")).toMatch(/^[A-Za-z0-9_-]{43}$/)
    const r = adsOAuthAuthorizeUrl(adsOAuthSettings(redditEnv, "reddit_ads", "https://ads.test")!, "owner-1")
    const ru = new URL(r.authorizeUrl)
    expect(ru.host).toBe("www.reddit.com")
    expect(ru.searchParams.get("scope")).toBe("adsread")
    expect(ru.searchParams.get("duration")).toBe("temporary")
    expect(ru.searchParams.has("code_challenge")).toBe(false)
    expect(e.pending.state).not.toBe(r.pending.state)
  })

  it("encrypts state and PKCE, expires, and rejects replay/tampering/owner mismatch", () => {
    const { pending } = adsOAuthAuthorizeUrl(adsOAuthSettings(etsyEnv, "etsy", "https://ads.test")!, "owner-1")
    const sealed = sealAdsOAuthSession(pending, secret)
    expect(sealed).not.toContain(pending.state)
    expect(sealed).not.toContain(pending.verifier)
    expect(unsealAdsOAuthSession(sealed, secret)).toEqual(pending)
    expect(() => unsealAdsOAuthSession(sealed + "broken", secret)).toThrow()
    expect(() => unsealAdsOAuthSession(sealed, "wrong-encryption-key-with-adequate-length")).toThrow()
    expect(() => assertAdsOAuthCallback(pending, "incorrect", "etsy", "owner-1")).toThrow()
    expect(() => assertAdsOAuthCallback(pending, pending.state, "reddit_ads", "owner-1")).toThrow()
    expect(() => assertAdsOAuthCallback(pending, pending.state, "etsy", "other-owner")).toThrow()
    expect(() => assertAdsOAuthCallback(pending, pending.state, "etsy", "owner-1")).not.toThrow()
    const expired = { ...pending, expiresAt: Date.now() - 1 }
    expect(() => unsealAdsOAuthSession(sealAdsOAuthSession(expired, secret), secret)).toThrow()
  })

  it("performs Etsy token exchange + exact owner shop read and discards credentials", async () => {
    const config = adsOAuthSettings(etsyEnv, "etsy", "https://ads.test")!
    const session = adsOAuthAuthorizeUrl(config, "owner-1").pending
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      if (calls.length === 1) return response({
        access_token: "456.private-access-token", refresh_token: "private-refresh-token", scope: "shops_r",
      })
      return response({ shop_id: 123, user_id: 456 })
    }) as unknown as typeof fetch
    const result = await finishAdsOAuthReadCanary({ config, session, code: "one-time-code", fetchFn })
    expect(result).toEqual({
      platform: "etsy", readVerified: true, tokensPersisted: false, spendAuthorized: false,
    })
    expect(calls.map(c => c.url)).toEqual([
      "https://api.etsy.com/v3/public/oauth/token",
      "https://api.etsy.com/v3/application/users/456/shops",
    ])
    expect(calls[0].init.method).toBe("POST")
    expect(calls[1].init.method).toBe("GET")
    expect(JSON.stringify(result)).not.toMatch(/private-access-token|private-refresh-token|one-time-code/)
  })

  it("fails Etsy canary for missing scope or a foreign shop", async () => {
    const config = adsOAuthSettings(etsyEnv, "etsy", "https://ads.test")!
    const session = adsOAuthAuthorizeUrl(config, "owner-1").pending
    const badScope = vi.fn(async () => response({ access_token: "456.secret", scope: "listings_w" })) as unknown as typeof fetch
    await expect(finishAdsOAuthReadCanary({ config, session, code: "code", fetchFn: badScope })).rejects.toThrow("SCOPE")
    const foreign = vi.fn(async (_url: string, _init: RequestInit) => foreign.mock.calls.length === 1
      ? response({ access_token: "456.secret", scope: "shops_r" })
      : response({ shop_id: 999, user_id: 456 })) as unknown as typeof fetch
    await expect(finishAdsOAuthReadCanary({ config, session, code: "code", fetchFn: foreign })).rejects.toThrow("MISMATCH")
  })

  it("Reddit adsread token is immediately checked against the intended Ads API account", async () => {
    const config = adsOAuthSettings(redditEnv, "reddit_ads", "https://ads.test")!
    const session = adsOAuthAuthorizeUrl(config, "owner-1").pending
    const calls: Array<{ url: string; init: RequestInit }> = []
    const fetchFn = vi.fn(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      if (calls.length === 1) return response({ access_token: "secret", scope: "adsread", refresh_token: "never-store" })
      return response({ data: { id: "reddit-ad-account" } })
    }) as unknown as typeof fetch
    const result = await finishAdsOAuthReadCanary({ config, session, code: "auth-code", fetchFn })
    expect(result).toEqual({
      platform: "reddit_ads", readVerified: true, tokensPersisted: false, spendAuthorized: false,
    })
    expect(calls[0].url).toBe("https://www.reddit.com/api/v1/access_token")
    expect(calls[1].url).toBe("https://ads-api.reddit.com/api/v3/ad_accounts/reddit-ad-account")
    expect(calls[1].init.method).toBe("GET")
    expect(JSON.stringify(result)).not.toContain("secret")
  })
})
