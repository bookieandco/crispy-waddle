import {
  bindContentAssetMedia,
  type ContentAsset,
  type ContentProject,
} from "@jhadina/social-core"
import {
  createDirectorSocialProductionBrief,
  issueDirectorSocialApprovedAssetReceipt,
  type CreateDirectorSocialProductionBriefInput,
  type DirectorSocialApprovedAssetReceipt,
  type GeneratedAssetRecord,
  type MediaReviewDecisionRecord,
  type SocialProductionMediaType,
} from "@jhadina/director-core"

export interface SocialDirectorProductionInput {
  directorProjectId: string
  mediaType?: SocialProductionMediaType
  referenceAssetIds?: readonly string[]
  rightsEvidenceRefs?: readonly string[]
  aspectRatio?: string
  targetRuntimeSeconds?: number
  createdAt?: string
}

export function buildDirectorBriefFromSocial(
  project: ContentProject,
  assetId: string,
  input: SocialDirectorProductionInput,
) {
  const asset = project.assets.find((candidate) => candidate.id === assetId)
  if (!asset) throw new Error("SOCIAL_DIRECTOR_ASSET_NOT_FOUND")

  const mediaType = input.mediaType ?? directorMediaType(asset)
  const briefInput: CreateDirectorSocialProductionBriefInput = {
    id: `social:${project.id}:${asset.id}`,
    socialContentProjectId: project.id,
    socialAssetId: asset.id,
    directorProjectId: input.directorProjectId,
    intent: directorIntent(project, asset),
    mediaType,
    platform: asset.platform,
    aspectRatio: input.aspectRatio,
    targetRuntimeSeconds: input.targetRuntimeSeconds,
    referenceAssetIds: input.referenceAssetIds,
    rightsEvidenceRefs: input.rightsEvidenceRefs,
    evidenceRefs: [...new Set([...project.evidenceRefs, ...asset.evidenceRefs])],
    createdAt: input.createdAt ?? new Date().toISOString(),
  }

  return createDirectorSocialProductionBrief(briefInput)
}

export function acceptDirectorAssetIntoSocial(input: {
  project: ContentProject
  receiptId: string
  brief: ReturnType<typeof buildDirectorBriefFromSocial>
  asset: GeneratedAssetRecord
  review: MediaReviewDecisionRecord
  updatedAt?: string
}): {
  project: ContentProject
  receipt: DirectorSocialApprovedAssetReceipt
} {
  if (input.brief.socialContentProjectId !== input.project.id) {
    throw new Error("SOCIAL_DIRECTOR_PROJECT_MISMATCH")
  }
  if (!input.project.assets.some((candidate) => candidate.id === input.brief.socialAssetId)) {
    throw new Error("SOCIAL_DIRECTOR_ASSET_NOT_FOUND")
  }

  const receipt = issueDirectorSocialApprovedAssetReceipt({
    receiptId: input.receiptId,
    brief: input.brief,
    asset: input.asset,
    review: input.review,
  })

  const project = bindContentAssetMedia(
    input.project,
    receipt.socialAssetId,
    [receipt.uri],
    [
      `director-brief:${receipt.briefId}`,
      `director-asset:${receipt.directorAssetId}`,
      `director-review:${receipt.reviewDecisionId}`,
      ...receipt.reviewEvidenceIds,
    ],
    input.updatedAt ?? receipt.approvedAt,
  )

  return { project, receipt }
}

function directorMediaType(asset: ContentAsset): SocialProductionMediaType {
  switch (asset.kind) {
    case "anchor_video":
    case "live":
    case "short_video":
      return "video"
    case "image":
    case "carousel":
      return "image"
    case "ad":
      return asset.mediaRefs.some((ref) => /\.(mp4|mov|webm)(\?|$)/i.test(ref))
        ? "video"
        : "motion"
    default:
      throw new Error(`SOCIAL_DIRECTOR_MEDIA_KIND_UNSUPPORTED:${asset.kind}`)
  }
}

function directorIntent(project: ContentProject, asset: ContentAsset): string {
  const text = asset.text?.trim()
  if (!text) throw new Error("SOCIAL_DIRECTOR_ASSET_INTENT_REQUIRED")
  return [
    text,
    `Preserve Social content project ${project.id}.`,
    `Authority position: ${project.authorityPositionRef}.`,
    `Content pillar: ${project.pillarRef}.`,
    `Big Idea: ${project.bigIdeaRef}.`,
    `Content job: ${project.primaryJob}.`,
    project.characterProfileRef ? `Social character: ${project.characterProfileRef}.` : "",
    project.voiceProfileRef ? `Brand voice profile: ${project.voiceProfileRef}.` : "",
    "Character/voice references constrain expression only; they do not grant identity, publishing, or spend authority.",
    "Return media production only; do not publish or alter Social approval state.",
  ].filter(Boolean).join("\n")
}
