import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  createClient: vi.fn(),
  eq: vi.fn(),
  select: vi.fn(),
  from: vi.fn(),
}))
vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify: mocks.verify }),
}))
vi.mock("@/lib/supabase/server", () => ({
  createClient: mocks.createClient,
}))

import { GET } from "./route"

const ownerId = "11111111-1111-4111-8111-111111111111"

describe("SOCIAL-CORE.RECOVER.09 read-only phone acceptance", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://kqbkaozfjubkjevdfvic.supabase.co")
    vi.stubEnv("JHADINA_SOCIAL_RPC_AUTHORITY_HARDENED", "false")
    vi.stubEnv("JHADINA_SOCIAL_STUDIO_STORAGE_ENABLED", "false")
    mocks.verify.mockResolvedValue({ userId: ownerId })
    mocks.eq.mockResolvedValue({ count: 0, error: null })
    mocks.select.mockReturnValue({ eq: mocks.eq })
    mocks.from.mockReturnValue({ select: mocks.select })
    mocks.createClient.mockResolvedValue({ from: mocks.from })
  })
  afterEach(() => vi.unstubAllEnvs())

  it("denies signed-out devices before any database access", async () => {
    mocks.verify.mockRejectedValue(new Error("session missing private details"))
    const response = await GET()
    expect(response.status).toBe(401)
    expect(response.headers.get("cache-control")).toContain("no-store")
    expect(mocks.createClient).not.toHaveBeenCalled()
    expect(JSON.stringify(await response.json())).not.toContain("private details")
  })
  it("rejects a Supabase project mismatch before querying a foreign tenant", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://wrong-project.supabase.co")
    expect((await GET()).status).toBe(503)
    expect(mocks.createClient).not.toHaveBeenCalled()
  })
  it("performs only an RLS-scoped HEAD count for the verified identity", async () => {
    mocks.eq.mockResolvedValue({ count: 2, error: null })
    const response = await GET()
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body.checks.accountRegistryRead).toBe("verified")
    expect(body.checks.registeredAccountCount).toBe(2)
    expect(body.checks.rpcAuthority).toBe("off")
    expect(body.checks.privilegedProxy).toBe("not_tested")
    expect(body.checks.livePublishing).toBe("not_tested")
    expect(mocks.from).toHaveBeenCalledWith("jhadina_social_accounts")
    expect(mocks.select).toHaveBeenCalledWith("id", { count: "exact", head: true })
    expect(mocks.eq).toHaveBeenCalledWith("user_id", ownerId)
    expect(mocks.from).toHaveBeenCalledTimes(1)
    expect(JSON.stringify(body)).not.toContain(ownerId)
  })
  it("does not represent feature flags as database verification", async () => {
    vi.stubEnv("JHADINA_SOCIAL_RPC_AUTHORITY_HARDENED", "true")
    const body = await (await GET()).json()
    expect(body.checks.rpcAuthority).toBe("flag_on_requires_database_certification")
    expect(body.checks.providerOAuth).toBe("not_tested")
  })
  it("fails closed for unavailable RLS reads without leaking SQL messages", async () => {
    mocks.eq.mockResolvedValue({ count: null, error: { message: "private SQL failure" } })
    const response = await GET()
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain("private SQL failure")
  })
})
