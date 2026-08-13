/**
 * Unit tests for the Opportunity Command Center's model and engine.
 *
 * Covers:
 * - rankSideIncomeOpportunities(): do_not_pursue filtering, fit/pay/risk/cost ordering
 * - opportunities engine: creation defaults, per-user listing, approve transitions
 */

import { describe, it, expect, beforeEach } from "vitest"
import { rankSideIncomeOpportunities } from "../lib/opportunities/sideIncome"
import type { Opportunity } from "../lib/opportunities/sideIncome"
import { approveOpportunity, createOpportunity, listOpportunities } from "../lib/opportunities/engine"

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
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

describe("rankSideIncomeOpportunities", () => {
  it("filters out do_not_pursue opportunities", () => {
    const items = [
      opp({ id: "keep", automationLevel: "ai_can_do_it" }),
      opp({ id: "drop", automationLevel: "do_not_pursue" }),
    ]
    const ranked = rankSideIncomeOpportunities(items)
    expect(ranked.map((o) => o.id)).toEqual(["keep"])
  })

  it("ranks higher fit score above lower fit score, all else equal", () => {
    const items = [
      opp({ id: "low", fitScore: 40 }),
      opp({ id: "high", fitScore: 90 }),
    ]
    const ranked = rankSideIncomeOpportunities(items)
    expect(ranked.map((o) => o.id)).toEqual(["high", "low"])
  })

  it("penalizes opportunities with more risk flags", () => {
    const items = [
      opp({ id: "risky", fitScore: 70, riskFlags: ["scam reports", "vague payout terms"] }),
      opp({ id: "clean", fitScore: 70, riskFlags: [] }),
    ]
    const ranked = rankSideIncomeOpportunities(items)
    expect(ranked.map((o) => o.id)).toEqual(["clean", "risky"])
  })

  it("does not mutate the input array", () => {
    const items = [opp({ id: "a", fitScore: 10 }), opp({ id: "b", fitScore: 90 })]
    const copy = [...items]
    rankSideIncomeOpportunities(items)
    expect(items).toEqual(copy)
  })
})

describe("opportunities engine", () => {
  beforeEach(() => {
    // Each test module gets a fresh in-memory Map since engine.ts holds
    // module-level state; there's no reset hook, so use distinct userIds
    // per test to avoid cross-test interference instead.
  })

  it("creates an opportunity with status 'new' and a generated id", () => {
    const userId = `user_create_${Math.random()}`
    const created = createOpportunity({
      userId,
      title: "Sell stickers",
      kind: "pod",
      sourceUrl: "https://example.com/stickers",
      sourceName: "Example Marketplace",
      summary: "Print-on-demand sticker shop.",
      automationLevel: "ai_plus_user",
      fitScore: 72,
    })
    expect(created.id).toMatch(/^opp_/)
    expect(created.status).toBe("new")
    expect(created.riskFlags).toEqual([])
    expect(created.requiresUserApproval).toBe(true)
  })

  it("only lists opportunities belonging to the requesting user", () => {
    const userA = `user_list_a_${Math.random()}`
    const userB = `user_list_b_${Math.random()}`
    createOpportunity({ userId: userA, title: "A1", kind: "freelance", sourceUrl: "https://x", sourceName: "X", summary: "s", automationLevel: "user_led", fitScore: 50 })
    createOpportunity({ userId: userB, title: "B1", kind: "freelance", sourceUrl: "https://x", sourceName: "X", summary: "s", automationLevel: "user_led", fitScore: 50 })

    expect(listOpportunities(userA)).toHaveLength(1)
    expect(listOpportunities(userA)[0].title).toBe("A1")
    expect(listOpportunities(userB)).toHaveLength(1)
    expect(listOpportunities(userB)[0].title).toBe("B1")
  })

  it("approves a new opportunity and stamps approvedAt", () => {
    const userId = `user_approve_${Math.random()}`
    const created = createOpportunity({ userId, title: "Approve me", kind: "ai_job", sourceUrl: "https://x", sourceName: "X", summary: "s", automationLevel: "ai_can_do_it", fitScore: 88 })

    const approved = approveOpportunity(userId, created.id)

    expect(approved).not.toBeNull()
    expect(approved?.status).toBe("approved")
    expect(approved?.approvedAt).toBeTruthy()
  })

  it("refuses to approve on behalf of a different user", () => {
    const owner = `user_owner_${Math.random()}`
    const created = createOpportunity({ userId: owner, title: "Not yours", kind: "ai_job", sourceUrl: "https://x", sourceName: "X", summary: "s", automationLevel: "ai_can_do_it", fitScore: 88 })

    const result = approveOpportunity("someone_else", created.id)

    expect(result).toBeNull()
  })

  it("refuses to approve an opportunity twice", () => {
    const userId = `user_twice_${Math.random()}`
    const created = createOpportunity({ userId, title: "Once only", kind: "ai_job", sourceUrl: "https://x", sourceName: "X", summary: "s", automationLevel: "ai_can_do_it", fitScore: 88 })

    approveOpportunity(userId, created.id)
    const second = approveOpportunity(userId, created.id)

    expect(second).toBeNull()
  })

  it("returns null when approving an unknown opportunity id", () => {
    expect(approveOpportunity("someone", "opp_does_not_exist")).toBeNull()
  })
})
