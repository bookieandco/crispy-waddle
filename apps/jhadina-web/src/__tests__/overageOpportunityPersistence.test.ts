import { describe, expect, it } from "vitest"
import { toOpportunityView } from "../lib/opportunities/canonical"
import { buildOverageOpportunity } from "../lib/opportunities/overageAdapter"

describe("Overage canonical handoff boundary", () => {
  it("preserves an unverified recovery candidate in the Opportunity Hub view without using the volatile engine", () => {
    const canonical = buildOverageOpportunity({
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
    })

    const view = toOpportunityView({
      userId: "00000000-0000-0000-0000-000000000001",
      opportunity: canonical,
      triageState: "review",
    })

    expect(view.kind).toBe("overage")
    expect(view.status).toBe("new")
    expect(view.requiresUserApproval).toBe(true)
    expect(view.verificationStatus).toBe("human_required")
    expect(view.sourceConfidence).toBe(0.8)
    expect(view.fitScore).toBe(50)
  })
})
