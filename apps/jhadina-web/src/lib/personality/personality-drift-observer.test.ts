import { describe, expect, it } from "vitest"
import {
  emptyPersonalityState,
  type BehavioralKernelContext,
} from "@jhadina/core-spine"
import { realizeGovernedExpression } from "@jhadina/intelligence-core"
import { recordPersonalityDriftObservation } from "./personality-drift-observer"

function fakeClient() {
  const rows: Record<string, unknown>[] = []
  const client = {
    from(table: string) {
      if (table !== "jhadina_personality_drift_receipts") throw new Error("unexpected table")
      return {
        select() {
          return {
            eq() {
              return {
                order() {
                  return {
                    limit: async () => ({
                      data: rows.map((row) => ({
                        expected: row.expected,
                        observed: row.observed,
                      })),
                      error: null,
                    }),
                  }
                },
              }
            },
          }
        },
        async upsert(row: Record<string, unknown>) {
          rows.push(row)
          return { error: null }
        },
      }
    },
  }
  return { client, rows }
}

describe("production personality drift observer", () => {
  it("persists an observation-only expected/observed pair without mutating Personality", async () => {
    const fake = fakeClient()
    const personality = emptyPersonalityState("2026-09-22T20:00:00.000Z")
    const before = structuredClone(personality)
    const proposal = {
      id: "proposal-1",
      contextId: "context-1",
      disposition: "PROCEED" as const,
      recommendation: "Proceed with the verified result.",
      rationale: "verified",
      evidence: [],
      uncertainty: [],
      alternatives: [],
    }
    const realization = realizeGovernedExpression(proposal, {
      mode: "serious",
      allowProfanity: false,
      allowQuip: false,
      responseLength: "brief",
      tone: "formal",
      reasoningDepth: "technical",
    })
    const behaviorContext: BehavioralKernelContext = {
      serious: true,
      requiresPrecision: true,
    }

    const result = await recordPersonalityDriftObservation({
      userId: "user-1",
      requestId: proposal.id,
      personality,
      behaviorContext,
      realization,
    }, fake.client as never)

    expect(result.recorded).toBe(true)
    expect(result.assessment?.authority).toBe("observation_only")
    expect(fake.rows).toHaveLength(1)
    expect(fake.rows[0]).toMatchObject({
      user_id: "user-1",
      request_id: "proposal-1",
      authority: "observation_only",
    })
    expect(personality).toEqual(before)
  })

  it("does not block response delivery when drift persistence is unavailable", async () => {
    const proposal = {
      id: "proposal-2",
      contextId: "context-2",
      disposition: "PROCEED" as const,
      recommendation: "Answer.",
      rationale: "test",
      evidence: [],
      uncertainty: [],
      alternatives: [],
    }
    const result = await recordPersonalityDriftObservation({
      userId: "user-1",
      requestId: proposal.id,
      personality: emptyPersonalityState(),
      behaviorContext: {},
      realization: realizeGovernedExpression(proposal),
    }, null)

    expect(result.recorded).toBe(false)
    expect(result.limitation).toContain("unavailable")
  })
})
