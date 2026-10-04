import { describe, expect, it } from "vitest"
import {
  affiliateTermsSnapshotFromProgram,
  compareAffiliateTerms,
  evaluateAffiliateTermsFreshness,
  type AffiliateProgramObservation,
} from "@jhadina/commerce-adapters"

function program(
  overrides: Partial<AffiliateProgramObservation> = {},
): AffiliateProgramObservation {
  return {
    provider: "openaffiliate",
    sourceId: "openaffiliate:example-saas",
    programId: "example-saas",
    name: "Example SaaS",
    merchantUrl: "https://example.com",
    signupUrl: "https://example.com/partners",
    category: "SaaS",
    tags: ["software"],
    kind: "affiliate",
    network: "direct",
    commission: {
      type: "recurring",
      rateText: "30%",
      mode: "percentage",
      value: 30,
      currency: "USD",
    },
    cookieDays: 60,
    attribution: "last-click",
    trackingMethod: "server-side",
    approval: "manual",
    approvalTime: "2 business days",
    payout: {
      minimum: 100,
      currency: "USD",
      frequency: "monthly",
      methods: ["bank"],
    },
    restrictions: ["No trademark bidding"],
    verification: {
      verified: true,
      scope: "registry-page-signals",
      lastVerifiedAt: "2026-10-01T00:00:00Z",
    },
    evidenceRefs: ["https://example.com/partners"],
    observedAt: "2026-10-03T00:00:00Z",
    ...overrides,
  }
}

describe("affiliate terms drift", () => {
  it("requires official terms before publication-sensitive decisions", () => {
    const snapshot = affiliateTermsSnapshotFromProgram(program(), {
      sourceKind: "registry",
      capturedAt: "2026-10-03T00:00:00Z",
    })

    const result = evaluateAffiliateTermsFreshness(
      snapshot,
      { maxAgeDays: 7, requireOfficialSource: true },
      "2026-10-04T00:00:00Z",
    )

    expect(result.status).toBe("official_source_required")
    expect(result.blockers).toContain(
      "Official merchant/network terms source is required.",
    )
  })

  it("marks old official terms stale", () => {
    const snapshot = affiliateTermsSnapshotFromProgram(program(), {
      sourceKind: "official_merchant",
      sourceUrl: "https://example.com/partners",
      capturedAt: "2026-09-01T00:00:00Z",
    })

    const result = evaluateAffiliateTermsFreshness(
      snapshot,
      { maxAgeDays: 14, requireOfficialSource: true },
      "2026-10-03T00:00:00Z",
    )

    expect(result.status).toBe("stale")
    expect(result.ageDays).toBe(32)
  })

  it("detects economics attribution policy and operational drift", () => {
    const previous = affiliateTermsSnapshotFromProgram(program(), {
      sourceKind: "official_merchant",
      capturedAt: "2026-10-01T00:00:00Z",
    })
    const current = affiliateTermsSnapshotFromProgram(
      program({
        commission: {
          type: "recurring",
          rateText: "20%",
          mode: "percentage",
          value: 20,
          currency: "USD",
        },
        cookieDays: 30,
        attribution: "first-click",
        restrictions: ["No trademark bidding", "No paid social"],
        network: "partner-network",
      }),
      {
        sourceKind: "official_merchant",
        capturedAt: "2026-10-03T00:00:00Z",
      },
    )

    const drift = compareAffiliateTerms(previous, current)

    expect(drift.changed).toBe(true)
    expect(drift.requiresReevaluation).toBe(true)
    expect(drift.changes.map((change) => change.field)).toEqual(
      expect.arrayContaining([
        "commission",
        "cookie_days",
        "attribution",
        "restrictions",
        "network",
      ]),
    )
    expect(drift.publishingAuthorized).toBe(false)
    expect(drift.moneyMovementAuthorized).toBe(false)
  })

  it("does not report drift for semantically identical restriction order", () => {
    const previous = affiliateTermsSnapshotFromProgram(
      program({ restrictions: ["No paid social", "No trademark bidding"] }),
      {
        sourceKind: "official_network",
        capturedAt: "2026-10-01T00:00:00Z",
      },
    )
    const current = affiliateTermsSnapshotFromProgram(
      program({ restrictions: ["No trademark bidding", "No paid social"] }),
      {
        sourceKind: "official_network",
        capturedAt: "2026-10-03T00:00:00Z",
      },
    )

    expect(compareAffiliateTerms(previous, current).changed).toBe(false)
  })
})
