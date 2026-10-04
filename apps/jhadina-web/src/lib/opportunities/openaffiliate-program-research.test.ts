import { describe, expect, it, vi } from "vitest"
import { buildSideHustleProfile } from "@jhadina/opportunity-core"
import type { StoredCanonicalOpportunity } from "./canonical"
import { researchOpenAffiliateProgramsForOpportunity } from "./openaffiliate-program-research"

function storedOpportunity(
  family: "commerce_affiliate" | "digital_products" = "commerce_affiliate",
): StoredCanonicalOpportunity {
  const now = "2026-10-03T12:00:00.000Z"
  return {
    userId: "owner:test",
    triageState: "review",
    opportunity: {
      id: "opportunity:affiliate:1",
      title: "AI video software for creators",
      family: "business",
      type: "commercial",
      description: "Research affiliate programs aligned with creator software demand.",
      sourceUrl: "https://example.com/source",
      sourceName: "Fixture",
      sourceId: "fixture:affiliate",
      claims: [],
      evidence: [],
      verificationStatus: "unverified",
      sourceConfidence: 0.8,
      fitScore: 80,
      riskFlags: [],
      metadata: {
        sideHustleProfile: buildSideHustleProfile({
          family,
          automationMaturity: "unvalidated",
        }),
      },
      status: "discovered",
      createdAt: now,
      updatedAt: now,
    },
  }
}

describe("OpenAffiliate opportunity research runtime", () => {
  it("binds program discovery to a commerce_affiliate opportunity", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      const value = String(url)
      expect(value).toContain("/api/programs")
      expect(value).toContain("q=AI+video")
      expect(value).toContain("type=recurring")
      expect(value).toContain("verified=true")
      expect(value).toContain("limit=50")
      return new Response(
        JSON.stringify({
          programs: [
            {
              name: "Video SaaS",
              slug: "video-saas",
              url: "https://video.example.com",
              category: "AI",
              commission: {
                type: "recurring",
                rate: "30%",
                mode: "percentage",
                value: 30,
                currency: "USD",
              },
              cookieDays: 60,
              signupUrl: "https://video.example.com/affiliates",
              verified: true,
              lastVerifiedAt: "2026-10-01",
            },
          ],
          total: 1,
          filters: {},
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    })

    const result = await researchOpenAffiliateProgramsForOpportunity(
      {
        opportunityId: "opportunity:affiliate:1",
        query: "AI video",
        commissionType: "recurring",
        limit: 500,
        observedAt: "2026-10-03T12:00:00Z",
        fetchFn: fetchFn as typeof fetch,
      },
      {
        async get() {
          return storedOpportunity()
        },
      },
    )

    expect(result.programs).toHaveLength(1)
    expect(result.programs[0].programId).toBe("video-saas")
    expect(result.officialTermsVerificationRequired).toEqual(["video-saas"])
    expect(result.externalActionAuthorized).toBe(false)
    expect(result.publishingAuthorized).toBe(false)
    expect(result.applicationAuthorized).toBe(false)
    expect(result.moneyMovementAuthorized).toBe(false)
  })

  it("uses the opportunity title when no query is supplied", async () => {
    const fetchFn = vi.fn(async (url: string | URL | Request) => {
      expect(String(url)).toContain("q=AI+video+software+for+creators")
      return new Response(
        JSON.stringify({ programs: [], total: 0, filters: {} }),
        { status: 200, headers: { "content-type": "application/json" } },
      )
    })

    const result = await researchOpenAffiliateProgramsForOpportunity(
      {
        opportunityId: "opportunity:affiliate:1",
        observedAt: "2026-10-03T12:00:00Z",
        fetchFn: fetchFn as typeof fetch,
      },
      {
        async get() {
          return storedOpportunity()
        },
      },
    )

    expect(result.query).toBe("AI video software for creators")
    expect(result.programs).toEqual([])
  })

  it("refuses to use affiliate discovery for another Side Hustle family", async () => {
    await expect(
      researchOpenAffiliateProgramsForOpportunity(
        {
          opportunityId: "opportunity:affiliate:1",
          query: "AI video",
          fetchFn: vi.fn() as unknown as typeof fetch,
        },
        {
          async get() {
            return storedOpportunity("digital_products")
          },
        },
      ),
    ).rejects.toThrow("AFFILIATE_PROGRAM_RESEARCH_REQUIRES_COMMERCE_AFFILIATE")
  })
})
