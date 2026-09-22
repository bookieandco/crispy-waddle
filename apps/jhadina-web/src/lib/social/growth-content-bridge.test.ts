import { describe, expect, it } from "vitest"
import {
  createHumanPointOfView,
  rankBigIdeas,
  type CreativeEvidenceSignal,
} from "@jhadina/growth-core"
import { getSocialCharacterProfileForBrand } from "@jhadina/social-core"
import { createSocialContentProjectFromGrowth } from "./growth-content-bridge"
import { buildDirectorBriefFromSocial } from "./director-bridge"

const signals: CreativeEvidenceSignal[] = [
  {
    id: "signal:1",
    evidenceClass: "first_party_performance",
    bigIdea: "One strong idea becomes a month of native content",
    sourceRefs: ["social:performance:1"],
    observedAt: "2026-09-22T10:00:00.000Z",
    recurrence: 3,
    conversions: 5,
    contributionMargin: 900,
  },
  {
    id: "signal:2",
    evidenceClass: "customer_language",
    bigIdea: "One strong idea becomes a month of native content",
    sourceRefs: ["comment:1"],
    observedAt: "2026-09-22T11:00:00.000Z",
    recurrence: 2,
  },
]

describe("Growth -> Social -> Director convergence", () => {
  it("turns an evidence-ranked Big Idea and human POV into a Director-ready Social project", () => {
    const bigIdea = rankBigIdeas(signals)[0]!
    const pov = createHumanPointOfView({
      topic: "content systems",
      take: "The idea is the unit; each platform post is only one expression of it.",
      authorId: "brand-owner",
      sourceObservationIds: ["signal:1", "signal:2"],
    })

    const project = createSocialContentProjectFromGrowth({
      id: "social-project:1",
      brand: "jhadina",
      authorityPositionRef: "authority:jhadina",
      pillarRef: "pillar:content-systems",
      primaryJob: "useful",
      bigIdea,
      humanPointOfView: pov,
      sourceEvidenceRefs: ["experiment:content-flywheel"],
      character: getSocialCharacterProfileForBrand("jhadina"),
      anchor: {
        id: "anchor:1",
        kind: "anchor_video",
        platform: "youtube",
      },
      createdAt: "2026-09-22T12:00:00.000Z",
    })

    expect(project.bigIdeaRef).toContain("one-strong-idea")
    expect(project.origin).toBe("human_written")
    expect(project.evidenceRefs).toContain("growth-signal:signal:1")
    expect(project.characterProfileRef).toBe("character:jhadina")
    expect(project.voiceProfileRef).toBe("brand-voice:jhadina")

    const director = buildDirectorBriefFromSocial(project, "anchor:1", {
      directorProjectId: "director-project:1",
      aspectRatio: "16:9",
      targetRuntimeSeconds: 600,
      createdAt: "2026-09-22T12:05:00.000Z",
    })

    expect(director.socialContentProjectId).toBe(project.id)
    expect(director.intent).toContain(project.bigIdeaRef)
    expect(director.intent).toContain("Social character: character:jhadina")
    expect(director.publicationAuthority).toBe("NONE")
  })

  it("accepts an approved brand POV when no individual author is the origin", () => {
    const project = createSocialContentProjectFromGrowth({
      id: "social-project:2",
      brand: "jhadina",
      authorityPositionRef: "authority:jhadina",
      pillarRef: "pillar:creative-evidence",
      primaryJob: "trust",
      bigIdea: rankBigIdeas(signals)[0]!,
      brandPointOfView: {
        ref: "brand-pov:creative-system:v1",
        text: "We scale validated ideas instead of manufacturing filler.",
        evidenceRefs: ["brand-policy:creative:v1"],
      },
      sourceEvidenceRefs: ["experiment:content-flywheel"],
      anchor: {
        id: "anchor:2",
        kind: "text_post",
        platform: "linkedin",
      },
      createdAt: "2026-09-22T12:00:00.000Z",
    })

    expect(project.origin).toBe("research_synthesis")
    expect(project.evidenceRefs).toContain("brand-pov:creative-system:v1")
  })

  it("rejects a character whose brand does not match the content project", () => {
    expect(() => createSocialContentProjectFromGrowth({
      id: "social-project:mismatch",
      brand: "pupsonstuff",
      authorityPositionRef: "authority:pups",
      pillarRef: "pillar:pet",
      primaryJob: "reach",
      bigIdea: rankBigIdeas(signals)[0]!,
      brandPointOfView: {
        ref: "brand-pov:pups:v1",
        text: "Make pet products recognizable and delightful.",
        evidenceRefs: ["brand-policy:pups:v1"],
      },
      sourceEvidenceRefs: ["experiment:pups"],
      character: getSocialCharacterProfileForBrand("atwood-bookie"),
      anchor: {
        id: "anchor:mismatch",
        kind: "short_video",
        platform: "tiktok",
      },
      createdAt: "2026-09-22T12:00:00.000Z",
    })).toThrow("GROWTH_SOCIAL_CHARACTER_BRAND_MISMATCH")
  })

  it("fails closed when Growth has an idea but no approved POV", () => {
    expect(() => createSocialContentProjectFromGrowth({
      id: "social-project:3",
      brand: "jhadina",
      authorityPositionRef: "authority:jhadina",
      pillarRef: "pillar:creative-evidence",
      primaryJob: "reach",
      bigIdea: rankBigIdeas(signals)[0]!,
      sourceEvidenceRefs: ["experiment:content-flywheel"],
      anchor: {
        id: "anchor:3",
        kind: "short_video",
        platform: "tiktok",
      },
      createdAt: "2026-09-22T12:00:00.000Z",
    })).toThrow("GROWTH_SOCIAL_POV_REQUIRED")
  })
})
