import { describe, expect, it, vi } from "vitest"
import type { RankedBigIdea } from "@jhadina/growth-core"
import type { StoredPresenceCampaign } from "../growth/presence-repository"
import {
  compilePresenceCampaignToContentProject,
} from "./presence-content-project-service"

const rankedBigIdea: RankedBigIdea = {
  bigIdea: "Prove the transformation with a difficult-photo challenge",
  evidenceScore: 0.78,
  firstPartySupport: false,
  supportingSignalIds: ["signal:customer-language", "signal:organic-pattern"],
  evidenceClasses: ["customer_language", "organic_pattern"],
  status: "promising",
}

const campaign: StoredPresenceCampaign = {
  campaign: {
    id: "presence:pupson-1",
    brandId: "brand:pupsonstuff",
    concept: {
      id: "concept:pupson-1",
      name: "Worst pet photo challenge",
      mechanic: "challenge",
      thesis: "Demonstrate product quality using difficult source photos.",
      hook: "We gave PupsonStuff the worst dog photos we could find.",
      evidenceRefs: ["evidence:concept"],
      targetQuestions: ["Can AI turn a bad dog photo into custom merchandise?"],
    },
    offerIds: ["offer:pupson"],
    bridges: [],
    durablePresence: [{
      campaignId: "presence:pupson-1",
      question: "Can AI turn a bad dog photo into custom merchandise?",
      surfaces: ["web:owned", "search:google", "search:ai", "social:youtube"],
      sourceOfferIds: ["offer:pupson"],
      evidenceRefs: ["evidence:concept", "evidence:product"],
      authority: "CONTENT_STRATEGY_ONLY",
    }],
    createdAt: "2026-09-30T07:30:00Z",
    authority: "MARKETING_STRATEGY_ONLY",
  },
  offers: [{
    id: "offer:pupson",
    brandId: "brand:pupsonstuff",
    name: "PupsonStuff",
    kind: "commerce",
    objective: "sale",
    evidenceRefs: ["evidence:product"],
  }],
  status: "draft",
  updatedAt: "2026-09-30T07:30:00Z",
}

describe("Presence Campaign -> Social Content Project service", () => {
  it("requires Growth validation before content production lineage is created", async () => {
    await expect(compilePresenceCampaignToContentProject({
      userId: "user-1",
      campaign,
      rankedBigIdea: { ...rankedBigIdea, status: "hypothesis", evidenceScore: 0.4 },
      authorityPositionRef: "authority:pupsonstuff",
      pillarRef: "pillar:product-proof",
      brandPointOfView: {
        ref: "brand-pov:pupson:proof",
        text: "Show the transformation honestly, including difficult inputs.",
        evidenceRefs: ["evidence:brand-pov"],
      },
    }, {
      contentProjectRepository: {
        save: vi.fn(),
        get: vi.fn(),
        list: vi.fn(),
      },
      presenceRepository: {
        saveCampaign: vi.fn(),
        getCampaign: vi.fn(),
        listCampaigns: vi.fn(),
        linkContentProject: vi.fn(),
        recordObservation: vi.fn(),
        listObservations: vi.fn(),
      },
    })).rejects.toThrow("PRESENCE_CONTENT_BIG_IDEA_NOT_VALIDATED")
  })

  it("persists and links a validated content project without publication authority", async () => {
    const save = vi.fn(async (_userId, project, presenceCampaignId) => ({
      project,
      presenceCampaignId,
    }))
    const link = vi.fn(async (_userId, _campaignId, contentProjectId) => ({
      ...campaign,
      contentProjectId,
      status: "active" as const,
      updatedAt: "2026-09-30T07:31:00Z",
    }))

    const result = await compilePresenceCampaignToContentProject({
      userId: "user-1",
      campaign,
      rankedBigIdea,
      authorityPositionRef: "authority:pupsonstuff",
      pillarRef: "pillar:product-proof",
      brandPointOfView: {
        ref: "brand-pov:pupson:proof",
        text: "Show the transformation honestly, including difficult inputs.",
        evidenceRefs: ["evidence:brand-pov"],
      },
      createdAt: "2026-09-30T07:31:00Z",
    }, {
      contentProjectRepository: {
        save,
        get: vi.fn(),
        list: vi.fn(),
      },
      presenceRepository: {
        saveCampaign: vi.fn(),
        getCampaign: vi.fn(),
        listCampaigns: vi.fn(),
        linkContentProject: link,
        recordObservation: vi.fn(),
        listObservations: vi.fn(),
      },
    })

    expect(result.contentProject.project.brand).toBe("pupsonstuff")
    expect(result.contentProject.project.primaryJob).toBe("conversion")
    expect(result.contentProject.project.assets[0]?.kind).toBe("anchor_video")
    expect(result.directorReady).toBe(true)
    expect(result.publicationAuthority).toBe("NONE")
    expect(save).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ id: "content:presence:pupson-1" }),
      "presence:pupson-1",
    )
    expect(link).toHaveBeenCalledWith(
      "user-1",
      "presence:pupson-1",
      "content:presence:pupson-1",
    )
  })

  it("refuses to create a second content project for an already-linked campaign", async () => {
    await expect(compilePresenceCampaignToContentProject({
      userId: "user-1",
      campaign: { ...campaign, contentProjectId: "content:existing" },
      rankedBigIdea,
      authorityPositionRef: "authority:pupsonstuff",
      pillarRef: "pillar:product-proof",
      brandPointOfView: {
        ref: "brand-pov:pupson:proof",
        text: "Use real product evidence.",
        evidenceRefs: ["evidence:brand-pov"],
      },
    })).rejects.toThrow("PRESENCE_CONTENT_PROJECT_ALREADY_LINKED")
  })
})
