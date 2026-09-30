import type {
  HumanPointOfView,
  RankedBigIdea,
} from "@jhadina/growth-core"
import type {
  ContentAssetKind,
  ContentJob,
  JhadinaBrand,
  SocialCharacterProfile,
  SocialPlatform,
} from "@jhadina/social-core"
import {
  createGrowthPresenceRepository,
  type GrowthPresenceRepository,
  type StoredPresenceCampaign,
} from "../growth/presence-repository"
import {
  createContentProjectRepository,
  type ContentProjectRepository,
  type StoredContentProject,
} from "./content-project-repository"
import { createSocialContentProjectFromGrowth } from "./growth-content-bridge"

const GROWTH_TO_SOCIAL_BRAND: Readonly<Record<string, JhadinaBrand>> = {
  "brand:pupsonstuff": "pupsonstuff",
  "brand:atwood-bookie": "atwood-bookie",
  "brand:truckeros": "truckeros",
  "brand:jhadina": "jhadina",
}

export interface PresenceContentProjectInput {
  userId: string
  campaign: StoredPresenceCampaign
  rankedBigIdea: RankedBigIdea
  authorityPositionRef: string
  pillarRef: string
  humanPointOfView?: HumanPointOfView
  brandPointOfView?: {
    ref: string
    text: string
    evidenceRefs: readonly string[]
  }
  character?: SocialCharacterProfile
  anchorKind?: ContentAssetKind
  anchorPlatform?: SocialPlatform
  anchorText?: string
  createdAt?: string
}

export interface PresenceContentProjectResult {
  contentProject: StoredContentProject
  campaign: StoredPresenceCampaign
  authority: "PLANNING_ONLY"
  directorReady: boolean
  publicationAuthority: "NONE"
}

export interface PresenceContentProjectOverrides {
  presenceRepository?: GrowthPresenceRepository
  contentProjectRepository?: ContentProjectRepository
}

export async function compilePresenceCampaignToContentProject(
  input: PresenceContentProjectInput,
  overrides: PresenceContentProjectOverrides = {},
): Promise<PresenceContentProjectResult> {
  if (!input.campaign.campaign.id.trim()) throw new Error("PRESENCE_CONTENT_CAMPAIGN_REQUIRED")
  if (input.campaign.status === "archived") throw new Error("PRESENCE_CONTENT_CAMPAIGN_ARCHIVED")
  if (input.campaign.contentProjectId) throw new Error("PRESENCE_CONTENT_PROJECT_ALREADY_LINKED")
  if (input.rankedBigIdea.status === "hypothesis") {
    throw new Error("PRESENCE_CONTENT_BIG_IDEA_NOT_VALIDATED")
  }

  const socialBrand = GROWTH_TO_SOCIAL_BRAND[input.campaign.campaign.brandId]
  if (!socialBrand) {
    throw new Error(`PRESENCE_CONTENT_SOCIAL_BRAND_UNSUPPORTED:${input.campaign.campaign.brandId}`)
  }

  const offerEvidence = input.campaign.offers.flatMap((offer) => offer.evidenceRefs)
  const campaignEvidence = input.campaign.campaign.durablePresence.flatMap((plan) => plan.evidenceRefs)
  const sourceEvidenceRefs = [
    ...new Set([
      ...input.campaign.campaign.concept.evidenceRefs,
      ...offerEvidence,
      ...campaignEvidence,
      `presence-campaign:${input.campaign.campaign.id}`,
    ]),
  ]
  if (!sourceEvidenceRefs.length) throw new Error("PRESENCE_CONTENT_EVIDENCE_REQUIRED")

  const primaryJob = primaryJobFor(input.campaign)
  const projectId = `content:${input.campaign.campaign.id}`
  const assetId = `asset:${input.campaign.campaign.id}:anchor`
  const createdAt = input.createdAt ?? new Date().toISOString()
  const project = createSocialContentProjectFromGrowth({
    id: projectId,
    brand: socialBrand,
    authorityPositionRef: input.authorityPositionRef,
    pillarRef: input.pillarRef,
    primaryJob,
    bigIdea: input.rankedBigIdea,
    humanPointOfView: input.humanPointOfView,
    brandPointOfView: input.brandPointOfView,
    sourceEvidenceRefs,
    character: input.character,
    anchor: {
      id: assetId,
      kind: input.anchorKind ?? "anchor_video",
      platform: input.anchorPlatform,
      text: input.anchorText,
    },
    createdAt,
  })

  const contentRepository = overrides.contentProjectRepository ?? createContentProjectRepository()
  const presenceRepository = overrides.presenceRepository ?? createGrowthPresenceRepository()

  const storedContent = await contentRepository.save(
    input.userId,
    project,
    input.campaign.campaign.id,
  )
  const linkedCampaign = await presenceRepository.linkContentProject(
    input.userId,
    input.campaign.campaign.id,
    project.id,
  )

  return {
    contentProject: storedContent,
    campaign: linkedCampaign,
    authority: "PLANNING_ONLY",
    directorReady: project.assets.some((asset) =>
      asset.kind === "anchor_video"
      || asset.kind === "short_video"
      || asset.kind === "image"
      || asset.kind === "carousel"
      || asset.kind === "ad",
    ),
    publicationAuthority: "NONE",
  }
}

function primaryJobFor(campaign: StoredPresenceCampaign): ContentJob {
  if (campaign.offers.some((offer) =>
    offer.objective === "sale"
    || offer.objective === "lead"
    || offer.objective === "signup",
  )) {
    return "conversion"
  }
  if (campaign.offers.some((offer) => offer.objective === "stream")) return "reach"
  return "reach"
}
