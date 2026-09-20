import { describe, expect, it } from "vitest"
import { canonicalFromSideIncome, toOpportunityView } from "../lib/opportunities/canonical"

describe("Opportunity Command Center canonical projection", () => {
  it("projects product verticals into the Products Hub category", () => {
    const canonical = canonicalFromSideIncome({
      title: "POD fixture",
      kind: "pod",
      sourceUrl: "https://example.test/pod",
      sourceName: "Fixture",
      summary: "Fixture",
      automationLevel: "ai_plus_user",
    }, "opportunity:pod")

    const view = toOpportunityView({
      userId: "00000000-0000-0000-0000-000000000001",
      opportunity: canonical,
      triageState: "review",
    })

    expect(view.hubCategory).toBe("products")
    expect(view.kind).toBe("pod")
    expect(view.fitScore).toBe(50)
  })

  it("keeps research approval distinct from execution", () => {
    const canonical = canonicalFromSideIncome({
      title: "AI job fixture",
      kind: "ai_job",
      sourceUrl: "https://example.test/job",
      sourceName: "Fixture",
      summary: "Fixture",
      automationLevel: "ai_plus_user",
    }, "opportunity:job")

    const view = toOpportunityView({
      userId: "00000000-0000-0000-0000-000000000001",
      opportunity: { ...canonical, status: "research_pending" },
      triageState: "saved",
      approvedAt: "2026-09-19T00:00:00Z",
      researchCaseId: "research:opportunity:job",
    })

    expect(view.status).toBe("approved")
    expect(view.researchCaseId).toBe("research:opportunity:job")
    expect(view.hubCategory).toBe("earn")
  })
})
