import { describe, expect, it } from "vitest"
import { certifyAdsLaunchReadiness, verifyExistingPausedMetaCampaign, type ProviderLaunchEvidence } from "./ads-launch-certification"

const complete: ProviderLaunchEvidence = {
  ownerConfigured: true, providerTokenPresent: true, adAccountReadVerified: true,
  existingPausedCampaignReconciled: true, databaseReadHealthy: true,
  ownerIphoneAcceptanceVerified: true, budgetCeilingsConfigured: true,
  ownerSpendApprovalPresent: true, creativeAndTrackingReviewed: true,
}

describe("ADS-CONNECT.09-.11 launch certification", () => {
  it("lists every unresolved launch blocker and never authorizes external actions", () => {
    const result = certifyAdsLaunchReadiness(Object.fromEntries(Object.keys(complete).map(k => [k, false])) as unknown as ProviderLaunchEvidence)
    expect(result.openIssues).toHaveLength(9)
    expect(result.readyForOwnerLaunchReview).toBe(false)
    expect(result.canActivateAds).toBe(false)
    expect(result.canSpend).toBe(false)
  })
  it("even complete evidence is a review cue, not a write permit", () => {
    const result = certifyAdsLaunchReadiness(complete)
    expect(result.readyForOwnerLaunchReview).toBe(true)
    expect(result.openIssues).toEqual([])
    expect(result.canCreatePausedCampaign).toBe(false)
    expect(result.canActivateAds).toBe(false)
    expect(result.canSpend).toBe(false)
    expect(result.canPublish).toBe(false)
  })
  it("does not allow repeated creation of the already paused Meta canary", () => {
    expect(verifyExistingPausedMetaCampaign({
      expectedProviderAccountId: "act_test", observedProviderAccountId: "act_test",
      campaignId: "old-paused-id", status: "PAUSED", adSetsCount: 0, adsCount: 0,
    }).duplicateCreationAllowed).toBe(false)
    expect(() => verifyExistingPausedMetaCampaign({
      expectedProviderAccountId: "act_a", observedProviderAccountId: "act_b",
      campaignId: "old-paused-id", status: "PAUSED", adSetsCount: 0, adsCount: 0,
    })).toThrow("ACCOUNT_MISMATCH")
    expect(() => verifyExistingPausedMetaCampaign({
      expectedProviderAccountId: "act_a", observedProviderAccountId: "act_a",
      campaignId: "old-paused-id", status: "ACTIVE", adSetsCount: 0, adsCount: 0,
    })).toThrow("NOT_PAUSED")
  })
})
