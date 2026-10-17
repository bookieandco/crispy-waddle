/**
 * ADS-CONNECT.09-.11 launch evidence model.
 * An acceptance certificate is intentionally NON-EXECUTABLE.
 * Source and externally obtained read probes cannot authorize spending.
 */
export type LaunchIssue =
  | "OWNER_NOT_CONFIGURED"
  | "PROVIDER_TOKEN_NOT_CONFIGURED"
  | "ADS_ACCOUNT_NOT_VERIFIED"
  | "PAUSED_CAMPAIGN_UNRECONCILED"
  | "DURABLE_STORAGE_UNAVAILABLE"
  | "OWNER_DEVICE_NOT_VERIFIED"
  | "BUDGET_GUARD_NOT_CONFIGURED"
  | "OWNER_SPEND_APPROVAL_NOT_PRESENT"
  | "CREATIVE_AND_PIXEL_EVIDENCE_MISSING"

export type ProviderLaunchEvidence = Readonly<{
  ownerConfigured: boolean
  providerTokenPresent: boolean
  adAccountReadVerified: boolean
  existingPausedCampaignReconciled: boolean
  databaseReadHealthy: boolean
  ownerIphoneAcceptanceVerified: boolean
  budgetCeilingsConfigured: boolean
  ownerSpendApprovalPresent: boolean
  creativeAndTrackingReviewed: boolean
}>

export function certifyAdsLaunchReadiness(evidence: ProviderLaunchEvidence): {
  readonly mode: "PLANNING_AND_READ_ONLY"
  readonly readyForOwnerLaunchReview: boolean
  readonly canCreatePausedCampaign: false
  readonly canActivateAds: false
  readonly canSpend: false
  readonly canPublish: false
  readonly openIssues: readonly LaunchIssue[]
} {
  const tests: Array<[keyof ProviderLaunchEvidence, LaunchIssue]> = [
    ["ownerConfigured", "OWNER_NOT_CONFIGURED"],
    ["providerTokenPresent", "PROVIDER_TOKEN_NOT_CONFIGURED"],
    ["adAccountReadVerified", "ADS_ACCOUNT_NOT_VERIFIED"],
    ["existingPausedCampaignReconciled", "PAUSED_CAMPAIGN_UNRECONCILED"],
    ["databaseReadHealthy", "DURABLE_STORAGE_UNAVAILABLE"],
    ["ownerIphoneAcceptanceVerified", "OWNER_DEVICE_NOT_VERIFIED"],
    ["budgetCeilingsConfigured", "BUDGET_GUARD_NOT_CONFIGURED"],
    ["ownerSpendApprovalPresent", "OWNER_SPEND_APPROVAL_NOT_PRESENT"],
    ["creativeAndTrackingReviewed", "CREATIVE_AND_PIXEL_EVIDENCE_MISSING"],
  ]
  const openIssues = tests.filter(([field]) => evidence[field] !== true).map(([, issue]) => issue)
  return {
    mode: "PLANNING_AND_READ_ONLY",
    readyForOwnerLaunchReview: openIssues.length === 0,
    canCreatePausedCampaign: false,
    canActivateAds: false,
    canSpend: false,
    canPublish: false,
    openIssues,
  }
}

export function verifyExistingPausedMetaCampaign(input: {
  expectedProviderAccountId: string
  observedProviderAccountId: string
  campaignId: string
  status: string
  adSetsCount: number
  adsCount: number
}): { readonly reconciled: true; readonly duplicateCreationAllowed: false } {
  if (!input.expectedProviderAccountId || input.expectedProviderAccountId !== input.observedProviderAccountId) {
    throw new Error("ADS_EXISTING_CAMPAIGN_ACCOUNT_MISMATCH")
  }
  if (!input.campaignId.trim()) throw new Error("ADS_EXISTING_CAMPAIGN_ID_MISSING")
  if (input.status.toUpperCase() !== "PAUSED") throw new Error("ADS_EXISTING_CAMPAIGN_NOT_PAUSED")
  if (![input.adSetsCount, input.adsCount].every(Number.isSafeInteger) ||
    input.adSetsCount < 0 || input.adsCount < 0) {
    throw new Error("ADS_EXISTING_CAMPAIGN_COUNTS_INVALID")
  }
  return { reconciled: true, duplicateCreationAllowed: false }
}
