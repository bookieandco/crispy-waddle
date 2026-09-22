import { describe, expect, it } from "vitest"
import type { DirectorSocialApprovedAssetReceipt } from "@jhadina/director-core"
import { buildMetaCampaignDraftFromApprovedCreative } from "./meta-campaign-draft"

function receipt(id: string): DirectorSocialApprovedAssetReceipt {
  return {
    id: `receipt:${id}`,
    briefId: `brief:${id}`,
    socialContentProjectId: "social:1",
    socialAssetId: `social-asset:${id}`,
    directorProjectId: "director:1",
    directorAssetId: `director-asset:${id}`,
    generationJobId: `generation:${id}`,
    mediaType: "image",
    uri: `https://media.example/${id}.png`,
    reviewDecisionId: `review:${id}`,
    reviewEvidenceIds: [`qc:${id}`],
    approvedAt: "2026-09-22T19:00:00.000Z",
    provenance: {
      projectId: "director:1",
      storyboardBoardIds: ["board:1"],
      storyboardVersion: 1,
      generationStageId: "stage:generation",
      generationStageVersion: 1,
      generationJobId: `generation:${id}`,
    },
    authority: "DIRECTOR_ASSET_APPROVED",
    publicationAuthority: "NONE",
  }
}

describe("Meta campaign draft from Director creative", () => {
  it("uses only Director-approved asset IDs and still requires paid-ad approval downstream", () => {
    const draft = buildMetaCampaignDraftFromApprovedCreative({
      brandId: "brand:packnest",
      name: "PackNest creative test",
      objective: "sales",
      providerAccountId: "meta-account:1",
      audienceIds: ["audience:broad-us"],
      approvedCreativeReceipts: [receipt("a"), receipt("b")],
      landingPageId: "landing:packnest",
      currency: "USD",
      dailyBudgetMinor: 5000,
      lifetimeBudgetMinor: 35000,
      idempotencyKey: "meta-test:packnest:1",
    })

    expect(draft.channel).toBe("meta")
    expect(draft.provider).toBe("markifact")
    expect(draft.creativeIds).toEqual(["director-asset:a", "director-asset:b"])
    expect(draft.dailyBudgetMinor).toBe(5000)
  })

  it("rejects creative that has not passed Director evidence requirements", () => {
    const invalid = { ...receipt("a"), reviewEvidenceIds: [] }

    expect(() => buildMetaCampaignDraftFromApprovedCreative({
      brandId: "brand:packnest",
      name: "PackNest creative test",
      objective: "sales",
      providerAccountId: "meta-account:1",
      audienceIds: ["audience:broad-us"],
      approvedCreativeReceipts: [invalid],
      currency: "USD",
      dailyBudgetMinor: 5000,
    })).toThrow("META_CAMPAIGN_CREATIVE_EVIDENCE_REQUIRED")
  })
})
