import type { DirectorSocialApprovedAssetReceipt } from "@jhadina/director-core"
import type { CreatePaidCampaignInput } from "./governed-paid-campaign"

export interface MetaCampaignDraftInput {
  brandId: string
  name: string
  objective: string
  providerAccountId: string
  audienceIds: readonly string[]
  approvedCreativeReceipts: readonly DirectorSocialApprovedAssetReceipt[]
  landingPageId?: string
  currency: string
  dailyBudgetMinor: number
  lifetimeBudgetMinor?: number
  startsAt?: string
  endsAt?: string
  idempotencyKey?: string
}

export function buildMetaCampaignDraftFromApprovedCreative(
  input: MetaCampaignDraftInput,
): CreatePaidCampaignInput {
  if (!input.brandId.trim() || !input.name.trim() || !input.objective.trim()) {
    throw new Error("META_CAMPAIGN_DRAFT_IDENTITY_REQUIRED")
  }
  if (!input.providerAccountId.trim()) throw new Error("META_CAMPAIGN_PROVIDER_ACCOUNT_REQUIRED")
  if (!input.audienceIds.length) throw new Error("META_CAMPAIGN_AUDIENCE_REQUIRED")
  if (!input.approvedCreativeReceipts.length) throw new Error("META_CAMPAIGN_CREATIVE_REQUIRED")

  const creativeIds = input.approvedCreativeReceipts.map((receipt) => {
    if (receipt.authority !== "DIRECTOR_ASSET_APPROVED") {
      throw new Error("META_CAMPAIGN_DIRECTOR_APPROVAL_REQUIRED")
    }
    if (receipt.publicationAuthority !== "NONE") {
      throw new Error("META_CAMPAIGN_INVALID_DIRECTOR_AUTHORITY")
    }
    if (!["image", "video", "motion"].includes(receipt.mediaType)) {
      throw new Error("META_CAMPAIGN_UNSUPPORTED_CREATIVE_MEDIA")
    }
    if (!receipt.reviewEvidenceIds.length || !receipt.provenance.generationJobId) {
      throw new Error("META_CAMPAIGN_CREATIVE_EVIDENCE_REQUIRED")
    }
    return receipt.directorAssetId
  })

  return {
    brandId: input.brandId,
    name: input.name,
    objective: input.objective,
    channel: "meta",
    provider: "markifact",
    providerAccountId: input.providerAccountId,
    audienceIds: [...input.audienceIds],
    creativeIds,
    landingPageId: input.landingPageId,
    currency: input.currency,
    dailyBudgetMinor: input.dailyBudgetMinor,
    lifetimeBudgetMinor: input.lifetimeBudgetMinor,
    startsAt: input.startsAt,
    endsAt: input.endsAt,
    idempotencyKey: input.idempotencyKey,
  }
}
