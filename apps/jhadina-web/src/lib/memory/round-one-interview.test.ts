import { describe, expect, it } from "vitest"
import { mergeRoundOneLedgers, parseRoundOneEntry, parseRoundOneLedger, roundOneMemoryContent } from "./round-one-interview"
const valid = {
  schemaVersion: "jhadina.interview.round1.v1", round: 1, status: "closed",
  closedAfterQuestion: 120, source: "owner-chat-answers",
  entries: [{ questionId: "R1-Q120", questionNumber: 120, topic: "Individual interests",
    answer: "Yes", questionSummary: "Should Jhadina independently explore subjects?",
    questionSummarySource: "assistant-paraphrase-of-question",
    provenance: "direct-user-reply-in-chat", status: "answered" }],
}
describe("Round 1 owner-controlled memory import", () => {
  it("parses a closed archive without creating approvals or changing PersonalityState", () => {
    const ledger = parseRoundOneLedger(valid)
    expect(ledger.entries).toHaveLength(1)
    expect(roundOneMemoryContent(ledger.entries[0])).toContain("Question summary (not owner quote): Should Jhadina independently explore subjects? Owner answer (verbatim): Yes")
  })
  it("keeps unrecovered questions absent, rather than fabricating them", () => {
    expect(parseRoundOneLedger(valid).entries.map(e => e.questionNumber)).toEqual([120])
  })
  it("refuses the next round's unanswered question", () => {
    expect(() => parseRoundOneEntry({ ...valid.entries[0], questionNumber: 121, questionId: "R1-Q121" })).toThrow()
  })
  it("refuses duplicate and misnumbered answers", () => {
    expect(() => parseRoundOneLedger({ ...valid, entries: [...valid.entries, valid.entries[0]] })).toThrow(/Duplicate/)
    expect(() => parseRoundOneEntry({ ...valid.entries[0], questionId: "R1-Q119" })).toThrow()
  })
  it("refuses unverified provenance, active rounds, and unbounded data", () => {
    expect(() => parseRoundOneEntry({ ...valid.entries[0], provenance: "facebook-inference" })).toThrow()
    expect(() => parseRoundOneEntry({ ...valid.entries[0], questionSummarySource: "facebook-inference" })).toThrow()
    expect(() => parseRoundOneLedger({ ...valid, status: "active" })).toThrow()
    expect(() => parseRoundOneEntry({ ...valid.entries[0], answer: "x".repeat(751) })).toThrow()
  })
  it("combines separately recovered ranges into one sorted owner review", () => {
    const early = { ...valid, entries: [
      { ...valid.entries[0], questionNumber: 2, questionId: "R1-Q002", topic: "Communication" },
      { ...valid.entries[0], questionNumber: 1, questionId: "R1-Q001", topic: "Conversation" },
    ] }
    const merged = mergeRoundOneLedgers([valid, early])
    expect(merged.entries.map(entry => entry.questionNumber)).toEqual([1, 2, 120])
    expect(mergeRoundOneLedgers([early, valid])).toEqual(merged)
  })
  it("deduplicates identical private answers and rejects conflicting duplicates", () => {
    expect(mergeRoundOneLedgers([valid, valid]).entries).toHaveLength(1)
    const conflict = { ...valid, entries: [{ ...valid.entries[0], answer: "No" }] }
    expect(() => mergeRoundOneLedgers([valid, conflict])).toThrow(/Conflicting private answers/)
  })
  it("refuses invalid extra archives before merging", () => {
    expect(() => mergeRoundOneLedgers([])).toThrow()
    expect(() => mergeRoundOneLedgers(new Array(6).fill(valid))).toThrow()
    expect(() => mergeRoundOneLedgers([valid, { ...valid, status: "active" }])).toThrow()
  })

})
