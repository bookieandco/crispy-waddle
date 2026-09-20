import { describe, expect, it } from "vitest"
import { buildOverageOpportunity, type OverageOpportunityCandidate } from "./overageAdapter"

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
  sourceConfidence: 1,
  evidenceSummary: "2026 public auction held April 22, 2026; recorded May 01, 2026.",
  riskFlags: [],
}

describe("Washoe 004-382-35 controlled canonical handoff", () => {
  it("preserves the source record while remaining unverified", () => {
    const opportunity = buildOverageOpportunity(washoeRecord)

    expect(opportunity.family).toBe("recovery")
    expect(opportunity.sourceName).toBe("Washoe County Treasurer")
    expect(opportunity.sourceUrl).toContain("washoecounty.gov")
    expect(opportunity.amount).toEqual({ max: 91420.22, currency: "USD" })
    expect(opportunity.description).toContain("004-382-35")
    expect(opportunity.description).toContain("91420.22")
    expect(opportunity.sourceConfidence).toBe(1)
    expect(opportunity.verificationStatus).toBe("unverified")
    expect(opportunity.verificationDecision).toBeUndefined()
  })

  it("cannot be elevated by caller-supplied legacy verification status", () => {
    const opportunity = buildOverageOpportunity({ ...washoeRecord, verificationStatus: "verified" })
    expect(opportunity.verificationStatus).toBe("unverified")
  })
})
