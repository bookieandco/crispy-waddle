import { beforeEach, describe, expect, it, vi } from "vitest"
import { buildPresenceCampaign } from "@jhadina/growth-core"

const mocks = vi.hoisted(() => {
  const single = vi.fn()
  const returns = vi.fn()
  const chain: Record<string, any> = {}
  chain.upsert = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.single = single
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.update = vi.fn(() => chain)
  chain.returns = returns
  const from = vi.fn(() => chain)
  const createClient = vi.fn(async () => ({ from }))
  return { chain, single, returns, from, createClient }
})

vi.mock("../supabase/server", () => ({ createClient: mocks.createClient }))

import { createGrowthPresenceRepository } from "./presence-repository"

const offers = [
  {
    id: "offer:song",
    brandId: "brand:atwood-bookie",
    name: "Song",
    kind: "music" as const,
    objective: "stream" as const,
    evidenceRefs: ["evidence:song"],
  },
  {
    id: "offer:shirt",
    brandId: "brand:atwood-bookie",
    name: "Shirt",
    kind: "merchandise" as const,
    objective: "sale" as const,
    evidenceRefs: ["evidence:shirt"],
  },
]

const campaign = buildPresenceCampaign({
  id: "campaign:1",
  brandId: "brand:atwood-bookie",
  concept: {
    id: "concept:1",
    name: "Movie world",
    mechanic: "story",
    thesis: "Use one story world across song and merch.",
    hook: "The movie that does not exist.",
    evidenceRefs: ["evidence:concept"],
    targetQuestions: ["What song feels like end credits to a lost movie?"],
  },
  offers,
  bridges: [{
    fromOfferId: "offer:song",
    toOfferId: "offer:shirt",
    relationship: "story_world",
    rationale: "One story world connects the soundtrack and merch.",
  }],
  createdAt: "2026-09-30T07:05:00Z",
})

describe("Growth presence repository", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("persists a complete offer snapshot with owner scope", async () => {
    mocks.single.mockResolvedValueOnce({
      data: {
        id: campaign.id,
        user_id: "user-1",
        brand_id: campaign.brandId,
        payload: { campaign, offers },
        content_project_id: null,
        status: "draft",
        created_at: campaign.createdAt,
        updated_at: "2026-09-30T07:06:00Z",
      },
      error: null,
    })

    const saved = await createGrowthPresenceRepository().saveCampaign({
      userId: "user-1",
      campaign,
      offers,
    })

    expect(mocks.from).toHaveBeenCalledWith("jhadina_growth_presence_campaigns")
    expect(mocks.chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: campaign.id,
        user_id: "user-1",
        brand_id: campaign.brandId,
      }),
      { onConflict: "user_id,id" },
    )
    const persisted = mocks.chain.upsert.mock.calls[0]?.[0]
    expect(persisted).not.toHaveProperty("content_project_id")
    expect(persisted).not.toHaveProperty("status")
    expect(saved.status).toBe("draft")
  })

  it("rejects an incomplete offer snapshot before touching Supabase", async () => {
    await expect(createGrowthPresenceRepository().saveCampaign({
      userId: "user-1",
      campaign,
      offers: offers.slice(0, 1),
    })).rejects.toThrow("GROWTH_PRESENCE_PERSISTENCE_OFFER_SNAPSHOT_INCOMPLETE")
    expect(mocks.createClient).not.toHaveBeenCalled()
  })

  it("stores citation observations separately from commerce outcomes", async () => {
    const observation = {
      id: "obs:1",
      campaignId: campaign.id,
      surface: "search:ai" as const,
      queryOrContext: "lost movie soundtrack",
      observedAt: "2026-09-30T07:10:00Z",
      outcome: "cited" as const,
      sourceLocator: "https://example.test/result",
      evidenceRefs: ["receipt:answer"],
    }
    mocks.single.mockResolvedValueOnce({
      data: {
        id: observation.id,
        user_id: "user-1",
        campaign_id: observation.campaignId,
        surface: observation.surface,
        query_or_context: observation.queryOrContext,
        observed_at: observation.observedAt,
        outcome: observation.outcome,
        source_locator: observation.sourceLocator,
        value: null,
        evidence_refs: observation.evidenceRefs,
        created_at: observation.observedAt,
      },
      error: null,
    })

    const stored = await createGrowthPresenceRepository().recordObservation("user-1", observation)
    expect(mocks.from).toHaveBeenCalledWith("jhadina_growth_presence_observations")
    expect(stored.outcome).toBe("cited")
    expect(stored.value).toBeUndefined()
  })
})
