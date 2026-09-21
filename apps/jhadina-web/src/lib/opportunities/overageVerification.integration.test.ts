import { describe, expect, it } from "vitest"
import { buildOverageVerificationRequest } from "./overageVerification"

describe("authorized Washoe 004-382-35 verification request", () => {
  it("preserves evidence and remains human-required", () => {
    const request = buildOverageVerificationRequest({
      opportunityId: "opp-washoe-004-382-35",
      sourceKey: "washoe-treasury-2026",
      externalRecordId: "004-382-35",
      sourceName: "Washoe County Treasurer",
      sourceUrl: "https://www.washoecounty.gov/treas/",
      propertyReference: "004-382-35",
      amount: 91420.22,
      currency: "USD",
      claimantName: "TIMOTHY B MURRI",
      evidenceSummary: "2026 excess proceeds list; recorded May 01, 2026.",
    })

    expect(request.status).toBe("human_required")
    expect(request.sourceKey).toBe("washoe-treasury-2026")
    expect(request.externalRecordId).toBe("004-382-35")
    expect(request.propertyReference).toBe("004-382-35")
    expect(request.amount).toBe(91420.22)
    expect(request.claimantName).toBe("TIMOTHY B MURRI")
    expect(request.checks).toEqual([
      "confirm_source_record",
      "confirm_property_reference",
      "confirm_claimant_identity",
      "confirm_ownership_or_entitlement",
    ])
  })
})
