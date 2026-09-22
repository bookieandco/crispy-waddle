import { describe, expect, it } from "vitest"
import {
  acceptDirectorAssetIntoSocial,
  buildDirectorBriefFromSocial,
} from "./director-bridge"
import { createContentProject } from "@jhadina/social-core"
import {
  compileDirectorSocialTakeRequest,
  expectedDirectorSocialGenerationJobId,
  type GeneratedAssetRecord,
  type MediaReviewDecisionRecord,
} from "@jhadina/director-core"

function socialProject() {
  return createContentProject({
    id: "social-project-1",
    brand: "jhadina",
    authorityPositionRef: "authority:jhadina",
    pillarRef: "pillar:social",
    bigIdeaRef: "idea:director-integration",
    primaryJob: "useful",
    origin: "human_written",
    characterProfileRef: "character:jhadina",
    voiceProfileRef: "brand-voice:jhadina",
    humanSourceRefs: ["note:1"],
    evidenceRefs: ["evidence:1"],
    createdAt: "2026-09-22T16:00:00.000Z",
    anchor: {
      id: "asset-anchor",
      kind: "anchor_video",
      transformation: "original",
      text: "Show how the social automation workflow works with a direct product demo.",
      mediaRefs: [],
      evidenceRefs: ["evidence:1"],
    },
  })
}

