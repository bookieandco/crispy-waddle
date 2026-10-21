import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => ({
  verify: vi.fn(),
  discover: vi.fn(),
  register: vi.fn(),
}))

vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify: mocks.verify }),
}))
vi.mock("@/lib/social/hootsuite-runtime", () => ({
  createSocialProviderForUser: vi.fn(() => ({
    name: "hootsuite",
    discoverProfiles: mocks.discover,
  })),
}))
vi.mock("@/lib/social/repository", () => ({
  createSocialRepository: vi.fn(() => ({
    registerAccount: mocks.register,
  })),
}))

import { POST } from "./route"

function request(profileId: string) {
  return new NextRequest("https://jhadina.example/api/social/profiles", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      brand: "pupsonstuff",
      provider: "hootsuite",
      providerProfileId: profileId,
    }),
  })
}

describe("Social verified provider registration route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.verify.mockResolvedValue({ userId: "owner-1" })
    mocks.discover.mockResolvedValue([{
      id: "verified-profile-1",
      platform: "instagram",
      name: "PupsonStuff",
      handle: "@pupsonstuff",
    }])
  })

  it("rejects a forged provider profile without performing account write", async () => {
    const response = await POST(request("forged-profile"))
    expect(response.status).toBe(404)
    expect(mocks.register).not.toHaveBeenCalled()
  })

  it("uses exact provider discovery evidence and verified owner", async () => {
    mocks.register.mockResolvedValue({
      id: "account-1",
      userId: "owner-1",
      brand: "pupsonstuff",
      provider: "hootsuite",
      providerProfileId: "verified-profile-1",
      platform: "instagram",
      displayName: "PupsonStuff",
      status: "connected",
    })
    const response = await POST(request("verified-profile-1"))
    expect(response.status).toBe(201)
    expect(mocks.register).toHaveBeenCalledWith(expect.objectContaining({
      userId: "owner-1",
      brand: "pupsonstuff",
      providerProfileId: "verified-profile-1",
      platform: "instagram",
    }))
  })

  it("does not expose secrets or enable account binding before commissioning", async () => {
    mocks.register.mockRejectedValue(new Error("SOCIAL_ACCOUNT_BINDING_MIGRATION_NOT_COMMISSIONED"))
    const response = await POST(request("verified-profile-1"))
    expect(response.status).toBe(503)
    const body = await response.json()
    expect(body.error).toBe("Social account registration has not been commissioned.")
    expect(JSON.stringify(body)).not.toContain("SOCIAL_ACCOUNT_BINDING_MIGRATION")
  })
})
