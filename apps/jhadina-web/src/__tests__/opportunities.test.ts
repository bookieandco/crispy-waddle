/**
 * Compatibility-view ranking tests for the Opportunity Command Center.
 * Canonical lifecycle, persistence, verification, pursuit, and outcome tests
 * live in @jhadina/opportunity-core.
 */

import { describe, it, expect } from "vitest"
import { rankSideIncomeOpportunities } from "../lib/opportunities/sideIncome"
import type { Opportunity } from "../lib/opportunities/sideIncome"

function opp(overrides: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "opp_test",
    userId: "user_1",
    title: "Test opportunity",
    kind: "freelance",
    sourceUrl: "https://example.com",
    sourceName: "Example",
    summary: "A test opportunity.",
    automationLevel: "user_led",
    fitScore: 50,
    riskFlags: [],
    requiresUserApproval: true,
    status: "new",
    triageState: "review",
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("rankSideIncomeOpportunities", () => {
  it("filters out do_not_pursue opportunities", () => {
    const ranked = rankSideIncomeOpportunities([
      opp({ id: "keep", automationLevel: "ai_can_do_it" }),
      opp({ id: "drop", automationLevel: "do_not_pursue" }),
    ])
    expect(ranked.map((item) => item.id)).toEqual(["keep"])
  })

  it("ranks higher fit above lower fit, all else equal", () => {
    const ranked = rankSideIncomeOpportunities([
      opp({ id: "low", fitScore: 40 }),
      opp({ id: "high", fitScore: 90 }),
    ])
    expect(ranked.map((item) => item.id)).toEqual(["high", "low"])
  })

  it("penalizes risk and startup cost", () => {
    const ranked = rankSideIncomeOpportunities([
      opp({ id: "risky", fitScore: 70, riskFlags: ["scam reports"], startupCost: 500 }),
      opp({ id: "clean", fitScore: 70, riskFlags: [], startupCost: 0 }),
    ])
    expect(ranked.map((item) => item.id)).toEqual(["clean", "risky"])
  })

  it("does not mutate input", () => {
    const items = [opp({ id: "a", fitScore: 10 }), opp({ id: "b", fitScore: 90 })]
    const copy = [...items]
    rankSideIncomeOpportunities(items)
    expect(items).toEqual(copy)
  })
})