describe("Social Director bridge", () => {
  it("turns a Social content asset into a Director-owned production brief", () => {
    const brief = buildDirectorBriefFromSocial(socialProject(), "asset-anchor", {
      directorProjectId: "director-project-1",
      aspectRatio: "16:9",
      targetRuntimeSeconds: 60,
      createdAt: "2026-09-22T16:05:00.000Z",
    })

    expect(brief.sourceSystem).toBe("social")
    expect(brief.socialContentProjectId).toBe("social-project-1")
    expect(brief.directorProjectId).toBe("director-project-1")
    expect(brief.mediaType).toBe("video")
    expect(brief.authority).toBe("PLANNING_ONLY")
    expect(brief.publicationAuthority).toBe("NONE")
    expect(brief.intent).toContain("Big Idea: idea:director-integration")
    expect(brief.intent).toContain("Social character: character:jhadina")
    expect(brief.intent).toContain("Brand voice profile: brand-voice:jhadina")
    expect(brief.intent).toContain("Character tone: direct, intelligent, evidence-aware, adaptive")
    expect(brief.intent).toContain("Character point of view: Make complex systems useful")
    expect(brief.intent).toContain("constrain expression only")
  })

  it("carries product/style/ad-experiment lineage without losing Social character identity", () => {
    const brief = buildDirectorBriefFromSocial(socialProject(), "asset-anchor", {
      directorProjectId: "director-project-1",
      aspectRatio: "9:16",
      targetRuntimeSeconds: 15,
      referenceAssetIds: ["product:zesta:hero", "product:zesta:label"],
      rightsEvidenceRefs: ["rights:zesta"],
      creativeIdentity: {
        productIdentityRef: "product-bible:zesta",
        styleIdentityRef: "style:zesta-cinematic",
        experimentVariantId: "variant:horse-hook",
        mutationAxis: "hook",
        fixedDimensionRefs: { offer: "offer:zesta:base" },
      },
      commercialCreative: {
        conceptId: "creative:zesta:horse",
        productBibleId: "product-bible:zesta",
        styleBibleId: "style:zesta-cinematic",
        multiplierVariantId: "ad:zesta:mango",
        experimentId: "ab:zesta-hooks",
      },
      createdAt: "2026-09-22T16:05:00.000Z",
    })

    const take = compileDirectorSocialTakeRequest(brief, {
      storyboardBoardId: "board-ad",
      sceneId: "scene-ad",
    })

    expect(brief.commercialCreative?.productBibleId).toBe("product-bible:zesta")
    expect(brief.creativeIdentity?.mutationAxis).toBe("hook")
    expect(brief.intent).toContain("Social character: character:jhadina")
    expect(take.prompt).toContain("commercial concept: creative:zesta:horse")
    expect(take.prompt).toContain("product identity bible: product-bible:zesta")
    expect(take.prompt).toContain("visual style bible: style:zesta-cinematic")
    expect(take.prompt).toContain("ad multiplier variant: ad:zesta:mango")
    expect(take.prompt).toContain("growth experiment: ab:zesta-hooks")
    expect(take.prompt).toContain("experiment variant: variant:horse-hook")
    expect(take.prompt).toContain("only intended creative mutation: hook")
  })

  it("fails closed when a ContentProject carries an unknown Social character", () => {
    const project = createContentProject({
      id: "social-project-unknown-character",
      brand: "jhadina",
      authorityPositionRef: "authority:jhadina",
      pillarRef: "pillar:social",
      bigIdeaRef: "idea:unknown-character",
      primaryJob: "reach",
      origin: "human_written",
      characterProfileRef: "character:not-real",
      voiceProfileRef: "brand-voice:not-real",
      humanSourceRefs: ["note:unknown"],
      evidenceRefs: ["evidence:unknown"],
      createdAt: "2026-09-22T16:00:00.000Z",
      anchor: {
        id: "asset-unknown",
        kind: "short_video",
        transformation: "original",
        text: "Unknown character should not reach Director.",
        mediaRefs: [],
        evidenceRefs: ["evidence:unknown"],
      },
    })

    expect(() => buildDirectorBriefFromSocial(project, "asset-unknown", {
      directorProjectId: "director-project-1",
    })).toThrow("SOCIAL_DIRECTOR_CHARACTER_NOT_FOUND")
  })

  it("does not send text-only Social assets through Director media production", () => {
    const project = createContentProject({
      id: "social-project-2",
      brand: "jhadina",
      authorityPositionRef: "authority:jhadina",
      pillarRef: "pillar:social",
      bigIdeaRef: "idea:text",
      primaryJob: "useful",
      origin: "human_written",
      humanSourceRefs: ["note:2"],
      evidenceRefs: ["evidence:2"],
      createdAt: "2026-09-22T16:00:00.000Z",
      anchor: {
        id: "text-asset",
        kind: "text_post",
        transformation: "original",
        text: "This stays a Social text asset.",
        mediaRefs: [],
        evidenceRefs: ["evidence:2"],
      },
    })

    expect(() => buildDirectorBriefFromSocial(project, "text-asset", {
      directorProjectId: "director-project-1",
    })).toThrow("SOCIAL_DIRECTOR_MEDIA_KIND_UNSUPPORTED:text_post")
  })

  it("binds only a Director-approved asset back into the same Social asset", () => {
    const project = socialProject()
    const brief = buildDirectorBriefFromSocial(project, "asset-anchor", {
      directorProjectId: "director-project-1",
      createdAt: "2026-09-22T16:05:00.000Z",
    })
    const generationJobId = expectedDirectorSocialGenerationJobId(brief)
    const provenance = {
      projectId: "director-project-1",
      storyboardBoardIds: ["board-1"],
      storyboardVersion: 1,
      generationStageId: "generation-stage",
      generationStageVersion: 1,
      generationJobId,
    }
    const asset: GeneratedAssetRecord = {
      id: "director-asset-1",
      projectId: "director-project-1",
      generationJobId,
      providerId: "provider-1",
      mediaType: "video",
      uri: "https://media.example/final.mp4",
      createdAt: "2026-09-22T16:10:00.000Z",
      provenance,
    }
    const review: MediaReviewDecisionRecord = {
      id: "review-1",
      projectId: "director-project-1",
      runId: "run-1",
      gateId: "gate-1",
      generationStageId: "generation-stage",
      generationStageVersion: 1,
      reviewStageId: "review-stage",
      reviewStageVersion: 1,
      assetId: asset.id,
      generationJobId,
      decision: "approved",
      evidenceIds: ["qc:video:1"],
      decidedBy: "user-1",
      decidedAt: "2026-09-22T16:12:00.000Z",
      provenance,
    }

    const result = acceptDirectorAssetIntoSocial({
      project,
      receiptId: "receipt-1",
      brief,
      asset,
      review,
    })

    expect(result.project.assets[0].mediaRefs).toEqual(["https://media.example/final.mp4"])
    expect(result.project.assets[0].evidenceRefs).toContain("director-review:review-1")
    expect(result.receipt.publicationAuthority).toBe("NONE")
  })
})
