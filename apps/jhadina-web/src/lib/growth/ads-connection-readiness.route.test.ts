import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const verify = vi.fn()
const inspect = vi.fn()

vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify }),
}))
vi.mock("@/lib/growth/markifact-provider", () => ({
  checkMarkifactCampaignCapability: (...args: unknown[]) => inspect(...args),
}))

import { GET as readinessGET } from "../../app/api/growth/providers/readiness/route"
import { GET as markifactGET } from "../../app/api/growth/providers/markifact/health/route"

const keys = [
  "JHADINA_ADS_OWNER_USER_ID",
  "MARKIFACT_MCP_ACCESS_TOKEN",
  "GROWTH_AD_MAX_DAILY_BUDGET_MINOR",
  "GROWTH_AD_MAX_LIFETIME_BUDGET_MINOR",
] as const
const before: Record<string, string | undefined> = Object.fromEntries(
  keys.map(key => [key, process.env[key]]),
)

function request(channel = "meta") {
  return new NextRequest("http://localhost/api/growth/providers/markifact/health?channel=" + channel)
}

describe("owner-only paid provider readiness routes", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    for (const key of keys) delete process.env[key]
    verify.mockResolvedValue({ userId: "owner-1", sessionId: "session-1" })
  })
  afterEach(() => {
    for (const key of keys) {
      const value = before[key]
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  it("rejects anonymous users before reading any provider state", async () => {
    verify.mockRejectedValue(new Error("Authenticated session required"))
    expect((await readinessGET()).status).toBe(401)
    expect((await markifactGET(request())).status).toBe(401)
    expect(inspect).not.toHaveBeenCalled()
  })

  it("requires explicitly commissioned operator ID", async () => {
    expect((await readinessGET()).status).toBe(503)
    expect((await markifactGET(request())).status).toBe(503)
    expect(inspect).not.toHaveBeenCalled()
  })

  it("does not expose workspace configuration to a different signed-in user", async () => {
    process.env.JHADINA_ADS_OWNER_USER_ID = "owner-1"
    verify.mockResolvedValue({ userId: "visitor-2" })
    expect((await readinessGET()).status).toBe(403)
    expect((await markifactGET(request())).status).toBe(403)
    expect(inspect).not.toHaveBeenCalled()
  })

  it("never returns token values or claims connection means launch authority", async () => {
    process.env.JHADINA_ADS_OWNER_USER_ID = "owner-1"
    process.env.MARKIFACT_MCP_ACCESS_TOKEN = "private-synthetic-token"
    const res = await readinessGET()
    expect(res.status).toBe(200)
    expect(res.headers.get("cache-control")).toBe("no-store")
    const body = await res.json()
    expect(body.data.meta.runtimeTokenPresent).toBe(true)
    expect(body.data.meta.adAccountBindingVerified).toBe(false)
    expect(body.data.launchAuthorized).toBe(false)
    expect(JSON.stringify(body)).not.toContain("private-synthetic-token")
    expect(inspect).not.toHaveBeenCalled()
  })

  it("permits only the documented read-only Meta and Google schema checks", async () => {
    process.env.JHADINA_ADS_OWNER_USER_ID = "owner-1"
    process.env.MARKIFACT_MCP_ACCESS_TOKEN = "fake-token"
    const bad = await markifactGET(request("reddit"))
    expect(bad.status).toBe(400)
    expect(inspect).not.toHaveBeenCalled()
    inspect.mockResolvedValue({
      operationId: "meta_ads_create_campaign",
      approvalGated: true,
      pausedFieldAvailable: true,
      writeToolPresent: true,
    })
    const res = await markifactGET(request())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.accountBindingVerified).toBe(false)
    expect(body.spendAuthorized).toBe(false)
    expect(body.evidenceLevel).toBe("provider_operation_schema_only")
    expect(inspect).toHaveBeenCalledTimes(1)
  })
})
