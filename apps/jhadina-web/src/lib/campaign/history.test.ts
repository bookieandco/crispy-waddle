import { describe, expect, it } from "vitest"
import {
  auditHistoryCases, HISTORY_CASES, HISTORY_GUARDRAILS, HISTORY_SOURCES,
  CIVIC_REFERENCE_NOTES, historySourcesForClaim, type HistoricalCase, type ReferenceSource,
} from "./history"

describe("JH-CAMPAIGN.HISTORY.01–.08", () => {
  it("accepts three bounded, sourced historical case studies", () => {
    expect(HISTORY_CASES.map(item => item.id)).toEqual(["weimar", "montgomery", "suffrage"])
    expect(auditHistoryCases(HISTORY_CASES)).toEqual([])
  })
  it("keeps Nazi takeover historical warning distinct from nonviolent civic change", () => {
    expect(HISTORY_CASES.find(item => item.id === "weimar")?.frame).toBe("DEMOCRATIC_COLLAPSE")
    expect(HISTORY_CASES.filter(item => item.frame === "CIVIC_CHANGE")).toHaveLength(2)
    expect(HISTORY_GUARDRAILS.join(" ")).toContain("No deception")
    expect(HISTORY_GUARDRAILS.join(" ")).toContain("No voter profiling")
  })
  it("requires supporting source and contextual limitation for every claim", () => {
    for (const item of HISTORY_CASES) for (const claim of item.claims) {
      expect(claim.sourceIds.length).toBeGreaterThan(0)
      expect(historySourcesForClaim(claim)).toHaveLength(new Set(claim.sourceIds).size)
      expect(claim.limitation.length).toBeGreaterThan(15)
    }
  })
  it("flags broken reference provenance, unsupported and duplicate evidence", () => {
    const base = HISTORY_CASES[0]
    const bad: HistoricalCase = { ...base, claims:[
      { ...base.claims[0], sourceIds:["missing"] },
      { ...base.claims[0], id:"second", sourceIds:[] },
      { ...base.claims[0], text:"", id:base.claims[0].id }
    ]}
    const problems = auditHistoryCases([bad])
    expect(problems).toContain("unknown-source:weimar-election:missing")
    expect(problems).toContain("unsupported-claim:second")
    expect(problems).toContain("duplicate-or-empty-claim:weimar-election")
    expect(problems).toContain("incomplete-claim:weimar-election")
  })
  it("rejects duplicate cases and omitted accountability fields", () => {
    const bad: HistoricalCase = { ...HISTORY_CASES[0], context:"" }
    const problems = auditHistoryCases([bad,bad])
    expect(problems).toContain("duplicate-case:weimar")
    expect(problems).toContain("incomplete-case:weimar")
  })
  it("requires HTTPS provenance and a review date", () => {
    const bad: ReferenceSource = { ...HISTORY_SOURCES[0], url:"http://example.test", reviewedAt:"invalid" }
    expect(auditHistoryCases([], [bad])).toEqual(expect.arrayContaining([
      "non-https-source:ushmm-rise",
      "missing-review-date:ushmm-rise"
    ]))
  })
  it("keeps historical research separated from current election compliance", () => {
    const current = HISTORY_SOURCES.filter(source => source.scope === "CURRENT_OFFICIAL_GUIDANCE")
    expect(current.map(source => source.sourceFamily).sort()).toEqual(["FEC","IRS","NARA"])
    expect(CIVIC_REFERENCE_NOTES).toHaveLength(3)
    for (const note of CIVIC_REFERENCE_NOTES) {
      expect(current.some(source => source.id === note.sourceId)).toBe(true)
    }
  })
  it("does not compute electoral probabilities, rank candidates or run outreach", () => {
    const serialized = JSON.stringify({ HISTORY_CASES, HISTORY_SOURCES })
    expect(serialized).not.toContain("winProbability")
    expect(serialized).not.toContain("voterSegment")
    expect(serialized).not.toContain("dispatchCampaign")
    expect(serialized).not.toContain("syntheticAudience")
  })
})
