import { describe, expect, it } from "vitest"
import { deriveOwnerDeepWritingSignals } from "./facebook-owner-deep-signals"
import { makeDeepReviewItems, updateDeepReviewDecision, buildDeepProfileDraft, deepReviewReceipt } from "./facebook-owner-deep-profile"
import type { WritingSample } from "./facebook-owner-import"

const sample = (text: string): WritingSample => ({
  text, source: "owner/private-source-NEVER-DISCLOSE.json", kind: "comment", at: "2012-09-11T14:30:00Z",
})

describe("FB-RELATE.DEEP.06 owner-controlled local profile drafting", () => {
  const corpus = Array.from({ length: 60 }, (_, i) =>
    sample(i % 2 ? "Yeah right! LOL, first we tried, then we left the café." : "Nah, you're gonna see me later."))
  const signals = deriveOwnerDeepWritingSignals(corpus)

  it("defaults every candidate undecided and produces no draft until explicitly selected", () => {
    const fresh = makeDeepReviewItems(signals)
    expect(fresh.length).toBeGreaterThan(0)
    expect(fresh.every((x) => x.decision === "undecided")).toBe(true)
    expect(buildDeepProfileDraft(fresh, signals)).toBe("")
    expect(JSON.parse(deepReviewReceipt(fresh))).toMatchObject({
      schema: "FB-RELATE-DEEP-LOCAL-REVIEW-v1",
      selected: 0, savedMemories: 0, serverWrites: 0, approved: false,
    })
  })

  it("keeps only explicit selected fixed phrases and supports correction/reset", () => {
    const fresh = makeDeepReviewItems(signals)
    const selected = updateDeepReviewDecision(fresh, "self-marked-humor", "selected")
    const excluded = updateDeepReviewDecision(selected, "casual-diction", "rejected")
    const draft = buildDeepProfileDraft(excluded, signals)
    expect(draft).toContain("explicit laughter or joke markers")
    expect(draft).not.toContain("informal conversational word forms")
    expect(draft).not.toContain("Yeah right!")
    expect(draft).not.toContain("café")
    expect(draft.length).toBeLessThanOrEqual(900)
    expect(JSON.parse(deepReviewReceipt(excluded))).toMatchObject({ selected: 1, rejected: 1, serverWrites: 0 })
    const corrected = updateDeepReviewDecision(excluded, "self-marked-humor", "rejected")
    expect(buildDeepProfileDraft(corrected, signals)).toBe("")
    expect(buildDeepProfileDraft(makeDeepReviewItems(signals), signals)).toBe("")
  })

  it("ignores unknown, duplicate and non-evidenced selections", () => {
    const items = makeDeepReviewItems(signals)
    const chosen = updateDeepReviewDecision(items, "self-marked-humor", "selected")
    const ghost = [
      ...chosen,
      { id: "self-marked-humor" as const, decision: "selected" as const },
      { id: "made-up-id" as typeof chosen[0]["id"], decision: "selected" as const },
    ]
    expect(buildDeepProfileDraft(ghost, signals)).toBe(buildDeepProfileDraft(chosen, signals))
    expect(JSON.parse(deepReviewReceipt(ghost)).selected).toBe(1)
    const missingEvidence = buildDeepProfileDraft(chosen, [])
    expect(missingEvidence).toBe("")
    expect(JSON.stringify(ghost)).not.toContain("private-source-NEVER-DISCLOSE")
  })

  it("bounds notes to 900 chars and never adds raw evidence or communication instructions", () => {
    const selected = makeDeepReviewItems(signals).map((item) => ({ ...item, decision: "selected" as const }))
    const note = buildDeepProfileDraft(selected, signals)
    expect(note.length).toBeLessThanOrEqual(900)
    expect(note).not.toMatch(/private-source-NEVER-DISCLOSE|2012-09-11|Yeah right!|café/i)
    expect(note).toContain("not fixed traits")
    expect(note).toContain("not fixed traits, confirmed humor, or instructions to Jhadina")
    expect(note).not.toMatch(/You must|Jhadina should speak/i)
  })
})
