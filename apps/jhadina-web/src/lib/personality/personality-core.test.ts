import { describe, expect, it } from "vitest"
import {
  createPersonalityPort,
  emptyPersonalityState,
  projectPersonality,
  type MemoryProposal,
  type PatternObservation,
  type PersonalityStateRepository,
} from "@jhadina/core-spine"

const evidence = (id: string, source = "pattern-engine") => ({
  id,
  source,
  observedAt: "2026-09-02T00:00:00.000Z",
  summary: `evidence ${id}`,
  immutable: true,
})

function pattern(overrides: Partial<PatternObservation> = {}): PatternObservation {
  return {
    id: "pattern-1",
    pattern: "Jhadina prefers direct, action-oriented communication",
    evidence: [evidence("e1"), evidence("e2"), evidence("e3")],
    confidence: 0.9,
    occurrences: 3,
    contradictions: [],
    lastObservedAt: "2026-09-02T00:00:00.000Z",
    personalityEligible: true,
    personalityDimension: "communication",
    ...overrides,
  }
}

describe("Personality Core", () => {
  it("does not project arbitrary patterns into personality", () => {
    const next = projectPersonality(
      emptyPersonalityState("2026-09-02T00:00:00.000Z"),
      [pattern({ personalityEligible: false })],
      [],
      "2026-09-02T00:00:00.000Z",
      undefined,
      () => "trait-1",
    )

    expect(next.traits).toEqual([])
    expect(next.version).toBe(0)
  })

  it("keeps a new personality observation as a candidate until repeated evidence establishes it", () => {
    const next = projectPersonality(
      emptyPersonalityState("2026-09-02T00:00:00.000Z"),
      [pattern({ evidence: [evidence("e1")], occurrences: 1, confidence: 0.7 })],
      [],
      "2026-09-02T00:00:00.000Z",
      undefined,
      () => "trait-1",
    )

    expect(next.traits).toHaveLength(1)
    expect(next.traits[0].status).toBe("candidate")
    expect(next.traits[0].confidence).toBe(0.7)
  })

  it("accepts a personality trait only after sufficient evidence and confidence", () => {
    const next = projectPersonality(
      emptyPersonalityState("2026-09-02T00:00:00.000Z"),
      [pattern()],
      [],
      "2026-09-02T00:00:00.000Z",
      undefined,
      () => "trait-1",
    )

    expect(next.traits[0]).toMatchObject({
      id: "trait-1",
      status: "accepted",
      dimension: "communication",
      confidence: 0.9,
      stability: 1,
      revision: 0,
    })
    expect(next.independentAssessmentRequired).toBe(false)
  })

  it("marks a trait contested rather than silently replacing it when contradictory evidence appears", () => {
    const current = projectPersonality(
      emptyPersonalityState("2026-09-02T00:00:00.000Z"),
      [pattern()],
      [],
      "2026-09-02T00:00:00.000Z",
      undefined,
      () => "trait-1",
    )
    const next = projectPersonality(
      current,
      [pattern({ contradictions: [evidence("c1")], confidence: 0.9 })],
      [],
      "2026-09-02T00:01:00.000Z",
      undefined,
      () => "never-used",
    )

    expect(next.traits[0].id).toBe("trait-1")
    expect(next.traits[0].status).toBe("contested")
    expect(next.traits[0].contradictions).toHaveLength(1)
    expect(next.independentAssessmentRequired).toBe(true)
  })

  it("cannot use evidence sourced from an unapproved memory", () => {
    const memories: MemoryProposal[] = [
      {
        id: "memory-1",
        content: "unapproved",
        reason: "candidate",
        evidence: [evidence("memory-e1", "memory")],
        disposition: "PROPOSE",
      },
    ]
    const next = projectPersonality(
      emptyPersonalityState("2026-09-02T00:00:00.000Z"),
      [pattern({ evidence: [evidence("memory-e1", "memory")] })],
      memories,
      "2026-09-02T00:00:00.000Z",
      undefined,
      () => "trait-1",
    )

    expect(next.traits).toEqual([])
  })

  it("persists through the PersonalityPort repository boundary with optimistic versioning", async () => {
    let state = emptyPersonalityState("2026-09-02T00:00:00.000Z")
    const repository: PersonalityStateRepository = {
      load: async () => state,
      save: async (expectedVersion, next) => {
        expect(expectedVersion).toBe(state.version)
        state = next
      },
    }
    const port = createPersonalityPort(repository)

    const result = await port.build([pattern()], [])

    expect(result.version).toBe(1)
    expect(state.traits[0].status).toBe("accepted")
  })
})
