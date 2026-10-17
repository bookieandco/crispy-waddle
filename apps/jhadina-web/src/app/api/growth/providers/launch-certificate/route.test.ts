import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
const verify = vi.fn()
vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify }),
}))
import { GET } from "./route"

const keys = ["JHADINA_ADS_OWNER_USER_ID", "MARKIFACT_MCP_ACCESS_TOKEN", "GROWTH_AD_MAX_DAILY_BUDGET_MINOR", "GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR"] as const
const originals = Object.fromEntries(keys.map(key => [key, process.env[key]])) as Record<string, string | undefined>

describe("launch certificate: read-only owner session and strict evidence", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of keys) delete process.env[key]
    verify.mockResolvedValue({ userId: "verified-owner" })
  })
  afterEach(() => {
    for (const key of keys) {
      if (originals[key] === undefined) delete process.env[key]
      else process.env[key] = originals[key]
    }
  })
  it("denies anonymous access and unconfigured owner", async () => {
    verify.mockRejectedValue(new Error("no session"))
    expect((await GET()).status).toBe(401)
    verify.mockResolvedValue({ userId: "verified-owner" })
    expect((await GET()).status).toBe(503)
  })
  it("denies other authenticated users", async () => {
    process.env.JHADINA_ADS_OWNER_USER_ID = "verified-owner"
    verify.mockResolvedValue({ userId: "somebody-else" })
    expect((await GET()).status).toBe(403)
  })
  it("does not turn token or ceiling presence into provider, RLS, or spend proof", async () => {
    process.env.JHADINA_ADS_OWNER_USER_ID = "verified-owner"
    process.env.MARKIFACT_MCP_ACCESS_TOKEN = "not-for-output"
    process.env.GROWTH_AD_MAX_DAILY_BUDGET_MINOR = "100"
    process.env.GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR = "200"
    const response = await GET()
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(body.meta.tokenPresent).toBe(true)
    expect(body.meta.accountVerified).toBe(false)
    expect(body.certificate.readyForOwnerLaunchReview).toBe(false)
    expect(body.certificate.canSpend).toBe(false)
    expect(body.certificate.canActivateAds).toBe(false)
    expect(body.certificate.openIssues).toContain("DURABLE_STORAGE_UNAVAILABLE")
    expect(body.certificate.openIssues).toContain("ADS_ACCOUNT_NOT_VERIFIED")
    expect(JSON.stringify(body)).not.toContain("not-for-output")
  })
})
