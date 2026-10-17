import { describe, expect, it } from "vitest"
import { buildOwnerWritingProfileDraft, deriveOwnerWritingSignals, selectedOwnerWritingNote } from "./facebook-owner-signals"
import type { WritingSample } from "./facebook-owner-import"

function sample(text: string, index: number): WritingSample {
  return { kind: index % 2 ? "comment" : "post", source: "posts/your_posts_1.json", text, at: "2026-04-01T12:00:00Z" }
}

describe("Facebook owner writing cues", () => {
  it("does not claim recurring cues from fewer than ten entries", () => {
    expect(deriveOwnerWritingSignals([sample("LOL!", 0)])).toEqual([])
  })

  it("counts only observable cues, not inferred ethnicity, religion, politics or diagnosis", () => {
    const samples = Array.from({ length: 30 }, (_, i) => sample(i < 12 ? "Why is this funny? lol 😂!" : "Working on the next video idea.", i))
    const signals = deriveOwnerWritingSignals(samples)
    expect(signals.find((s) => s.id === "questions")).toMatchObject({ count: 12, denominator: 30, confidence: "limited" })
    expect(signals.find((s) => s.id === "laugh-markers")?.count).toBe(12)
    const draft = buildOwnerWritingProfileDraft(samples, signals)
    expect(draft).toContain("Owner-reviewed observation")
    expect(draft).toContain("provisional observations")
    expect(draft).not.toMatch(/ethnicity|religion|party member|medical diagnosis|likely depressed/)
    expect(draft).not.toContain("Working on the next video idea.")
  })

  it("lets the owner omit an observation while keeping no raw quotes", () => {
    const samples = Array.from({ length: 10 }, (_, i) => sample(i < 5 ? "LOL!!!" : "What happened today?", i))
    const text = selectedOwnerWritingNote(samples, ["questions"])
    expect(text).toContain("question-led phrasing")
    expect(text).not.toContain("written laughter")
    expect(text).not.toContain("LOL!!!")
    expect(text.length).toBeLessThanOrEqual(900)
  })

  it("separately records post/comment coverage without asserting stable personality", () => {
    const samples = Array.from({ length: 55 }, (_, i) => sample("Another brief social comment.", i))
    const signals = deriveOwnerWritingSignals(samples)
    expect(signals.find((s) => s.id === "short-entries")?.confidence).toBe("moderate")
    const text = buildOwnerWritingProfileDraft(samples, signals)
    expect(text).toContain("28 posts; 27 comments")
    expect(text).toContain("not stable personality traits")
  })
})
