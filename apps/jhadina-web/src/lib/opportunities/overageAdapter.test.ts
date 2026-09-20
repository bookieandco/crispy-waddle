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
    verificationStatus: "verified",
    evidenceSummary: "Controlled Washoe fixture; no external action permitted.",
    riskFlags: ["identity_unverified"],
  }

  it("preserves provenance and financial evidence in the canonical model", () => {
    const opportunity = buildOverageOpportunity(candidate)

    expect(opportunity.family).toBe("recovery")
    expect(opportunity.type).toBe("recovery")
    expect(opportunity.sourceName).toBe(candidate.sourceName)
    expect(opportunity.sourceUrl).toBe(candidate.sourceUrl)
    expect(opportunity.sourceConfidence).toBe(candidate.sourceConfidence)
    expect(opportunity.amount).toEqual({ max: 1250, currency: "USD" })
    expect(opportunity.metadata?.opportunityKind).toBe("overage")
  })

  it("cannot be elevated by caller-supplied verification status", () => {
    const opportunity = buildOverageOpportunity(candidate)

    expect(opportunity.verificationStatus).toBe("unverified")
    expect(opportunity.verificationDecision).toBeUndefined()
    expect(opportunity.status).toBe("research_pending")
  })

  it("rejects invalid source confidence", () => {
    expect(() => buildOverageOpportunity({ ...candidate, sourceConfidence: 1.01 })).toThrow(
      "sourceConfidence must be a finite number between 0 and 1.",
    )
  })

  it("rejects invalid amounts", () => {
    expect(() => buildOverageOpportunity({ ...candidate, amount: -1 })).toThrow(
      "amount must be a finite non-negative number.",
    )
  })

  it("does not expose an execution capability", () => {
    const opportunity = buildOverageOpportunity(candidate)
    expect(opportunity).not.toHaveProperty("contact")
    expect(opportunity).not.toHaveProperty("filing")
    expect(opportunity).not.toHaveProperty("payment")
    expect(opportunity).not.toHaveProperty("recoveryAction")
  })
})
