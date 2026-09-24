import { describe, expect, it } from "vitest"
import type { PatternExperimentEvidence } from "@jhadina/growth-core"
import { SupabasePatternExperimentEvidenceStore } from "./social-pattern-experiment-evidence-repository"

const evidence: PatternExperimentEvidence = {
  executionId: "execution:1" as never,
  experimentId: "pattern-experiment:hypothesis:1" as never,
  hypothesisId: "hypothesis:1" as never,
  targetAccountId: "account:target" as never,
  targetAudienceId: "audience:1" as never,
  targetVoiceId: "voice:1" as never,
  successMetric: "qualified_leads",
  controlMetric: 0.1,
  treatmentMetric: 0.12,
  controlObservations: 15,
  treatmentObservations: 15,
  observedAt: "2026-09-01T12:00:00.000Z",
  source: "experiment-execution",
}

describe("SupabasePatternExperimentEvidenceStore", () => {
  it("writes through the trusted RPC and reads the durable evidence", async () => {
    const rows = new Map<string, Record<string, unknown>>()
    const client = {
      rpc: async (_fn: string, args?: Record<string, unknown>) => {
        const payload = args?.payload as Record<string, unknown>
        rows.set(payload.execution_id as string, payload)
        return { data: null, error: null }
      },
      from: () => ({
        select: () => ({
          eq: (_column: string, value: string) => ({
            maybeSingle: async () => ({ data: rows.get(value) ?? null, error: null }),
          }),
        }),
      }),
    }

    const store = new SupabasePatternExperimentEvidenceStore(client)
    await store.put(evidence)
    await expect(store.getByExecutionId(evidence.executionId)).resolves.toEqual(evidence)
  })

  it("surfaces RPC failures instead of treating evidence as persisted", async () => {
    const client = {
      rpc: async () => ({ data: null, error: { message: "permission denied" } }),
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      }),
    }

    const store = new SupabasePatternExperimentEvidenceStore(client)
    await expect(store.put(evidence)).rejects.toThrow("experiment evidence insert failed: permission denied")
  })
})
