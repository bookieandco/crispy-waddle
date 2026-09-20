import { describe, expect, it } from "vitest"
import { normalizeSamGovOpportunity } from "./samGovAdapter"

describe("normalizeSamGovOpportunity", () => {
  it("normalizes an active solicitation without treating it as an award", () => {
    const result = normalizeSamGovOpportunity({
      noticeId: "ABC-123",
      title: "Facility Maintenance Services",
      solicitationNumber: "W1234-26-R-0001",
      noticeType: "Solicitation",
      agency: "Department of Example",
      naicsCode: "561210",
      setAside: "Small Business Set-Aside",
      estimatedValue: 250000,
      url: "https://sam.gov/opp/ABC-123/view",
    })

    expect(result.externalRecordId).toBe("ABC-123")
    expect(result.noticeType).toBe("solicitation")
    expect(result.estimatedValue).toBe(250000)
    expect(result.requiresHumanReview).toBe(true)
    expect(result.requiresUserApproval).toBe(true)
  })

  it("distinguishes sources sought from solicitations", () => {
    const result = normalizeSamGovOpportunity({
      noticeId: "RFI-1",
      title: "Market Research",
      noticeType: "Sources Sought Notice",
      url: "https://sam.gov/opp/RFI-1/view",
    })

    expect(result.noticeType).toBe("sources_sought")
  })

  it("rejects invalid estimated values", () => {
    expect(() => normalizeSamGovOpportunity({
      noticeId: "BAD-1",
      title: "Bad Record",
      estimatedValue: -1,
      url: "https://sam.gov/opp/BAD-1/view",
    })).toThrow("estimatedValue")
  })
})
