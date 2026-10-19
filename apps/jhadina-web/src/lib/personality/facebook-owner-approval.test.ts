import { describe, expect, it } from "vitest"
import type { WritingSample } from "./facebook-owner-import"
import {
  buildFacebookReviewCandidates,
  prepareFacebookReviewItem,
  eligibleFacebookReviewNotes,
  buildSelectedFacebookReviewDraft,
  formatFacebookReviewReceipt,
} from "./facebook-owner-approval"

const samples: WritingSample[] = Array.from({ length: 70 }, (_, index) => ({
  kind: index % 2 === 0 ? "post" : "comment",
  text: "SENSITIVE PRIVATE FACEBOOK TEXT " + index + " lol?! 😂",
  source: "PRIVATE/facebook/story_" + index + ".json",
  at: "2013-03-01T12:34:56Z",
}))

describe("FB-RELATE.APPROVAL.05–.08 local owner review", () => {
  it(".05 generates only fixed cue notes, never raw archive excerpts or filenames", () => {
    const cards = buildFacebookReviewCandidates(samples)
    expect(cards.length).toBeGreaterThan(1)
    expect(cards.every((card) => card.decision === "undecided")).toBe(true)
    expect(cards.every((card) => card.proposedNote.length >= 30)).toBe(true)
    expect(JSON.stringify(cards)).not.toMatch(/SENSITIVE PRIVATE FACEBOOK|story_|2013-03-01|PRIVATE\/facebook/)
    expect(buildFacebookReviewCandidates([])).toEqual([])
  })

  it(".06 supports explicit select/reject/edit with no approved or stored candidates", () => {
    const cards = buildFacebookReviewCandidates(samples)
    const selected = prepareFacebookReviewItem({
      id: cards[0].id,
      label: cards[0].label,
      note: "Owner's chosen wording: ask me directly, and do not imitate my old writing.",
      decision: "selected",
    })
    const rejected = prepareFacebookReviewItem({
      id: cards[1].id, label: cards[1].label, note: cards[1].proposedNote,
      decision: "rejected",
    })
    expect(selected?.decision).toBe("selected")
    expect(rejected?.decision).toBe("rejected")
    expect(eligibleFacebookReviewNotes([selected!, rejected!])).toEqual([selected!.note])
    const note = buildSelectedFacebookReviewDraft([selected!, rejected!])
    expect(note).toContain("Owner's chosen wording")
    expect(note).not.toContain(cards[1].proposedNote)
    expect(note.length).toBeLessThanOrEqual(900)
    expect(buildSelectedFacebookReviewDraft([rejected!])).toBe("")
    expect(prepareFacebookReviewItem({
      id: "unknown", label: "Unknown", note: cards[0].proposedNote, decision: "selected",
    })).toBeNull()
    expect(prepareFacebookReviewItem({
      id: cards[0].id, label: cards[0].label, note: "too short", decision: "selected",
    })).toBeNull()
  })

  it(".07 copies only numerical decision counts and never user-edited notes", () => {
    const candidates = buildFacebookReviewCandidates(samples)
    const items = candidates.map((card, i) => prepareFacebookReviewItem({
      id: card.id, label: card.label,
      note: "Owner selected wording SECRET_WRITING_" + i + ". Keep this private.",
      decision: i === 0 ? "selected" : i === 1 ? "rejected" : "undecided",
    })!)
    const payload = formatFacebookReviewReceipt(items, "selected")
    const receipt = JSON.parse(payload)
    expect(receipt.schema).toBe("FB-RELATE-LOCAL-REVIEW-v1")
    expect(receipt.writingCuesReviewed).toBe(items.length)
    expect(receipt.selectedWritingCues).toBe(1)
    expect(receipt.rejectedWritingCues).toBe(1)
    expect(receipt.interactionPreferenceDecision).toBe("selected")
    expect(receipt.memoryWritesByThisReceipt).toBe(0)
    expect(receipt.memoryApprovalStatus).toBe("not_verified_by_local_receipt")
    expect(receipt.rawFacebookWritingSentByThisReceipt).toBe(false)
    expect(payload).not.toMatch(/SECRET_WRITING|SENSITIVE|PRIVATE|source|story_/)
  })

  it(".08 drafts remain local until owner review; no automatic activation", () => {
    const cards = buildFacebookReviewCandidates(samples)
    const pending = cards.map((c) => prepareFacebookReviewItem({
      id: c.id, label: c.label, note: c.proposedNote, decision: "undecided",
    })!)
    expect(buildSelectedFacebookReviewDraft(pending)).toBe("")
    const selected = pending.map((p, i) =>
      i === 0 ? { ...p, decision: "selected" as const } : p)
    const draft = buildSelectedFacebookReviewDraft(selected)
    expect(draft.length).toBeGreaterThan(30)
    expect(draft).not.toContain(samples[0].text)
    expect(draft).toMatch(/not fixed traits or instructions/)
    expect(formatFacebookReviewReceipt(selected, "undecided")).toContain('"memoryApprovalStatus": "not_verified_by_local_receipt"')
  })
})
