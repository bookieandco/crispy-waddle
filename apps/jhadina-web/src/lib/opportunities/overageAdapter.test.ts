import { describe, expect, it } from "vitest"

import { buildOverageOpportunity, type OverageOpportunityCandidate } from "./overageAdapter"

describe("buildOverageOpportunity", () => {
  const candidate: OverageOpportunityCandidate = {
    sourceKey: "washoe.tax-sale.excess-proceeds.2026",
    externalRecordId: "washoe-2026-001",
    sourceName: "Washoe County Treasurer",
    sourceUrl: "https://www.washoecounty.gov/treas/TaxSale.php",
    recoveryFamily: "tax_sale_excess_proceeds",
    amount: 1250,
    currency: "USD",
    claimantName: "Test Claimant",
    propertyReference: "APN-TEST-001",
    sourceConfidence: 0.9,
    verificationStatus: "approved",
    evidenceSummary: "Controlled Washoe fixture; no external action permitted.",
    riskFlags: ["identity_unverified"],
  }

  it("preserves provenance and financial evidence", () => {
    const opportunity = buildOverageOpportunity(candidate, "test-user")

    expect(opportunity.sourceName).toBe(candidate.sourceName)
    expect(opportunity.sourceUrl).toBe(candidate.sourceUrl)
    expect(opportunity.sourceConfidence).toBe(candidate.sourceConfidence)
    expect(opportunity.estimatedPay).toEqual({
      min: 1250,
      max: 1250,
      currency: "USD",
      cadence: "unknown",
    })
    expect(opportunity.kind).toBe("overage")
  })

  it("cannot be elevated past the human verification gate", () => {
    const opportunity = buildOverageOpportunity(candidate, "test-user")

    expect(opportunity.verificationStatus).toBe("human_required")
    expect(opportunity.requiresUserApproval).toBe(true)
    expect(opportunity.automationLevel).toBe("user_led")
  })

  it("rejects invalid source confidence", () => {
    expect(() =>
      buildOverageOpportunity(
        { ...candidate, sourceConfidence: 1.01 },
        "test-user",
      ),
    ).toThrow("sourceConfidence must be a finite number between 0 and 1.")
  })

  it("rejects invalid amounts", () => {
    expect(() =>
      buildOverageOpportunity(
        { ...candidate, amount: -1 },
        "test-user",
      ),
    ).toThrow("amount must be a finite non-negative number.")
  })

  it("does not expose an execution capability", () => {
    const opportunity = buildOverageOpportunity(candidate, "test-user")

    expect(opportunity).not.toHaveProperty("contact")
    expect(opportunity).not.toHaveProperty("filing")
    expect(opportunity).not.toHaveProperty("payment")
    expect(opportunity).not.toHaveProperty("recoveryAction")
  })
})
