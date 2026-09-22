import { describe, expect, it } from "vitest"
import {
  acceptDirectorAssetIntoSocial,
  buildDirectorBriefFromSocial,
} from "./director-bridge"
import { createContentProject } from "@jhadina/social-core"
import {
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
  })

  it("keeps Product/Style Bible and experiment lineage through Director production", async () => {
    const brief = buildDirectorBriefFromSocial(socialProject(), "asset-anchor", {
      directorProjectId: "director-project-1",
      mediaType: "video",
      aspectRatio: "9:16",
      targetRuntimeSeconds: 15,
      commercialCreative: {
        conceptId: "concept:zesta:horse",
        productBibleId: "product-bible:zesta",
        styleBibleId: "style-bible:zesta",
        multiplierVariantId: "variant:mango",
        experimentId: "experiment:zesta-hook",
      },
      createdAt: "2026-09-22T16:05:00.000Z",
    })

    const { compileDirectorSocialTakeRequest } = await import("@jhadina/director-core")
    const take = compileDirectorSocialTakeRequest(brief, {
      storyboardBoardId: "board-ad",
      sceneId: "scene-ad",
    })

    expect(brief.commercialCreative?.productBibleId).toBe("product-bible:zesta")
    expect(take.prompt).toContain("commercial concept: concept:zesta:horse")
    expect(take.prompt).toContain("product identity bible: product-bible:zesta")
    expect(take.prompt).toContain("visual style bible: style-bible:zesta")
    expect(take.prompt).toContain("ad multiplier variant: variant:mango")
    expect(take.prompt).toContain("growth experiment: experiment:zesta-hook")
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
