import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  privileged: vi.fn(),
  rpc: vi.fn(),
}))
vi.mock("../auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify: mocks.verify }),
}))
vi.mock("../supabase/service-role", () => ({
  createRuntimeServiceRoleClient: mocks.privileged,
}))

import {
  executeSocialServerMutation,
  socialServerMutationResult,
} from "./server-mutation-rpc"

const OWNER = "11111111-1111-4111-8111-111111111111"
const operation = "jhadina_social_create_approval_receipt" as const
const args = { p_action_id: "social-public-publish:one", p_type: "public.publish",
  p_fingerprint: "example-fingerprint", p_expires_at: "2026-10-21T20:00:00Z" }

describe("SOCIAL-CORE.RECOVER.06 server RPC authority", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubEnv("JHADINA_SOCIAL_RPC_AUTHORITY_HARDENED", "true")
    mocks.verify.mockResolvedValue({ userId: OWNER })
    mocks.privileged.mockResolvedValue({ rpc: mocks.rpc })
    mocks.rpc.mockResolvedValue({
      data: { id: "receipt-1", user_id: OWNER, status: "pending" }, error: null,
    })
  })
  afterEach(() => vi.unstubAllEnvs())

  it("stays completely disabled until service-only SQL is commissioned", async () => {
    vi.stubEnv("JHADINA_SOCIAL_RPC_AUTHORITY_HARDENED", "false")
    await expect(executeSocialServerMutation(OWNER, operation, args))
      .rejects.toThrow("SOCIAL_RPC_AUTHORITY_NOT_COMMISSIONED")
    expect(mocks.verify).not.toHaveBeenCalled()
    expect(mocks.privileged).not.toHaveBeenCalled()
  })

  it("cannot use a caller-chosen owner different from the signed-in owner", async () => {
    await expect(executeSocialServerMutation("22222222-2222-4222-8222-222222222222", operation, args))
      .rejects.toThrow("SOCIAL_RPC_OWNER_IDENTITY_MISMATCH")
    expect(mocks.privileged).not.toHaveBeenCalled()
  })

  it("rejects an unknown operation before granting privileged access", async () => {
    await expect(executeSocialServerMutation(OWNER, "sql_raw_query" as never, args))
      .rejects.toThrow("SOCIAL_RPC_OPERATION_FORBIDDEN")
    expect(mocks.privileged).not.toHaveBeenCalled()
  })

  it("fails closed when no protected service client is configured", async () => {
    mocks.privileged.mockResolvedValue(null)
    await expect(executeSocialServerMutation(OWNER, operation, args))
      .rejects.toThrow("SOCIAL_RPC_PRIVILEGED_RUNTIME_UNAVAILABLE")
  })

  it("binds exactly the verified owner and explicit allowlisted operation", async () => {
    const result = await socialServerMutationResult<{ id: string; user_id: string }>(OWNER, operation, args)
    expect(mocks.rpc).toHaveBeenCalledTimes(1)
    expect(mocks.rpc).toHaveBeenCalledWith("jhadina_social_server_mutation", {
      p_owner_user_id: OWNER,
      p_operation: operation,
      p_arguments: args,
    })
    expect(result.data?.user_id).toBe(OWNER)
  })

  it("redacts privileged SQL failures from client exceptions", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: "private internal SQL detail" } })
    await expect(executeSocialServerMutation(OWNER, operation, args))
      .rejects.toThrow("SOCIAL_RPC_SERVER_MUTATION_FAILED")
    try { await executeSocialServerMutation(OWNER, operation, args) }
    catch (error) { expect(String(error)).not.toContain("private internal SQL detail") }
  })
})
