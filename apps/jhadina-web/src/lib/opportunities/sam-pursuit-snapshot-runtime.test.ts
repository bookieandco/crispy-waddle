import { describe, expect, it } from "vitest"
import {
  buildSamGovernedPursuitPlan,
  createSamPursuitSnapshot,
  type SamPursuitSnapshotEnvelope,
  type SamPursuitSnapshotRepository,
} from "@jhadina/opportunity-core"
import { loadSamPursuitSnapshot, persistSamPursuitSnapshot } from "./sam-pursuit-snapshot-runtime"

function fixture(): SamPursuitSnapshotEnvelope {
  const requirements = {
    opportunityId: "sam:runtime",
    requirements: [],
    unresolved: [],
    generatedAt: "2026-09-20T00:00:00Z",
  }
  return createSamPursuitSnapshot({
    opportunityId: "sam:runtime",
    requirements,
    fulfillment: undefined,
    commercial: undefined,
    reconciliation: undefined,
    freshness: [],
    engagement: undefined,
    ledgers: [],
    negotiations: [],
    contractReadiness: [],
    contractDrafts: [],
    pursuit: buildSamGovernedPursuitPlan({ requirements }),
  }, 0, "2026-09-20T00:00:00Z")
}

describe("SAM pursuit snapshot runtime", () => {
  it("verifies a recovered snapshot", async () => {
    const envelope = fixture()
    const repo: SamPursuitSnapshotRepository = {
      load: async () => envelope,
      save: async () => undefined,
    }
    const snapshot = await loadSamPursuitSnapshot(repo, "sam:runtime")
    expect(snapshot?.opportunityId).toBe("sam:runtime")
  })

  it("refuses a tampered recovered snapshot", async () => {
    const envelope = fixture()
    const repo: SamPursuitSnapshotRepository = {
      load: async () => ({ ...envelope, checksum: "tampered" }),
      save: async () => undefined,
    }
    await expect(loadSamPursuitSnapshot(repo, "sam:runtime")).rejects.toThrow(/checksum mismatch/)
  })

  it("passes expected revision through the governed save contract", async () => {
    const envelope = fixture()
    let seen: number | null | undefined
    const repo: SamPursuitSnapshotRepository = {
      load: async () => null,
      save: async (_envelope, expectedRevision) => { seen = expectedRevision },
    }
    const snapshot = await persistSamPursuitSnapshot(repo, envelope, null)
    expect(seen).toBeNull()
    expect(snapshot.revision).toBe(1)
  })
})
