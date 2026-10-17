import { describe, expect, it } from "vitest"
import { summarizePolls, type PollRecord } from "./polling"

const poll = (n: number, overrides: Partial<PollRecord> = {}): PollRecord => ({
  id: `p${n}`, pollster: `Pollster ${n}`, fieldStart: `2026-10-${String(n).padStart(2,"0")}`,
  fieldEnd: `2026-10-${String(n).padStart(2,"0")}`, geography: "National", candidate: "Candidate",
  population: "adults", sampleSize: 100, support: 40, sourceUrl: `https://polls.test/study/${n}`, ...overrides,
})
const summary = (rows: PollRecord[]) => summarizePolls(rows, "Candidate", "National", "2026-10-17")

describe("descriptive polling without invented certainty", () => {
  it("does not invent support or direction without evidence", () => {
    expect(summary([])).toMatchObject({ averageSupport: null, direction: "insufficient_data" })
  })
  it("does not compare an observation to itself", () => {
    expect(summary([poll(1)])).toMatchObject({ averageSupport: 40, direction: "insufficient_data" })
  })
  it("computes the sample-weighted average without mutating input", () => {
    const rows = [poll(2, { support: 60, sampleSize: 300 }), poll(1)]
    expect(summary(rows).averageSupport).toBe(55)
    expect(rows[0].id).toBe("p2")
  })
  it.each([NaN, Infinity, -1, 101])("rejects invalid support %s", support => {
    expect(summary([poll(1, { support })]).averageSupport).toBeNull()
  })
  it.each([0, -1, NaN, Infinity, 1.5])("rejects invalid sample size %s", sampleSize => {
    expect(summary([poll(1, { sampleSize })]).pollCount).toBe(0)
  })
  it("rejects invalid dates, reversed periods and future polls", () => {
    expect(summary([poll(1, { fieldStart: "2026-02-30" }), poll(2, { fieldStart: "2026-10-03" }), poll(31)]).pollCount).toBe(0)
  })
  it("excludes unsafe, missing and example URLs", () => {
    expect(summary([poll(1, { sourceUrl: "javascript:alert(1)" }), poll(2, { sourceUrl: "https://example.com" }), poll(3, { sourceUrl: "" })]).pollCount).toBe(0)
  })
  it("deduplicates IDs and the same source/sample under another ID", () => {
    expect(summary([poll(1), poll(1, { support: 99 }), poll(1, { id: "other", sourceUrl: "https://polls.test/study/1#table" })]).pollCount).toBe(1)
  })
  it("does not pool different surveyed populations", () => {
    expect(summary([poll(1), poll(2, { population: "likely_voters" })]).averageSupport).toBeNull()
  })
  it("keeps other candidates and geographies out of the summary", () => {
    expect(summary([poll(1), poll(2, { candidate: "Other" }), poll(3, { geography: "Elsewhere" })]).pollCount).toBe(1)
  })
  it("requires disjoint comparison periods and never calls count high confidence", () => {
    const rows = Array.from({ length: 8 }, (_, i) => poll(i + 1, { support: i < 5 ? 40 : 45 }))
    expect(summary(rows)).toMatchObject({ direction: "up", confidence: "low" })
    rows[5].fieldStart = "2026-10-01"
    expect(summary(rows).direction).toBe("insufficient_data")
  })
  it("labels old data and invalid as-of dates", () => {
    expect(summarizePolls([poll(1)], "Candidate", "National", "2026-12-01").warning).toContain("historical")
    expect(summarizePolls([poll(1)], "Candidate", "National", "bad").averageSupport).toBeNull()
  })
})
