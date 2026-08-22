import { describe, expect, it } from "vitest"
import type { Experience } from "@jhadina/core-spine"
import { buildContext } from "./context-builder"
import { redactContextText } from "./redact"

const experience: Experience = {
  id: "exp_1",
  occurredAt: "2026-08-22T12:00:00.000Z",
  source: "test",
  actor: "user",
  content: "Help me remember my music project",
  evidence: [],
}

describe("context builder", () => {
  it("builds an empty but valid bounded packet", () => {
    const packet = buildContext({ purpose: "answer", experience })
    expect(packet.id).toMatch(/^ctx_/)
    expect(packet.relevantMemories).toEqual([])
    expect(packet.patterns).toEqual([])
    expect(packet.personality.independentAssessmentRequired).toBe(true)
    expect(packet.excludedContext).toContain("patterns unavailable: PatternPort not implemented")
  })

  it("ranks relevant memories before unrelated memories", () => {
    const packet = buildContext({
      purpose: "answer",
      experience,
      memories: [
        { id: "unrelated", content: "I like cooking on Sundays", createdAt: "2026-08-22T11:00:00Z" },
        { id: "relevant", content: "My music project is called Atwood", createdAt: "2026-08-21T11:00:00Z" },
      ],
    })
    expect(packet.relevantMemories[0]?.id).toBe("relevant")
  })

  it("applies item and character bounds deterministically", () => {
    const packet = buildContext({
      purpose: "answer",
      experience,
      maxItems: 2,
      maxCharacters: 20,
      memories: [
        { id: "a", content: "one", createdAt: "2026-08-22T10:00:00Z" },
        { id: "b", content: "two", createdAt: "2026-08-22T09:00:00Z" },
        { id: "c", content: "three", createdAt: "2026-08-22T08:00:00Z" },
      ],
    })
    expect(packet.relevantMemories.length).toBeLessThanOrEqual(2)
    expect(packet.excludedContext.length).toBeGreaterThan(0)
  })

  it("records missing surface and unavailable pattern/personality sources", () => {
    const packet = buildContext({ purpose: "answer", experience })
    expect(packet.excludedContext).toEqual(expect.arrayContaining([
      "surface.world unavailable",
      "surface.route unavailable",
      "surface.project unavailable",
      "patterns unavailable: PatternPort not implemented",
      "personality unavailable: PersonalityPort not implemented",
    ]))
  })

  it("redacts credentials before context construction", () => {
    expect(redactContextText("token=secret-value Bearer abc123 sk_test_123")).toBe(
      "[REDACTED] [REDACTED] [REDACTED]",
    )
    const packet = buildContext({
      purpose: "answer",
      experience,
      userGoal: "Use api_key=hidden to answer",
      memories: [{ id: "secret", content: "Bearer abc123", createdAt: "2026-08-22T10:00:00Z" }],
    })
    expect(JSON.stringify(packet)).not.toContain("abc123")
    expect(JSON.stringify(packet)).not.toContain("hidden")
  })
})
