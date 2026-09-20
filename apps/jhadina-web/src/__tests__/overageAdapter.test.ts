import { describe, expect, it } from "vitest"
import { buildOverageOpportunity } from "../lib/opportunities/overageAdapter"

describe("canonical buildOverageOpportunity", () => {
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

  it("maps an overage candidate to a canonical recovery opportunity", () => {
    const opportunity = buildOverageOpportunity(candidate)

    expect(opportunity.family).toBe("recovery")
    expect(opportunity.type).toBe("recovery")
    expect(opportunity.amount?.max).toBe(1250.5)
    expect(opportunity.fitScore).toBe(50)
    expect(opportunity.sourceConfidence).toBe(0.8)
    expect(opportunity.verificationStatus).toBe("unverified")
    expect(opportunity.metadata?.providerId).toBe("provider:overageos")
  })

  it("keeps fit independent from source confidence", () => {
    const lowSource = buildOverageOpportunity({ ...candidate, sourceConfidence: 0.2 })
    const highSource = buildOverageOpportunity({ ...candidate, sourceConfidence: 1 })
    expect(lowSource.sourceConfidence).toBe(0.2)
    expect(highSource.sourceConfidence).toBe(1)
    expect(lowSource.fitScore).toBe(highSource.fitScore)
  })

  it("does not turn source confidence into claimant verification", () => {
    const opportunity = buildOverageOpportunity({ ...candidate, sourceConfidence: 1 })
    expect(opportunity.sourceConfidence).toBe(1)
    expect(opportunity.verificationStatus).toBe("unverified")
  })

  it("cannot be promoted to verified by legacy input status", () => {
    const opportunity = buildOverageOpportunity({ ...candidate, verificationStatus: "verified" as const })
    expect(opportunity.verificationStatus).toBe("unverified")
  })

  it("rejects invalid source confidence and missing claimant identity", () => {
    expect(() => buildOverageOpportunity({ ...candidate, sourceConfidence: 1.01 })).toThrow()
    expect(() => buildOverageOpportunity({ ...candidate, claimantName: "" })).toThrow("claimantName is required.")
  })
})
