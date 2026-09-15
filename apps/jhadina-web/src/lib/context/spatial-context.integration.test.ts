import { describe, it, expect } from "vitest"
import { MemoryRepository } from "../repositories/MemoryRepository"
import { TimelineRepository } from "../repositories/TimelineRepository"
import { InMemoryStorage } from "../storage/InMemoryStorage"
import { buildContext, type ContextBuilderDeps, type SpatialContextProvider } from "./context-builder"

function freshDeps(): ContextBuilderDeps {
  const storage = new InMemoryStorage()
  return {
    memoryRepo: new MemoryRepository(storage),
    timelineRepo: new TimelineRepository(storage),
  }
}

const spatialProvider: SpatialContextProvider = {
  async getContext() {
    return {
      observations: [{ id: "obs-1", source: "gev", observedAt: "2026-09-14T18:00:00Z", summary: "aircraft observation", immutable: true }],
      evidence: [{ id: "ev-1", source: "gev", observedAt: "2026-09-14T18:00:00Z", summary: "immutable source evidence", immutable: true }],
      claims: [{ id: "claim-1", source: "spatial-claims", observedAt: "2026-09-14T18:00:00Z", summary: "claim candidate", immutable: true }],
      reality: [{ id: "reality-1", source: "spatial-reality", observedAt: "2026-09-14T18:00:00Z", summary: "admitted reality", immutable: true }],
      attention: [{ id: "attention-1", source: "spatial-attention", observedAt: "2026-09-14T18:00:00Z", summary: "relevant change", immutable: true }],
      conflicts: ["conflict-1"],
      uncertainty: ["source cadence is intermittent"],
      limitations: ["coverage is bounded"],
      provenance: [{ id: "prov-1", source: "gev", observedAt: "2026-09-14T18:00:00Z", summary: "provider provenance", immutable: true }],
    }
  },
}

describe("Context Builder spatial integration", () => {
  it("omits spatial context when no spatial provider is configured", async () => {
    const assembled = await buildContext(freshDeps(), { userId: "u1", activeTask: "what is happening nearby" })
    expect(assembled.contextPacket.domainContext).toBeUndefined()
  })

  it("attaches a provider contribution under the canonical domainContext boundary", async () => {
    const deps = freshDeps()
    deps.spatialContextProvider = spatialProvider
    const assembled = await buildContext(deps, {
      userId: "u2",
      activeTask: "what is happening nearby",
      geographicScope: { type: "region", id: "test-region" },
      temporalScope: { from: null, to: null, asOf: "2026-09-14T18:00:00Z" },
    })

    expect(assembled.contextPacket.domainContext?.spatial?.observations[0].id).toBe("obs-1")
    expect(assembled.contextPacket.domainContext?.spatial?.reality[0].id).toBe("reality-1")
    expect(assembled.contextPacket.domainContext?.spatial?.conflicts).toEqual(["conflict-1"])
    expect(assembled.contextPacket.domainContext?.spatial?.limitations).toEqual(["coverage is bounded"])
  })

  it("copies provider arrays so the assembled packet cannot mutate provider-owned state", async () => {
    const deps = freshDeps()
    deps.spatialContextProvider = spatialProvider
    const assembled = await buildContext(deps, { userId: "u3", activeTask: "observe" })
    const spatial = assembled.contextPacket.domainContext!.spatial!

    spatial.conflicts.push("local-only")
    spatial.observations[0].summary = "local mutation"

    const again = await spatialProvider.getContext({ userId: "u3", activeTask: "observe" })
    expect(again!.conflicts).toEqual(["conflict-1"])
    expect(again!.observations[0].summary).toBe("aircraft observation")
  })
})
