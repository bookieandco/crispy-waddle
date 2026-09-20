import { describe, expect, it } from "vitest"
import { normalizeSamOpportunityNotice, normalizeSamOpportunityResults } from "./sam-opportunity-adapter"

describe("SAM opportunity normalization", () => {
  it("normalizes the official opportunitiesData response shape", () => {
    const items = normalizeSamOpportunityResults({
      totalRecords: 1,
      opportunitiesData: [{
        noticeId: "SAM-NOTICE-001",
        title: "AI workflow services",
        type: "Solicitation",
        fullParentPathName: "Department of Example",
        office: "Example Office",
        responseDeadLine: "2026-10-15T17:00:00Z",
        naicsCode: "541512",
        typeOfSetAsideDescription: "Small Business Set-Aside",
        awardCeiling: "250000",
        description: "Automation and AI services.",
        uiLink: "https://sam.gov/opp/SAM-NOTICE-001/view",
      }],
    })

    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({
      noticeId: "SAM-NOTICE-001",
      noticeType: "SOLICITATION",
      agency: "Department of Example",
      office: "Example Office",
      naics: "541512",
      setAside: "Small Business Set-Aside",
      estimatedValue: 250000,
      sourceUrl: "https://sam.gov/opp/SAM-NOTICE-001/view",
    })
  })

  it("requires a stable SAM notice identifier before canonical persistence", () => {
    expect(() => normalizeSamOpportunityNotice({
      title: "Missing identifier",
      type: "Sources Sought",
    })).toThrow("stable notice identifier")
  })

  it("does not turn Sources Sought into an award notice", () => {
    const item = normalizeSamOpportunityNotice({
      noticeId: "SAM-NOTICE-002",
      title: "Market research",
      type: "Sources Sought",
    })
    expect(item.noticeType).toBe("SOURCES_SOUGHT")
  })
})
