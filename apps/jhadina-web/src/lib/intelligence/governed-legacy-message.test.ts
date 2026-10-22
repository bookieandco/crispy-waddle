import { describe, expect, it } from "vitest"
import { InMemoryActionLedger, type ActionPolicy } from "@jhadina/action-core"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { ReasoningEventRepository } from "../repositories/ReasoningEventRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { processLegacyMessageGoverned } from "./governed-legacy-message"

function verifier(identity: ActionRequestIdentity): JhadinaIdentityVerifier {
  return {
    async verify(request: JhadinaActionRequest) {
      if (request.userId !== identity.userId) throw new Error("Action identity mismatch")
      return identity
    },
  }
}

describe("legacy /api/message governed compatibility bridge", () => {
  it("preserves classifier semantics while traversing Action Core and audit", async () => {
    const userId = "legacy-user"
    const storage = new InMemoryStorage()
    const ledger = new InMemoryActionLedger()
    const memoryRepo = new MemoryRepository(storage)

    const result = await processLegacyMessageGoverned(
      {
        identityVerifier: verifier({ userId, sessionId: "legacy-session" }),
        ledger,
        memoryRepo,
        reasoningRepo: new ReasoningEventRepository(storage),
        timelineRepo: new TimelineRepository(storage),
      },
      userId,
      "I prefer cinematic lighting",
    )

    expect(result.classification.type).toBe("PREFERENCE")
    expect(result.memoryCandidate.type).toBe("PREFERENCE")
    expect(result.memoryCandidate.status).toBe("PENDING")
    expect(result.response).toContain("stored as a preference")
    expect(await memoryRepo.listPending(userId)).toHaveLength(1)

    const trail = ledger.list()
    expect(trail.some((event) => event.status === "started")).toBe(true)
    expect(trail.some((event) => event.status === "completed")).toBe(true)
    expect(trail.every((event) => event.type === "memory.propose")).toBe(true)
  })

  it("rejects a mismatched claimed identity before classifier persistence or audit", async () => {
    const userId = "legacy-owner"
    const storage = new InMemoryStorage()
    const ledger = new InMemoryActionLedger()
    const memoryRepo = new MemoryRepository(storage)

    await expect(processLegacyMessageGoverned(
      {
        identityVerifier: verifier({ userId, sessionId: "legacy-session" }),
        ledger,
        memoryRepo,
        reasoningRepo: new ReasoningEventRepository(storage),
        timelineRepo: new TimelineRepository(storage),
      },
      "spoofed-user",
      "I prefer cinematic lighting",
    )).rejects.toThrow("Action identity mismatch")

    expect(ledger.list()).toHaveLength(0)
    expect(await memoryRepo.listPending(userId)).toHaveLength(0)
  })

  it("fails closed on policy denial without creating a candidate", async () => {
    const userId = "legacy-policy"
    const storage = new InMemoryStorage()
    const ledger = new InMemoryActionLedger()
    const memoryRepo = new MemoryRepository(storage)
    const policy: ActionPolicy = { async evaluate() { return "deny" } }

    await expect(processLegacyMessageGoverned(
      {
        identityVerifier: verifier({ userId, sessionId: "legacy-session" }),
        ledger,
        memoryRepo,
        reasoningRepo: new ReasoningEventRepository(storage),
        timelineRepo: new TimelineRepository(storage),
        policy,
      },
      userId,
      "I prefer cinematic lighting",
    )).rejects.toThrow("not allowed by policy")

    expect(await memoryRepo.listPending(userId)).toHaveLength(0)
    expect(ledger.list().some((event) => event.status === "denied")).toBe(true)
  })
})
