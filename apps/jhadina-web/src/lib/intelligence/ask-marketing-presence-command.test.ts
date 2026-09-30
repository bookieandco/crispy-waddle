import { describe, expect, it, vi } from "vitest"
import type { GrowthPresenceRepository } from "../growth/presence-repository"
import {
  handleAskMarketingPresenceCommand,
  inspectAskMarketingPresenceIntent,
} from "./ask-marketing-presence-command"

function repository(): GrowthPresenceRepository {
  return {
    saveCampaign: vi.fn(async ({ campaign, offers, status, contentProjectId }) => ({
      campaign,
      offers,
      status: status ?? "draft",
      contentProjectId,
      updatedAt: campaign.createdAt,
    })),
    getCampaign: vi.fn(),
    listCampaigns: vi.fn(async () => []),
    linkContentProject: vi.fn(),
    recordObservation: vi.fn(async (_userId, observation) => observation),
    listObservations: vi.fn(async () => []),
  }
}

describe("Ask Jhadina marketing presence command", () => {
  it("recognizes marketing a song even without a social-platform keyword", () => {
    const intent = inspectAskMarketingPresenceIntent("Market this song and build a release campaign")
    expect(intent?.kind).toBe("music")
    expect(intent?.brandId).toBe("brand:atwood-bookie")
  })

  it("does not steal explicit paid-ad requests from the paid media path", () => {
    expect(inspectAskMarketingPresenceIntent("Run paid ads for this product on Meta")).toBeNull()
  })

  it("persists a planning-only campaign when the offer is resolved by active project context", async () => {
    const repo = repository()
    const result = await handleAskMarketingPresenceCommand({
      userId: "user-1",
      activeTask: "Market this song and grow its online presence",
      activeProject: "Midnight Test Song",
      artifacts: [{ id: "artifact:master", name: "midnight-master.wav" }],
    }, {
      repository: repo,
      now: () => new Date("2026-09-30T07:20:00Z"),
      randomUUID: () => "fixed-id",
    })

    expect(result?.proposal.disposition).toBe("PROCEED")
    expect(result?.workPlan.authority).toBe("PLANNING_ONLY")
    expect(result?.workPlan.nextBoundary).toBe("growth_research")
    expect(result?.storedCampaign?.campaign.brandId).toBe("brand:atwood-bookie")
    expect(result?.storedCampaign?.offers[0]?.name).toBe("Midnight Test Song")
    expect(repo.saveCampaign).toHaveBeenCalledTimes(1)
  })

  it("asks rather than guessing when a generic product has no owner brand", async () => {
    const repo = repository()
    const result = await handleAskMarketingPresenceCommand({
      userId: "user-1",
      activeTask: "Promote this product online",
      activeProject: "Unknown Product",
    }, {
      repository: repo,
      randomUUID: () => "fixed-id",
    })

    expect(result?.proposal.disposition).toBe("ASK")
    expect(result?.workPlan.persisted).toBe(false)
    expect(repo.saveCampaign).not.toHaveBeenCalled()
  })
})
