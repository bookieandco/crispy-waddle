import { describe, expect, it } from "vitest"
import { buildOverageOpportunity } from "../lib/opportunities/overageAdapter"

describe("buildOverageOpportunity", () => {
  const candidate = {
    sourceKey: "washoe:2026",
    externalRecordId: "rec-001",
    sourceName: "Washoe County",
    sourceUrl: "https://example.test/washoe",
    recoveryFamily: "tax_sale_overage",
    amount: 1250.5,
    currency: "USD",
    claimantName: "Jane Doe",
    propertyReference: "APN-123",
    sourceConfidence: 0.8,
    evidenceSummary: "Captured PDF and parsed record.",
  }

  it("maps an overage candidate to a reviewable Jhadina opportunity", () => {
    const opportunity = buildOverageOpportunity(candidate, "user_1")

    expect(opportunity.kind).toBe("overage")
    expect(opportunity.userId).toBe("user_1")
    expect(opportunity.estimatedPay?.max).toBe(1250.5)
    expect(opportunity.fitScore).toBe(80)
    expect(opportunity.sourceConfidence).toBe(0.8)
    expect(opportunity.verificationStatus).toBe("human_required")
    expect(opportunity.requiresUserApproval).toBe(true)
    expect(opportunity.automationLevel).toBe("user_led")
  })

  it("does not turn source confidence into identity verification", () => {
    const opportunity = buildOverageOpportunity({ ...candidate, sourceConfidence: 1 }, "user_1")

    expect(opportunity.sourceConfidence).toBe(1)
    expect(opportunity.verificationStatus).toBe("human_required")
  })

  it("rejects invalid source confidence", () => {
    expect(() => buildOverageOpportunity({ ...candidate, sourceConfidence: 1.01 }, "user_1")).toThrow(
      "sourceConfidence must be a finite number between 0 and 1.",
    )
  })

  it("rejects missing claimant identity", () => {
    expect(() => buildOverageOpportunity({ ...candidate, claimantName: "" }, "user_1")).toThrow(
      "claimantName is required.",
    )
  })
})
