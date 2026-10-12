import {
  bindContentAssetMedia,
  getSocialCharacterProfile,
  type ContentAsset,
  type ContentProject,
  resolveEffectiveSocialIdentity,
  type EffectiveSocialIdentityInput,
  type EffectiveSocialIdentity,
} from "@jhadina/social-core"
import {
  createDirectorSocialProductionBrief,
  issueDirectorSocialApprovedAssetReceipt,
  type CreateDirectorSocialProductionBriefInput,
  type DirectorSocialApprovedAssetReceipt,
  type DirectorSocialCommercialCreativeRef,
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
  creativeIdentity?: CreateDirectorSocialProductionBriefInput["creativeIdentity"]
  commercialCreative?: DirectorSocialCommercialCreativeRef
  /** Authenticated runtime must provide real account, approved identity and voice sources. */
  identityContext?: EffectiveSocialIdentityInput
  createdAt?: string
}

export function buildDirectorBriefFromSocial(
  project: ContentProject,
  assetId: string,
  input: SocialDirectorProductionInput,
) {
  const asset = project.assets.find((candidate) => candidate.id === assetId)
  if (!asset) throw new Error("SOCIAL_DIRECTOR_ASSET_NOT_FOUND")
  const effective = input.identityContext
    ? verifiedEffectiveForProject(project, asset, input.identityContext)
    : undefined

  const mediaType = input.mediaType ?? directorMediaType(asset)
  const briefInput: CreateDirectorSocialProductionBriefInput = {
    id: `social:${project.id}:${asset.id}`,
    socialContentProjectId: project.id,
    socialAssetId: asset.id,
    directorProjectId: input.directorProjectId,
    intent: directorIntent(project, asset, effective),
    mediaType,
    platform: asset.platform,
    aspectRatio: input.aspectRatio,
    targetRuntimeSeconds: input.targetRuntimeSeconds,
    creativeIdentity: input.creativeIdentity,
    commercialCreative: input.commercialCreative,
    referenceAssetIds: input.referenceAssetIds,
    rightsEvidenceRefs: input.rightsEvidenceRefs,
    evidenceRefs: [...new Set([
      ...project.evidenceRefs, ...asset.evidenceRefs,
      ...(effective ? [effectiveIdentityEvidenceRef(effective)] : []),
    ])],
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
  /** Required for receipts built with account-identity evidence lineage. */
  identityContext?: EffectiveSocialIdentityInput
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

  const selectedAsset = input.project.assets.find(asset => asset.id === input.brief.socialAssetId)!
  const lineage = input.brief.evidenceRefs.filter(ref => ref.startsWith("social-effective-identity:"))
  if (lineage.length > 1) throw new Error("SOCIAL_DIRECTOR_IDENTITY_LINEAGE_AMBIGUOUS")
  if (lineage.length && !input.identityContext)
    throw new Error("SOCIAL_DIRECTOR_IDENTITY_CONTEXT_REQUIRED")
  if (input.identityContext) {
    const effective = verifiedEffectiveForProject(input.project, selectedAsset, input.identityContext)
    if (lineage.length !== 1 || lineage[0] !== effectiveIdentityEvidenceRef(effective))
      throw new Error("SOCIAL_DIRECTOR_IDENTITY_CHANGED_REAPPROVAL_REQUIRED")
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
      ...lineage,
      ...(receipt.creativeIdentity?.productIdentityRef ? [`product-identity:${receipt.creativeIdentity.productIdentityRef}`] : []),
      ...(receipt.creativeIdentity?.styleIdentityRef ? [`style-identity:${receipt.creativeIdentity.styleIdentityRef}`] : []),
      ...(receipt.creativeIdentity?.platformCreativeProfileRef ? [`platform-creative-profile:${receipt.creativeIdentity.platformCreativeProfileRef}`] : []),
      ...(receipt.creativeIdentity?.experimentVariantId ? [`experiment-variant:${receipt.creativeIdentity.experimentVariantId}`] : []),
      ...(receipt.creativeIdentity?.mutationAxis ? [`creative-mutation-axis:${receipt.creativeIdentity.mutationAxis}`] : []),
      ...Object.entries(receipt.creativeIdentity?.fixedDimensionRefs ?? {}).map(([key, value]) => `creative-invariant:${key}:${value}`),
      ...(receipt.commercialCreative?.conceptId ? [`commercial-concept:${receipt.commercialCreative.conceptId}`] : []),
      ...(receipt.commercialCreative?.productBibleId ? [`director-product-bible:${receipt.commercialCreative.productBibleId}`] : []),
      ...(receipt.commercialCreative?.styleBibleId ? [`director-style-bible:${receipt.commercialCreative.styleBibleId}`] : []),
      ...(receipt.commercialCreative?.multiplierVariantId ? [`ad-multiplier-variant:${receipt.commercialCreative.multiplierVariantId}`] : []),
      ...(receipt.commercialCreative?.experimentId ? [`growth-experiment:${receipt.commercialCreative.experimentId}`] : []),
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

function effectiveIdentityEvidenceRef(effective: EffectiveSocialIdentity): string {
  // Exact semantic lock, not an authorization signature. The metadata is
  // retained by Director receipts; never present it as provider approval.
  return "social-effective-identity:" + encodeURIComponent(effective.fingerprint)
}

function verifiedEffectiveForProject(
  project: ContentProject,
  asset: ContentAsset,
  context: EffectiveSocialIdentityInput,
): EffectiveSocialIdentity {
  const effective = resolveEffectiveSocialIdentity(context)
  if (project.brand !== effective.scope.brandId ||
      asset.platform !== effective.scope.platform ||
      project.characterProfileRef !== effective.characterProfileRef ||
      project.voiceProfileRef !== effective.brandVoiceProfileRef ||
      (project.speakerIdentityRef ?? "") !== (effective.speakerIdentityRef ?? ""))
    throw new Error("SOCIAL_DIRECTOR_EFFECTIVE_IDENTITY_MISMATCH")
  const canonicalCharacter = getSocialCharacterProfile(effective.characterProfileRef)
  if (!canonicalCharacter || canonicalCharacter.brand !== project.brand)
    throw new Error("SOCIAL_DIRECTOR_CANONICAL_CHARACTER_REQUIRED")
  return effective
}

function directorIntent(project: ContentProject, asset: ContentAsset, effective?: EffectiveSocialIdentity): string {
  const text = asset.text?.trim()
  if (!text) throw new Error("SOCIAL_DIRECTOR_ASSET_INTENT_REQUIRED")

  let characterLines: string[] = []
  if (project.characterProfileRef || project.voiceProfileRef) {
    if (!project.characterProfileRef || !project.voiceProfileRef) {
      throw new Error("SOCIAL_DIRECTOR_CHARACTER_VOICE_PAIR_REQUIRED")
    }
    const character = getSocialCharacterProfile(project.characterProfileRef)
    if (!character) throw new Error("SOCIAL_DIRECTOR_CHARACTER_NOT_FOUND")
    if (character.brand !== project.brand) throw new Error("SOCIAL_DIRECTOR_CHARACTER_BRAND_MISMATCH")
    if (character.voiceProfileRef !== project.voiceProfileRef) {
      throw new Error("SOCIAL_DIRECTOR_VOICE_PROFILE_MISMATCH")
    }
    if(project.speakerIdentityRef && project.speakerIdentityRef !== character.speakerIdentityRef){
      throw new Error("SOCIAL_DIRECTOR_SPEAKER_IDENTITY_MISMATCH")
    }
    characterLines = [
      `Social character: ${character.id} (${character.label}).`,
      `Brand expression voice profile: ${character.voiceProfileRef}.`,
      ...(character.speakerIdentityRef ? [`Canonical acoustic speaker identity: ${character.speakerIdentityRef}.`] : []),
      `Character tone: ${character.toneTraits.join(", ")}.`,
      `Character point of view: ${character.pointOfView}`,
    ]
  }

  return [
    text,
    `Preserve Social content project ${project.id}.`,
    `Authority position: ${project.authorityPositionRef}.`,
    `Content pillar: ${project.pillarRef}.`,
    `Big Idea: ${project.bigIdeaRef}.`,
    `Content job: ${project.primaryJob}.`,
    ...characterLines,
    ...(effective ? [
      `Approved Social account: ${effective.scope.accountId} (${effective.scope.platform}), identity version ${effective.version}.`,
      `Account expression tone: ${effective.toneTraits.join(", ")}.`,
      `Account point of view: ${effective.pointOfView}.`,
      `Preserve current brand disclosure and safety rules: ${effective.disclosureRules.join("; ") || "none specified"}.`,
      "Approved account overlay may refine presentation but cannot change the underlying brand identity or grant actions.",
    ] : []),
    "Character/voice references constrain expression only; they do not grant identity, publishing, or spend authority.",
    "Return media production only; do not publish or alter Social approval state.",
  ].filter(Boolean).join("\n")
}
