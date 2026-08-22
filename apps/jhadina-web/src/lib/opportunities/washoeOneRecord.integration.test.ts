import { describe, expect, it } from "vitest"
import { buildOverageOpportunity, type OverageOpportunityCandidate } from "./overageAdapter"

/**
 * Controlled one-record handoff fixture.
 *
 * Source: Washoe County Treasurer, 2026 Real Property Excess Proceeds List.
 * Parcel 004-382-35 / TIMOTHY B MURRI / $91,420.22 excess proceeds.
 *
 * This test deliberately stops at the Jhadina opportunity boundary. It does
 * not contact, skip-trace, file, pay, or recover funds for the record.
 */
const washoeRecord: OverageOpportunityCandidate = {
  sourceKey: "washoe-2026-real-property-excess-proceeds",
  externalRecordId: "004-382-35",
  sourceName: "Washoe County Treasurer",
  sourceUrl: "https://www.washoecounty.gov/treas/TaxSale.php",
  recoveryFamily: "tax-sale-excess-proceeds",
  amount: 91420.22,
  currency: "USD",
  claimantName: "TIMOTHY B MURRI",
  propertyReference: "004-382-35",
  // Controlled fixture value: this is intentionally not treated as an
  // identity-verification score. The adapter only preserves it.
  sourceConfidence: 1,
  evidenceSummary: "2026 public auction held April 22, 2026; recorded May 01, 2026.",
  riskFlags: [],
}

describe("Washoe 004-382-35 controlled Jhadina handoff", () => {
  it("preserves the real source record and stops at human_required", () => {
    const opportunity = buildOverageOpportunity(washoeRecord, "controlled-test-user")

    expect(opportunity.kind).toBe("overage")
    expect(opportunity.sourceName).toBe("Washoe County Treasurer")
    expect(opportunity.sourceUrl).toContain("washoecounty.gov")
    expect(opportunity.estimatedPay).toEqual({
      min: 91420.22,
      max: 91420.22,
      currency: "USD",
      cadence: "unknown",
    })
    expect(opportunity.summary).toContain("004-382-35")
    expect(opportunity.summary).toContain("91420.22")
    expect(opportunity.sourceConfidence).toBe(1)

    expect(opportunity.verificationStatus).toBe("human_required")
    expect(opportunity.requiresUserApproval).toBe(true)
    expect(opportunity.automationLevel).toBe("user_led")
  })

  it("cannot be elevated by a caller-supplied verification status", () => {
    const opportunity = buildOverageOpportunity(
      { ...washoeRecord, verificationStatus: "approved" },
      "controlled-test-user",
    )

    expect(opportunity.verificationStatus).toBe("human_required")
    expect(opportunity.requiresUserApproval).toBe(true)
  })
})
