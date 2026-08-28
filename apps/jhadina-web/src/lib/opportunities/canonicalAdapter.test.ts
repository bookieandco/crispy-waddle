import { describe, expect, it } from "vitest"
import { legacyToCanonicalOpportunity } from "./canonicalAdapter"

const legacy = {
  id: "opp-1", userId: "user-1", title: "AI automation", kind: "automation", sourceUrl: "https://example.com", sourceName: "Example", summary: "Automate a recurring business task", estimatedPay: { min: 500, max: 1500, currency: "USD", cadence: "per_project" as const }, startupCost: 20, estimatedHours: 4, automationLevel: "ai_plus_user" as const, fitScore: 82, riskFlags: [], deadline: "2026-09-01T00:00:00Z", requiresUserApproval: true, sourceConfidence: .9, status: "new" as const, createdAt: "2026-08-28T00:00:00Z"
}

describe("legacyToCanonicalOpportunity", () => {
  it("maps legacy opportunities without changing their identity", () => {
    const result = legacyToCanonicalOpportunity(legacy)
    expect(result.id).toBe(legacy.id)
    expect(result.userId).toBe(legacy.userId)
    expect(result.source.type).toBe("local_business")
    expect(result.economics.estimatedRevenue).toEqual({ min: 500, max: 1500 })
    expect(result.score).toEqual({ overall: 82, confidence: .9 })
    expect(result.status).toBe("discovered")
    expect(result.requiresApproval).toBe(true)
  })
})
