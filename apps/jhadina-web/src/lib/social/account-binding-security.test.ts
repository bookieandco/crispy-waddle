import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  privilegedClient: vi.fn(),
}))

vi.mock("../auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify: mocks.verify }),
}))
vi.mock("../supabase/service-role", () => ({
  createRuntimeServiceRoleClient: mocks.privilegedClient,
}))
vi.mock("../supabase/server", () => ({
  createClient: vi.fn(),
}))

import { createSocialRepository } from "./repository"

const input = {
  userId: "owner-verified",
  brand: "pupsonstuff" as const,
  provider: "hootsuite",
  providerProfileId: "exact-provider-profile",
  platform: "instagram" as const,
  displayName: "PupsonStuff",
}
const row = {
  id: "account-1",
  user_id: input.userId,
  brand: input.brand,
  provider: input.provider,
  provider_profile_id: input.providerProfileId,
  platform: input.platform,
  display_name: input.displayName,
  handle: null,
  status: "connected",
  created_at: "2026-10-21T00:00:00Z",
  updated_at: "2026-10-21T00:00:00Z",
}

describe("SOCIAL-CORE.RECOVER owner-verified account binding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verify.mockResolvedValue({ userId: input.userId })
  })

  it("rejects a mismatched verified owner before obtaining privileged authority", async () => {
    await expect(createSocialRepository().registerAccount({ ...input, userId: "other-owner" }))
      .rejects.toThrow("SOCIAL_ACCOUNT_OWNER_MISMATCH")
    expect(mocks.privilegedClient).not.toHaveBeenCalled()
  })

  it("fails closed when no trusted server-only client is available", async () => {
    mocks.privilegedClient.mockResolvedValue(null)
    await expect(createSocialRepository().registerAccount(input))
      .rejects.toThrow("SOCIAL_SERVER_ONLY_ACCOUNT_BINDING_UNAVAILABLE")
  })

  it("writes exact provider-bound identity with privileged client, not caller-accessible RPC", async () => {
    const single = vi.fn().mockResolvedValue({ data: row, error: null })
    const select = vi.fn().mockReturnValue({ single })
    const upsert = vi.fn().mockReturnValue({ select })
    const from = vi.fn().mockReturnValue({ upsert })
    mocks.privilegedClient.mockResolvedValue({ from })

    const result = await createSocialRepository().registerAccount(input)
    expect(from).toHaveBeenCalledWith("jhadina_social_accounts")
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({
      user_id: input.userId,
      brand: input.brand,
      provider: input.provider,
      provider_profile_id: input.providerProfileId,
      platform: input.platform,
      status: "connected",
    }), { onConflict: "user_id,provider,provider_profile_id" })
    expect(result.status).toBe("connected")
    expect(result.userId).toBe(input.userId)
  })

  it("rejects a corrupted returned provider binding", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { ...row, provider_profile_id: "different-profile" },
      error: null,
    })
    const from = vi.fn().mockReturnValue({
      upsert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({ single }),
      }),
    })
    mocks.privilegedClient.mockResolvedValue({ from })
    await expect(createSocialRepository().registerAccount(input))
      .rejects.toThrow("SOCIAL_ACCOUNT_VERIFIED_BINDING_MISMATCH")
  })
})
