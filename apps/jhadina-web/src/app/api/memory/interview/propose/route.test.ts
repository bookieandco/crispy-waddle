import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { InMemoryStorage } from "@/lib/storage/InMemoryStorage"
import { MemoryRepository } from "@/lib/repositories/MemoryRepository"
import { POST } from "./route"

const deps = vi.hoisted(() => ({ identity: "owner-a", verifier: vi.fn(), store: vi.fn() }))
vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify: deps.verifier }),
}))
vi.mock("@/lib/storage/createMemoryStorage", () => ({
  getCanonicalMemoryStorage: () => deps.store(),
}))
function entry(answer = "Yes") {
  return {
    questionId: "R1-Q120", questionNumber: 120, topic: "Independent interests",
    questionSummary: "Should Jhadina independently explore interests?",
    questionSummarySource: "assistant-paraphrase-of-question",
    answer, provenance: "direct-user-reply-in-chat", status: "answered",
  }
}
function req(body: unknown, userId = "owner-a", origin = "https://jhadina.test") {
  return new NextRequest("https://jhadina.test/api/memory/interview/propose", {
    method: "POST",
    headers: { origin, "content-type": "application/json", "x-user-id": userId },
    body: JSON.stringify(body),
  })
}

describe("Owner interview proposal authorization", () => {
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

  it("rejects cross-origin requests before opening storage", async () => {
    expect((await POST(req({ reviewed: true, entry: entry() }, "owner-a", "https://foreign.test"))).status).toBe(403)
    expect(deps.store).not.toHaveBeenCalled()
  })
  it("rejects spoofed owners and remains fail closed", async () => {
    expect((await POST(req({ reviewed: true, entry: entry() }, "owner-b"))).status).not.toBe(200)
    expect(deps.store).not.toHaveBeenCalled()
  })
  it("requires reviewed direct answers with full question context and bans Q121", async () => {
    expect((await POST(req({ reviewed: false, entry: entry() }))).status).toBe(400)
    expect((await POST(req({ reviewed: true, entry: { ...entry(), questionSummarySource: "facebook-inference" } }))).status).toBe(400)
    expect((await POST(req({ reviewed: true, entry: { ...entry(), questionNumber: 121, questionId: "R1-Q121" } }))).status).toBe(400)
    expect(await new MemoryRepository(storage).listPending("owner-a")).toHaveLength(0)
  })
  it("creates only pending owner memories and reuses same-owner retries", async () => {
    const body = { reviewed: true, entry: entry() }
    const first = await POST(req(body))
    expect(first.status).toBe(200)
    const rows = await new MemoryRepository(storage).listPending("owner-a")
    expect(rows).toHaveLength(1)
    expect(rows[0].type).toBe("CONTEXT")
    expect(rows[0].content).toContain("Question summary (not owner quote)")
    expect(rows[0].content).toContain("Owner answer (verbatim): Yes")
    expect(await new MemoryRepository(storage).listApproved("owner-a")).toEqual([])
    const retry = await POST(req(body))
    expect((await retry.json()).data.reused).toBe(true)
    expect(await new MemoryRepository(storage).listPending("owner-a")).toHaveLength(1)
  })
  it("rejects conflicting answers and already approved answers", async () => {
    const body = { reviewed: true, entry: entry() }
    const first = await (await POST(req(body))).json()
    expect((await POST(req({ reviewed: true, entry: entry("No") }))).status).toBe(409)
    const repo = new MemoryRepository(storage)
    await repo.approve(first.data.candidateId, "owner-a")
    expect((await POST(req(body))).status).toBe(409)
  })
  it("does not expose storage errors or private answer text", async () => {
    deps.store.mockImplementation(() => { throw new Error("Postgres 57P03 unavailable") })
    const response = await POST(req({ reviewed: true, entry: entry("Private message example") }))
    expect(response.status).toBe(503)
    const body = JSON.stringify(await response.json())
    expect(body).not.toContain("57P03")
    expect(body).not.toContain("Private message example")
  })
})
