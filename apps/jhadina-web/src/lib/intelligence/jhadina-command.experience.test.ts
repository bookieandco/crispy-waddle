import { describe, expect, it } from "vitest"
import { handleJhadinaCommand } from "./jhadina-command"

function failingRecorder() {
  return {
    append: async () => {
      throw new Error("EXPERIENCE_STORE_UNAVAILABLE")
    },
  }
}

describe("Jhadina command Experience failure isolation", () => {
  it("does not convert an unexecuted decision into a command failure", async () => {
    const router = { decide: async () => ({
      id: "proposal-experience-isolation",
      contextId: "context-1",
      disposition: "ASK",
      recommendation: "ask",
      rationale: "needs clarification",
      evidence: [],
      uncertainty: [],
      alternatives: [],
    }) } as any

    const result = await handleJhadinaCommand(
      { userId: "user-1", activeTask: "test" },
      {
        router,
        identityVerifier: { verify: async ({ userId }: { userId: string }) => ({ userId }) } as any,
        ledger: { append: async () => ({ accepted: true, duplicate: false, eventId: "audit-1" }) } as any,
        experienceRecorder: failingRecorder(),
      },
    )

    expect(result.verified).toBe(true)
    expect(result.experienceRecorded).toBe(false)
  })
})
