import type {
  HumanPointOfView,
  RankedBigIdea,
} from "@jhadina/growth-core"
import {
  createContentProject,
  type ContentAssetKind,
  type ContentJob,
  type ContentProject,
  type JhadinaBrand,
  type SocialCharacterProfile,
  type SocialPlatform,
} from "@jhadina/social-core"

export interface GrowthToSocialContentInput {
  id: string
  brand: JhadinaBrand
  authorityPositionRef: string
  pillarRef: string
  primaryJob: ContentJob
  bigIdea: RankedBigIdea
  humanPointOfView?: HumanPointOfView
  brandPointOfView?: {
    ref: string
    text: string
    evidenceRefs: readonly string[]
  }
  sourceEvidenceRefs: readonly string[]
  character?: SocialCharacterProfile
  anchor: {
    id: string
    kind: ContentAssetKind
    platform?: SocialPlatform
    text?: string
  }
  createdAt?: string
}

export function createSocialContentProjectFromGrowth(
  input: GrowthToSocialContentInput,
): ContentProject {
  if (!input.bigIdea.bigIdea.trim()) throw new Error("GROWTH_SOCIAL_BIG_IDEA_REQUIRED")
  if (!input.bigIdea.supportingSignalIds.length) throw new Error("GROWTH_SOCIAL_BIG_IDEA_EVIDENCE_REQUIRED")
  if (!input.sourceEvidenceRefs.length) throw new Error("GROWTH_SOCIAL_SOURCE_EVIDENCE_REQUIRED")
  if (input.character && input.character.brand !== input.brand) {
    throw new Error("GROWTH_SOCIAL_CHARACTER_BRAND_MISMATCH")
  }
  if (!input.humanPointOfView && !input.brandPointOfView) {
    throw new Error("GROWTH_SOCIAL_POV_REQUIRED")
  }
  if (input.humanPointOfView && input.brandPointOfView) {
    throw new Error("GROWTH_SOCIAL_POV_AMBIGUOUS")
  }

  const createdAt = input.createdAt ?? new Date().toISOString()
  const pointOfView = input.humanPointOfView
    ? {
        text: input.humanPointOfView.take,
        ref: `human-pov:${input.humanPointOfView.authorId}:${input.humanPointOfView.topic}`,
        evidenceRefs: [...input.humanPointOfView.sourceObservationIds],
        origin: "human_written" as const,
        humanSourceRefs: [
          `human-pov:${input.humanPointOfView.authorId}:${input.humanPointOfView.topic}`,
        ],
      }
    : {
        text: input.brandPointOfView!.text,
        ref: input.brandPointOfView!.ref,
        evidenceRefs: [...input.brandPointOfView!.evidenceRefs],
        origin: "research_synthesis" as const,
        humanSourceRefs: [] as string[],
      }

  if (!pointOfView.text.trim()) throw new Error("GROWTH_SOCIAL_POV_TEXT_REQUIRED")
  if (!pointOfView.ref.trim()) throw new Error("GROWTH_SOCIAL_POV_REF_REQUIRED")
  if (!pointOfView.evidenceRefs.length) throw new Error("GROWTH_SOCIAL_POV_EVIDENCE_REQUIRED")

  const evidenceRefs = [
    ...new Set([
      ...input.sourceEvidenceRefs,
      ...input.bigIdea.supportingSignalIds.map((id) => `growth-signal:${id}`),
      ...pointOfView.evidenceRefs,
      pointOfView.ref,
      ...(input.character?.evidenceRefs ?? []),
      ...(input.character ? [input.character.id, input.character.voiceProfileRef] : []),
    ]),
  ]

  const anchorText = input.anchor.text?.trim() || [
    pointOfView.text.trim(),
    `Big Idea: ${input.bigIdea.bigIdea.trim()}.`,
    `Evidence state: ${input.bigIdea.status}; score=${input.bigIdea.evidenceScore.toFixed(3)}.`,
  ].join("\n")

  return createContentProject({
    id: input.id,
    brand: input.brand,
    authorityPositionRef: input.authorityPositionRef,
    pillarRef: input.pillarRef,
    bigIdeaRef: `growth-big-idea:${slug(input.bigIdea.bigIdea)}`,
    primaryJob: input.primaryJob,
    origin: pointOfView.origin,
    characterProfileRef: input.character?.id,
    voiceProfileRef: input.character?.voiceProfileRef,
    humanSourceRefs: pointOfView.humanSourceRefs,
    evidenceRefs,
    createdAt,
    anchor: {
      id: input.anchor.id,
      kind: input.anchor.kind,
      platform: input.anchor.platform,
      transformation: "original",
      text: anchorText,
      mediaRefs: [],
      evidenceRefs,
    },
  })
}

function slug(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
  if (!normalized) throw new Error("GROWTH_SOCIAL_BIG_IDEA_SLUG_REQUIRED")
  return normalized.slice(0, 96)
}
