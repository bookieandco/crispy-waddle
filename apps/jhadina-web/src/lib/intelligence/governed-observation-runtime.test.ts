import { describe, expect, it } from "vitest"
import { InMemoryActionLedger } from "@jhadina/action-core"
import { observeShodanGoverned } from "./governed-observation-runtime"

describe("governed observation runtime", () => {
  it("verifies actor, performs passive read and writes canonical intelligence evidence without credential metadata", async () => {
    const ledger = new InMemoryActionLedger()
    const result = await observeShodanGoverned({
      claimedUserId: "alice",
      observationId: "obs-1",
      subjectId: "203.0.113.8",
      capability: "host.read",
      observedAt: "2026-09-19T00:00:00.000Z",
    }, {
      identityVerifier: { async verify() { return { userId: "alice", sessionId: "s1" } } } as any,
      ledger: ledger as any,
      apiKey: "secret-key",
      now: () => "2026-09-19T00:00:01.000Z",
      http: async () => ({ ok: true, status: 200, async json() { return { ports: [443] } } }),
    })
    expect(result.verifiedUserId).toBe("alice")
    expect(result.envelope.trustEffect).toBe("NONE")
    const serialized = JSON.stringify(ledger.list())
    expect(serialized).not.toContain("secret-key")
    expect(serialized).toContain("observation.shodan.host.read")
  })
})
