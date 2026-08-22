import { describe, expect, it } from "vitest"
import { buildOverageVerificationRequest } from "./overageVerification"

describe("buildOverageVerificationRequest", () => {
  const input = {
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
  }

  it("creates a human-required verification checklist without executing actions", () => {
    const request = buildOverageVerificationRequest(input)

    expect(request.status).toBe("human_required")
    expect(request.externalRecordId).toBe("004-382-35")
    expect(request.amount).toBe(91420.22)
    expect(request.checks).toEqual([
      "confirm_source_record",
      "confirm_property_reference",
      "confirm_claimant_identity",
      "confirm_ownership_or_entitlement",
    ])
  })

  it("rejects malformed records", () => {
    expect(() => buildOverageVerificationRequest({ ...input, amount: -1 })).toThrow()
    expect(() => buildOverageVerificationRequest({ ...input, claimantName: "" })).toThrow()
    expect(() => buildOverageVerificationRequest({ ...input, externalRecordId: "" })).toThrow()
  })
})
