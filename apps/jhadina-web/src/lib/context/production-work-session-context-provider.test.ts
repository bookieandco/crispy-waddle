import { describe, expect, it } from "vitest"
import type { JhadinaWorkSession, WorkSessionRepository } from "@jhadina/core-spine"
import { ProductionWorkSessionContextProvider } from "./production-work-session-context-provider"

function session(overrides: Partial<JhadinaWorkSession> = {}): JhadinaWorkSession {
  return {
    id: "ws-1",
    ownerUserId: "user-1",
    goal: "Finish JLLM integration",
    status: "active",
    activeSubsystems: ["jllm", "social"],
    artifactRefs: [
      { id: "artifact-clean", kind: "image", provenanceRef: "artifact:clean", admitted: true },
      { id: "artifact-pending", kind: "document", provenanceRef: "artifact:pending", admitted: false },
    ],
    decisionRefs: ["decision-1"],
    outputRefs: ["output-1"],
    createdAt: "2026-09-22T12:00:00.000Z",
    updatedAt: "2026-09-22T12:05:00.000Z",
    ...overrides,
  }
}

function repository(value: JhadinaWorkSession | null): WorkSessionRepository {
  return {
    get: async () => value,
    save: async () => undefined,
  }
}

describe("ProductionWorkSessionContextProvider", () => {
  it("returns an owner-scoped bounded session snapshot and provenance evidence", async () => {
    const provider = new ProductionWorkSessionContextProvider({ repository: repository(session()) })
    const result = await provider.getContext({ userId: "user-1", workSessionId: "ws-1" })

    expect(result.workSession).toMatchObject({
      id: "ws-1",
      goal: "Finish JLLM integration",
      status: "active",
      activeSubsystems: ["jllm", "social"],
      decisionRefs: ["decision-1"],
      outputRefs: ["output-1"],
    })
    expect(result.workSession?.evidence).toEqual([
      expect.objectContaining({
        id: "work-session:ws-1",
        source: "work-session",
      }),
    ])
    expect(result.limitations).toContain(
      "1 non-admitted WorkSession artifact reference(s) remain identifiers only and are not model content",
    )
  })

  it("redacts secret-like text from the session goal before model context", async () => {
    const provider = new ProductionWorkSessionContextProvider({
      repository: repository(session({ goal: "Use sk_test_abcdefghijklmnop for the checkout task" })),
    })
    const result = await provider.getContext({ userId: "user-1", workSessionId: "ws-1" })

    expect(result.workSession?.goal).not.toContain("sk_test_abcdefghijklmnop")
    expect(result.workSession?.goal).toContain("[REDACTED]")
    expect(result.limitations.some((item) => item.includes("redacted"))).toBe(true)
  })

  it("fails closed on an owner mismatch even with an injected repository", async () => {
    const provider = new ProductionWorkSessionContextProvider({
      repository: repository(session({ ownerUserId: "user-2" })),
    })
    const result = await provider.getContext({ userId: "user-1", workSessionId: "ws-1" })

    expect(result.workSession).toBeUndefined()
    expect(result.limitations).toContain(
      "requested WorkSession did not belong to the authenticated owner",
    )
  })

  it("reports a missing session instead of inventing continuity", async () => {
    const provider = new ProductionWorkSessionContextProvider({ repository: repository(null) })
    const result = await provider.getContext({ userId: "user-1", workSessionId: "missing" })

    expect(result.workSession).toBeUndefined()
    expect(result.limitations).toContain(
      "requested WorkSession was not found for the authenticated owner",
    )
  })
})
