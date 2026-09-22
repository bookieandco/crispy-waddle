import {
  buildDirectorIntentForMetaAdConcept,
  type ResearchBackedMetaAdPlan,
} from "@jhadina/growth-core"
import {
  createContentProject,
  type ContentProject,
  type JhadinaBrand,
  type SocialCharacterProfile,
  type SocialPlatform,
} from "@jhadina/social-core"
import { buildDirectorBriefFromSocial } from "../social/director-bridge"

export interface MetaResearchCreativeProductionInput {
  brand: JhadinaBrand
  authorityPositionRef: string
  pillarRef: string
  brandPointOfViewRef: string
  brandPointOfView: string
  brandPointOfViewEvidenceRefs: readonly string[]
  character?: SocialCharacterProfile
  directorProjectId: string
  productBibleId?: string
  styleBibleId?: string
  experimentIdsByConceptId?: Readonly<Record<string, string>>
  platform: Extract<SocialPlatform, "facebook" | "instagram">
  aspectRatio?: string
  productIdentityRef?: string
  styleIdentityRef?: string
  platformCreativeProfileRef?: string
  fixedDimensionRefs?: Readonly<Record<string, string>>
  createdAt?: string
}

export interface MetaResearchCreativeProductionJob {
  conceptId: string
  contentProject: ContentProject
  directorBrief: ReturnType<typeof buildDirectorBriefFromSocial>
  testHypothesis: string
  authority: "PRODUCTION_PLAN_ONLY"
  campaignAuthority: "NONE"
}

export function buildMetaResearchCreativeProductionJobs(input: {
  plan: ResearchBackedMetaAdPlan
  production: MetaResearchCreativeProductionInput
}): readonly MetaResearchCreativeProductionJob[] {
  const { plan, production } = input
  if (!production.authorityPositionRef.trim()) throw new Error("META_CREATIVE_AUTHORITY_POSITION_REQUIRED")
  if (!production.pillarRef.trim()) throw new Error("META_CREATIVE_PILLAR_REQUIRED")
  if (!production.brandPointOfViewRef.trim() || !production.brandPointOfView.trim()) {
    throw new Error("META_CREATIVE_BRAND_POV_REQUIRED")
  }
  if (!production.brandPointOfViewEvidenceRefs.length) {
    throw new Error("META_CREATIVE_BRAND_POV_EVIDENCE_REQUIRED")
  }
  if (production.character && production.character.brand !== production.brand) {
    throw new Error("META_CREATIVE_CHARACTER_BRAND_MISMATCH")
  }

  if (Boolean(production.productIdentityRef) !== Boolean(production.styleIdentityRef)) {
    throw new Error("META_CREATIVE_PRODUCT_STYLE_IDENTITY_PAIR_REQUIRED")
  }

  const commercialProductBibleId = production.productBibleId?.trim() || production.productIdentityRef?.trim()
  const commercialStyleBibleId = production.styleBibleId?.trim() || production.styleIdentityRef?.trim()
  if (!commercialProductBibleId) throw new Error("META_CREATIVE_PRODUCT_BIBLE_REQUIRED")
  if (!commercialStyleBibleId) throw new Error("META_CREATIVE_STYLE_BIBLE_REQUIRED")
  if (production.productIdentityRef !== undefined && !production.productIdentityRef.trim()) {
    throw new Error("META_CREATIVE_PRODUCT_IDENTITY_INVALID")
  }
  if (production.styleIdentityRef !== undefined && !production.styleIdentityRef.trim()) {
    throw new Error("META_CREATIVE_STYLE_IDENTITY_INVALID")
  }
  if (production.platformCreativeProfileRef !== undefined && !production.platformCreativeProfileRef.trim()) {
    throw new Error("META_CREATIVE_PLATFORM_PROFILE_INVALID")
  }

  const createdAt = production.createdAt ?? new Date().toISOString()

  return Object.freeze(plan.concepts.map((concept) => {
    const evidenceRefs = [
      ...new Set([
        ...plan.productTruthRefs,
        ...concept.productTruthRefs,
        ...plan.sourcePatternIds.map((id) => `competitor-pattern:${id}`),
        ...plan.sourceObservationIds.map((id) => `competitor-observation:${id}`),
        production.brandPointOfViewRef,
        ...production.brandPointOfViewEvidenceRefs,
        ...(production.character?.evidenceRefs ?? []),
        ...(production.character ? [production.character.id, production.character.voiceProfileRef] : []),
        `director-product-bible:${commercialProductBibleId}`,
        `director-style-bible:${commercialStyleBibleId}`,
      ]),
    ]
    const intent = [
      production.brandPointOfView.trim(),
      buildDirectorIntentForMetaAdConcept({ plan, conceptId: concept.id }),
    ].join("\n\n")

    const contentProject = createContentProject({
      id: `meta-creative:${plan.id}:${concept.id}`,
      brand: production.brand,
      authorityPositionRef: production.authorityPositionRef,
      pillarRef: production.pillarRef,
      bigIdeaRef: `meta-research-plan:${plan.id}`,
      primaryJob: "conversion",
      origin: "research_synthesis",
      characterProfileRef: production.character?.id,
      voiceProfileRef: production.character?.voiceProfileRef,
      evidenceRefs,
      createdAt,
      anchor: {
        id: `meta-ad:${concept.id}`,
        kind: "ad",
        platform: production.platform,
        transformation: "original",
        text: intent,
        mediaRefs: [],
        evidenceRefs,
      },
    })

    const directorBrief = buildDirectorBriefFromSocial(
      contentProject,
      `meta-ad:${concept.id}`,
      {
        directorProjectId: production.directorProjectId,
        mediaType: concept.format === "static_image" || concept.format === "carousel" ? "image" : "video",
        aspectRatio: production.aspectRatio ?? (concept.format === "static_image" ? "1:1" : "4:5"),
        creativeIdentity: production.productIdentityRef && production.styleIdentityRef ? {
          productIdentityRef: production.productIdentityRef,
          styleIdentityRef: production.styleIdentityRef,
          platformCreativeProfileRef: production.platformCreativeProfileRef,
          experimentVariantId: `meta-creative:${plan.id}:${concept.id}`,
          mutationAxis: "net_new_concept",
          fixedDimensionRefs: production.fixedDimensionRefs,
        } : undefined,
        commercialCreative: {
          conceptId: concept.id,
          productBibleId: commercialProductBibleId,
          styleBibleId: commercialStyleBibleId,
          ...(production.experimentIdsByConceptId?.[concept.id]
            ? { experimentId: production.experimentIdsByConceptId[concept.id] }
            : {}),
        },
        createdAt,
      },
    )

    return Object.freeze({
      conceptId: concept.id,
      contentProject,
      directorBrief,
      testHypothesis: concept.testHypothesis,
      authority: "PRODUCTION_PLAN_ONLY",
      campaignAuthority: "NONE",
    })
  }))
}
