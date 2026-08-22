import { describe, expect, it } from "vitest"
import { createOpportunity, listOpportunities } from "../lib/opportunities/engine"
import { buildOverageOpportunity } from "../lib/opportunities/overageAdapter"

describe("Overage opportunity persistence boundary", () => {
  it("persists one captured candidate without changing its verification boundary", () => {
    const candidate = {
      sourceKey: "washoe:2026",
      externalRecordId: "fixture-rec-001",
      sourceName: "Washoe County",
      sourceUrl: "https://example.test/washoe",
      recoveryFamily: "tax_sale_overage",
      amount: 1250.5,
      currency: "USD",
      claimantName: "Fixture Claimant",
      propertyReference: "FIXTURE-APN-123",
      sourceConfidence: 0.8,
      evidenceSummary: "Captured PDF and parsed record fixture.",
    }

    const userId = "fixture-user"
    const input = buildOverageOpportunity(candidate, userId)
    const stored = createOpportunity(input)
    const listed = listOpportunities(userId).find((opportunity) => opportunity.id === stored.id)

    expect(listed).toBeDefined()
    expect(listed?.kind).toBe("overage")
    expect(listed?.status).toBe("new")
    expect(listed?.requiresUserApproval).toBe(true)
    expect(listed?.verificationStatus).toBe("human_required")
    expect(listed?.sourceConfidence).toBe(0.8)
    expect(listed?.fitScore).toBe(50)
  })
})
