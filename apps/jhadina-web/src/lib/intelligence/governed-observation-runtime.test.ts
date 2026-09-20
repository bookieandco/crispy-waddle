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


  it("uses verified session identity when no caller identity assertion is supplied", async () => {
    const ledger = new InMemoryActionLedger()
    const result = await observeShodanGoverned({ observationId: "obs-session", subjectId: "203.0.113.9", capability: "internetdb.read" }, {
      identityVerifier: { async verify(request?: { userId?: string }) { expect(request?.userId).toBeUndefined(); return { userId: "session-user", sessionId: "s2" } } } as any,
      ledger: ledger as any,
      now: () => "2026-09-20T00:00:00.000Z",
      http: async () => ({ ok: true, status: 200, async json() { return {} } }),
    })
    expect(result.verifiedUserId).toBe("session-user")
    expect(ledger.list()[0]?.userId).toBe("session-user")
  })

  it("fails before network access when a caller identity assertion mismatches the verified session", async () => {
    let networkCalls = 0
    await expect(observeShodanGoverned({ claimedUserId: "forged-user", observationId: "obs-mismatch", subjectId: "203.0.113.9", capability: "internetdb.read" }, {
      identityVerifier: { async verify() { throw new Error("Action identity mismatch") } } as any,
      ledger: new InMemoryActionLedger() as any,
      now: () => "2026-09-20T00:00:00.000Z",
      http: async () => { networkCalls++; return { ok: true, status: 200, async json() { return {} } } },
    })).rejects.toThrow(/identity mismatch/i)
    expect(networkCalls).toBe(0)
  })
