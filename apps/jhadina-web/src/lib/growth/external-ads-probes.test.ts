import { describe, expect, it, vi } from "vitest"
import { probeEtsyPublicShop, probeRedditAdsAccount } from "./external-ads-probes"

function mockResponse(value: unknown, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => value } as Response
}

describe("Reddit Ads v3 read-only account verification", () => {
  it("uses only GET and never inherits authority from Devvit", async () => {
    const fetchFn = vi.fn(async () => mockResponse({ data: { id: "ad-account-1" } })) as unknown as typeof fetch
    const result = await probeRedditAdsAccount({ token: "private-token", accountId: "ad-account-1", fetchFn })
    expect(result.verifiedRead).toBe(true)
    expect(result.permission).toBe("adsread")
    expect(result.accountOwned).toBe(false)
    expect(result.publishAuthorized).toBe(false)
    expect(result.spendAuthorized).toBe(false)
    expect(fetchFn).toHaveBeenCalledWith(
      "https://ads-api.reddit.com/api/v3/ad_accounts/ad-account-1",
      expect.objectContaining({ method: "GET", redirect: "error", cache: "no-store" }),
    )
    expect(JSON.stringify(result)).not.toContain("private-token")
  })
  it("rejects missing credentials, untrusted path and wrong provider account", async () => {
    await expect(probeRedditAdsAccount({ token: "", accountId: "abc" })).rejects.toThrow("NOT_CONFIGURED")
    await expect(probeRedditAdsAccount({ token: "fake", accountId: "../../evil" })).rejects.toThrow("ACCOUNT_ID_INVALID")
    const fetchFn = vi.fn(async () => mockResponse({ data: { id: "somebody-else" } })) as unknown as typeof fetch
    await expect(probeRedditAdsAccount({ token: "fake", accountId: "expected", fetchFn })).rejects.toThrow("PROOF_MISMATCH")
  })
  it("does not claim permission on API 401 or 403", async () => {
    for (const status of [401, 403, 429]) {
      const fetchFn = vi.fn(async () => mockResponse({}, status)) as unknown as typeof fetch
      await expect(probeRedditAdsAccount({ token: "fake", accountId: "target-1", fetchFn })).rejects.toThrow("READ_FAILED")
    }
  })
})

describe("Etsy Open API v3 public shop verification", () => {
  it("separates x-api-key public shop reads from Dev MCP and seller OAuth", async () => {
    const fetchFn = vi.fn(async () => mockResponse({ shop_id: 123, shop_name: "Example" })) as unknown as typeof fetch
    const proof = await probeEtsyPublicShop({ apiKey: "key:private", shopId: "123", fetchFn })
    expect(proof.permission).toBe("public_shop_read")
    expect(proof.accountOwned).toBe(false)
    expect(proof.publishAuthorized).toBe(false)
    expect(proof.spendAuthorized).toBe(false)
    expect(fetchFn).toHaveBeenCalledWith(
      "https://api.etsy.com/v3/application/shops/123",
      expect.objectContaining({ method: "GET", redirect: "error" }),
    )
    expect(JSON.stringify(proof)).not.toContain("key:private")
  })
  it("fails closed on malformed shop IDs and mismatched responses", async () => {
    await expect(probeEtsyPublicShop({ apiKey: "", shopId: "123" })).rejects.toThrow("KEY_NOT_CONFIGURED")
    await expect(probeEtsyPublicShop({ apiKey: "k:s", shopId: "1/../../evil" })).rejects.toThrow("SHOP_ID_INVALID")
    const fetchFn = vi.fn(async () => mockResponse({ shop_id: 124 })) as unknown as typeof fetch
    await expect(probeEtsyPublicShop({ apiKey: "k:s", shopId: "123", fetchFn })).rejects.toThrow("PROOF_MISMATCH")
  })
})
