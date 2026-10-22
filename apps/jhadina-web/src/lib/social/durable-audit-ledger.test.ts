import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  privilegedClient: vi.fn(),
  elevatedRpc: vi.fn(),
  sessionClient: vi.fn(),
  sessionRpc: vi.fn(),
}))
vi.mock("../auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify: mocks.verify }),
}))
vi.mock("../supabase/service-role", () => ({
  createRuntimeServiceRoleClient: mocks.privilegedClient,
}))
vi.mock("../supabase/server", () => ({
  createClient: mocks.sessionClient,
}))

import { createSocialAuditLedger } from "./durable-audit-ledger"

const user = "11111111-1111-4111-8111-111111111111"
const event = {
  id: "social-audit-1", actionId: "social-action-1", userId: user,
  type: "public.publish", status: "approval_required" as const,
  timestamp: "2026-10-21T22:00:00.000Z",
}

describe("Social audit provenance boundary", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("JHADINA_SOCIAL_RPC_AUTHORITY_HARDENED", "true")
    mocks.verify.mockResolvedValue({ userId: user })
    mocks.privilegedClient.mockResolvedValue({ rpc: mocks.elevatedRpc })
    mocks.elevatedRpc.mockResolvedValue({ data: { event_id: event.id }, error: null })
    mocks.sessionClient.mockResolvedValue({ rpc: mocks.sessionRpc })
    mocks.sessionRpc.mockResolvedValue({ data: [], error: null })
  })
  afterEach(() => vi.unstubAllEnvs())

  it("refuses any Social append while commissioning remains disabled", async () => {
    vi.stubEnv("JHADINA_SOCIAL_RPC_AUTHORITY_HARDENED", "false")
    const ledger = await createSocialAuditLedger()
    await expect(ledger.append(event)).rejects.toThrow("SOCIAL_AUDIT_NOT_COMMISSIONED")
    expect(mocks.privilegedClient).not.toHaveBeenCalled()
    expect(mocks.sessionClient).not.toHaveBeenCalled()
  })

  it("denies a forged actor before obtaining a privileged client", async () => {
    mocks.verify.mockResolvedValue({ userId: "different-user" })
    const ledger = await createSocialAuditLedger()
    await expect(ledger.append(event)).rejects.toThrow("SOCIAL_AUDIT_OWNER_MISMATCH")
    expect(mocks.privilegedClient).not.toHaveBeenCalled()
  })

  it("requires privileged service credentials for authoritative Social events", async () => {
    mocks.privilegedClient.mockResolvedValue(null)
    const ledger = await createSocialAuditLedger()
    await expect(ledger.append(event)).rejects.toThrow("SOCIAL_AUDIT_PRIVILEGED_UNAVAILABLE")
    expect(mocks.sessionRpc).not.toHaveBeenCalled()
  })

  it("uses server-only audit append with exact owner and Social domain", async () => {
    const ledger = await createSocialAuditLedger()
    await ledger.append(event)
    expect(mocks.elevatedRpc).toHaveBeenCalledTimes(1)
    expect(mocks.elevatedRpc).toHaveBeenCalledWith("append_jhadina_audit_event",
      expect.objectContaining({ p_actor_id: user, p_domain: "social",
        p_capability: "public.publish", p_status: "approval_required" }))
    expect(mocks.sessionRpc).not.toHaveBeenCalled()
  })

  it("keeps scoped reads on the ordinary owner-authenticated client", async () => {
    const ledger = await createSocialAuditLedger()
    await expect(ledger.list({ actorId: user, domain: "social" })).resolves.toEqual([])
    expect(mocks.sessionRpc).toHaveBeenCalledWith("list_jhadina_audit_events",
      { p_domain: "social", p_actor_id: user })
    expect(mocks.privilegedClient).not.toHaveBeenCalled()
  })

  it("does not expose raw database details to append callers", async () => {
    mocks.elevatedRpc.mockResolvedValue({ data: null, error: { message: "sensitive SQL error" } })
    const ledger = await createSocialAuditLedger()
    await expect(ledger.append(event)).rejects.toThrow("SOCIAL_AUDIT_APPEND_FAILED")
    try { await ledger.append(event) }
    catch (error) { expect(String(error)).not.toContain("sensitive SQL error") }
  })
})
