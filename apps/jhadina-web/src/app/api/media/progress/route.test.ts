import { beforeEach, describe, expect, it, vi } from "vitest"

const verify = vi.fn()
const createRequestIdentityVerifier = vi.fn(async () => ({ verify }))
const createServiceRoleClient = vi.fn(() => ({}) as never)
const repositoryGet = vi.fn()
const repositoryUpsert = vi.fn()

vi.mock("@/lib/auth/request-identity", () => ({ createRequestIdentityVerifier }))
vi.mock("@/lib/supabase/service-role", () => ({ createServiceRoleClient }))
vi.mock("@/lib/storage/SupabaseMediaPlaybackProgressRepository", () => ({
  SupabaseMediaPlaybackProgressRepository: class {
    get = repositoryGet
    upsert = repositoryUpsert
  },
}))

import { POST } from "./route"

function request(body: unknown) {
  return new Request("http://localhost/api/media/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

const base = {
  userId: "user-1",
  providerId: "direct",
  itemId: "media-1",
}

const validProgress = {
  userId: "user-1",
  providerId: "direct",
  itemId: "media-1",
  positionMs: 1000,
  durationMs: 10000,
  completed: false,
  updatedAt: "2026-09-01T14:00:00.000Z",
}

describe("POST /api/media/progress", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    verify.mockResolvedValue({ userId: "user-1", sessionId: "session-1" })
    createServiceRoleClient.mockReturnValue({} as never)
    repositoryGet.mockResolvedValue(null)
    repositoryUpsert.mockImplementation(async (progress) => progress)
  })

  it("rejects malformed JSON before touching identity or storage", async () => {
    const response = await POST(new Request("http://localhost/api/media/progress", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "not-json",
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid JSON body" })
    expect(verify).not.toHaveBeenCalled()
    expect(createServiceRoleClient).not.toHaveBeenCalled()
  })

  it("fails closed when the request user does not match verified identity", async () => {
    verify.mockRejectedValue(new Error("Action identity mismatch"))

    const response = await POST(request({ ...base, action: "get" }))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ error: "Identity mismatch" })
    expect(createServiceRoleClient).not.toHaveBeenCalled()
    expect(repositoryGet).not.toHaveBeenCalled()
  })

  it("uses verified identity for reads rather than a client-controlled user id", async () => {
    verify.mockResolvedValue({ userId: "verified-user", sessionId: "session-1" })
    repositoryGet.mockResolvedValue({
      userId: "verified-user",
      providerId: base.providerId,
      itemId: base.itemId,
      positionMs: 12000,
      completed: false,
      updatedAt: "2026-09-01T14:00:00.000Z",
    })

    const response = await POST(request({ ...base, action: "get" }))

    expect(response.status).toBe(200)
    expect(repositoryGet).toHaveBeenCalledWith("verified-user", base.providerId, base.itemId)
    expect((await response.json()).progress.userId).toBe("verified-user")
  })

  it("writes using verified identity and rejects a mismatched embedded progress identity", async () => {
    const response = await POST(request({
      ...base,
      action: "upsert",
      progress: { ...validProgress, userId: "someone-else" },
    }))

    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "Invalid progress" })
    expect(verify).not.toHaveBeenCalled()
    expect(repositoryUpsert).not.toHaveBeenCalled()
  })

  it("rejects impossible progress values and non-canonical timestamps", async () => {
    const cases = [
      { ...validProgress, positionMs: -1 },
      { ...validProgress, positionMs: 10001 },
      { ...validProgress, durationMs: -1 },
      { ...validProgress, updatedAt: "2026-09-01T14:00:00Z" },
      { ...validProgress, updatedAt: "not-a-date" },
      { ...validProgress, positionMs: Number.POSITIVE_INFINITY },
    ]

    for (const progress of cases) {
      const response = await POST(request({ ...base, action: "upsert", progress }))
      expect(response.status).toBe(400)
    }

    expect(verify).not.toHaveBeenCalled()
    expect(repositoryUpsert).not.toHaveBeenCalled()
  })

  it("returns 401 when no authenticated user is available", async () => {
    verify.mockRejectedValue(new Error("Authenticated user missing"))

    const response = await POST(request({ ...base, action: "get" }))

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthenticated" })
    expect(createServiceRoleClient).not.toHaveBeenCalled()
  })
})
