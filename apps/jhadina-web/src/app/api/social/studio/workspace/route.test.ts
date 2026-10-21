import { describe, it, expect, beforeEach, vi } from "vitest"
import { NextRequest } from "next/server"

const mocked = vi.hoisted(() => ({
  verify: vi.fn(),
  load: vi.fn(),
  save: vi.fn(),
}))
vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify: mocked.verify }),
}))
vi.mock("@/lib/social/studio-workspace-repository", () => ({
  loadSocialStudioWorkspace: mocked.load,
  saveSocialStudioWorkspace: mocked.save,
}))

import { GET, PUT } from "./route"

const origin = "https://jhadina.example/api/social/studio/workspace"
function req(url = origin) { return new NextRequest(url) }
function save(body: unknown) {
  return new NextRequest(origin, {
    method: "PUT", headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}
describe("owner-only studio storage route", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocked.verify.mockResolvedValue({ userId: "owner-1" })
  })
  it("requires owner verification before any stored reads", async () => {
    mocked.verify.mockRejectedValue(new Error("Authenticated session required"))
    const response = await GET(req(origin + "?brand=pupsonstuff"))
    expect(response.status).toBe(401)
    expect(mocked.load).not.toHaveBeenCalled()
  })
  it("only accepts known brands and scopes reads to verified owner", async () => {
    const bad = await GET(req(origin + "?brand=foreign-brand"))
    expect(bad.status).toBe(400)
    mocked.load.mockResolvedValue(null)
    const good = await GET(req(origin + "?brand=pupsonstuff"))
    expect(good.status).toBe(200)
    expect(mocked.load).toHaveBeenCalledWith("owner-1", "pupsonstuff")
    expect(good.headers.get("cache-control")).toContain("no-store")
  })
  it("fails closed when persistence has not been commissioned", async () => {
    mocked.load.mockRejectedValue(new Error("SOCIAL_STUDIO_STORAGE_NOT_COMMISSIONED"))
    const response = await GET(req(origin + "?brand=pupsonstuff"))
    expect(response.status).toBe(503)
    expect(JSON.stringify(await response.json())).not.toContain("SOCIAL_STUDIO_STORAGE_NOT_COMMISSIONED")
  })
  it("never overwrites an unknown revision or silently retries a conflict", async () => {
    const invalid = await PUT(save({ brand: "pupsonstuff", workspace: {}, expectedRevision: undefined }))
    expect(invalid.status).toBe(400)
    expect(mocked.save).not.toHaveBeenCalled()
    mocked.save.mockRejectedValue(new Error("SOCIAL_STUDIO_REVISION_CONFLICT"))
    const stale = await PUT(save({ brand: "pupsonstuff", workspace: { brief: {} }, expectedRevision: 1 }))
    expect(stale.status).toBe(409)
    expect(mocked.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: "owner-1", brand: "pupsonstuff", expectedRevision: 1,
    }))
  })
})
