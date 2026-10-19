import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { InMemoryStorage } from "@/lib/storage/InMemoryStorage"
import { MemoryRepository } from "@/lib/repositories/MemoryRepository"
import { POST } from "./route"

const deps = vi.hoisted(() => ({
  identity: "owner-a",
  verifier: vi.fn(),
  store: vi.fn(),
}))

vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify: deps.verifier }),
}))
vi.mock("@/lib/storage/createMemoryStorage", () => ({
  getCanonicalMemoryStorage: () => deps.store(),
}))

function request(body: unknown, userId = "owner-a", origin = "https://jhadina.test"): NextRequest {
  return new NextRequest("https://jhadina.test/api/personality/facebook/propose", {
    method: "POST",
    headers: { origin, "content-type": "application/json", "x-user-id": userId },
    body: JSON.stringify(body),
  })
}
function validBody() {
  return {
    content: "Owner-reviewed observation from Facebook: I often use concise questions in comments.",
    sourceCount: 19, reviewed: true,
  }
}

describe("Facebook review endpoint authority and persistence boundary", () => {
  let storage: InMemoryStorage
  beforeEach(() => {
    storage = new InMemoryStorage()
    deps.store.mockReset().mockReturnValue(storage)
    deps.identity = "owner-a"
    deps.verifier.mockReset().mockImplementation(async (claimed: { userId?: string }) => {
      if (claimed.userId && claimed.userId !== deps.identity) throw new Error("Identity mismatch")
      return { userId: deps.identity }
    })
  })

  it("refuses a cross-origin write before touching authenticated storage", async () => {
    const response = await POST(request(validBody(), "owner-a", "https://foreign.example"))
    expect(response.status).toBe(403)
    expect(deps.store).not.toHaveBeenCalled()
  })

  it("refuses spoofed user headers and never opens the memory store", async () => {
    const response = await POST(request(validBody(), "owner-b"))
    expect(response.status).not.toBe(200)
    expect(deps.store).not.toHaveBeenCalled()
  })

  it("requires explicit owner review, bounded notes and valid sample counts", async () => {
    const response = await POST(request({ ...validBody(), reviewed: false }))
    expect(response.status).toBe(400)
    const noSamples = await POST(request({ ...validBody(), sourceCount: 0 }))
    expect(noSamples.status).toBe(400)
    const oversized = await POST(request({ ...validBody(), content: "x".repeat(901) }))
    expect(oversized.status).toBe(400)
    expect((await new MemoryRepository(storage).listPending("owner-a")).length).toBe(0)
  })

  it("creates only pending owner-scoped memory, retries idempotently and never stores raw archive bytes", async () => {
    const body = validBody()
    const response = await POST(request(body))
    expect(response.status).toBe(200)
    expect((await response.json()).data.status).toBe("PENDING")
    const pending = await new MemoryRepository(storage).listPending("owner-a")
    expect(pending).toHaveLength(1)
    expect(pending[0].content).toBe(body.content)
    expect(await new MemoryRepository(storage).listApproved("owner-a")).toEqual([])
    const retry = await POST(request(body))
    expect((await retry.json()).data.reused).toBe(true)
    expect(await new MemoryRepository(storage).listPending("owner-a")).toHaveLength(1)

    deps.identity = "owner-b"
    const other = await POST(request(body, "owner-b"))
    expect(other.status).toBe(200)
    expect(await new MemoryRepository(storage).listPending("owner-b")).toHaveLength(1)
  })

  it("separates interaction preferences from observational Facebook notes and requires explicit opt-in", async () => {
    const body = {
      kind: "interaction-preference",
      reviewed: true,
      sourceCount: 19,
      preference: "Keep things clear and direct, and challenge my weak ideas.",
    }
    expect((await POST(request(body))).status).toBe(400)
    expect((await POST(request({ ...body, interactionOptIn: true, reviewed: false }))).status).toBe(400)
    expect((await POST(request({ ...body, interactionOptIn: true, preference: "short" }))).status).toBe(400)
    expect((await POST(request({ ...body, kind: "unknown", interactionOptIn: true }))).status).toBe(400)
    expect((await new MemoryRepository(storage).listPending("owner-a"))).toHaveLength(0)
    const response = await POST(request({ ...body, interactionOptIn: true }))
    expect(response.status).toBe(200)
    const candidates = await new MemoryRepository(storage).listPending("owner-a")
    expect(candidates).toHaveLength(1)
    expect(candidates[0].type).toBe("PREFERENCE")
    expect(candidates[0].content).toBe("Owner-approved Jhadina interaction preference: " + body.preference)
    expect((await new MemoryRepository(storage).listApproved("owner-a"))).toEqual([])
    const retry = await POST(request({ ...body, interactionOptIn: true }))
    expect((await retry.json()).data.reused).toBe(true)
  })

  it("fails closed on unavailable durable storage rather than persisting a fallback", async () => {
    deps.store.mockImplementation(() => { throw new Error("Postgres 57P03 unavailable") })
    const response = await POST(request(validBody()))
    const json = await response.json()
    expect(response.status).toBe(503)
    expect(JSON.stringify(json)).not.toContain("57P03")
    expect(JSON.stringify(json)).not.toContain(validBody().content)
  })

  it("does not reimport an already-approved note until the owner retires it", async () => {
    const body = validBody()
    const created = await (await POST(request(body))).json()
    const repo = new MemoryRepository(storage)
    const approved = await repo.approve(created.data.candidateId, "owner-a")
    expect((await POST(request(body))).status).toBe(409)
    await repo.forget(approved.id, "owner-a")
    const renewed = await POST(request(body))
    expect(renewed.status).toBe(200)
    expect((await renewed.json()).data.status).toBe("PENDING")
  })
})
