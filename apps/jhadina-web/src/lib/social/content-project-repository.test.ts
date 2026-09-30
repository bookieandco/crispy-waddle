import { beforeEach, describe, expect, it, vi } from "vitest"
import { createContentProject } from "@jhadina/social-core"

const mocks = vi.hoisted(() => {
  const single = vi.fn()
  const returns = vi.fn()
  const chain: Record<string, any> = {}
  chain.upsert = vi.fn(() => chain)
  chain.select = vi.fn(() => chain)
  chain.single = single
  chain.eq = vi.fn(() => chain)
  chain.order = vi.fn(() => chain)
  chain.returns = returns
  const from = vi.fn(() => chain)
  const createClient = vi.fn(async () => ({ from }))
  return { chain, single, returns, from, createClient }
})

vi.mock("../supabase/server", () => ({ createClient: mocks.createClient }))

import { createContentProjectRepository } from "./content-project-repository"

const project = createContentProject({
  id: "content-project:1",
  brand: "pupsonstuff",
  authorityPositionRef: "authority:pupsonstuff",
  pillarRef: "pillar:product-proof",
  bigIdeaRef: "concept:worst-photo",
  primaryJob: "conversion",
  origin: "operational_evidence",
  evidenceRefs: ["evidence:campaign"],
  anchor: {
    id: "asset:anchor",
    kind: "anchor_video",
    transformation: "original",
    text: "Can PupsonStuff turn a bad dog photo into useful merchandise?",
    mediaRefs: [],
    evidenceRefs: ["evidence:campaign"],
  },
  createdAt: "2026-09-30T07:05:00Z",
})

describe("Social Content Project repository", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("persists Content Project lineage without granting publication authority", async () => {
    mocks.single.mockResolvedValueOnce({
      data: {
        id: project.id,
        user_id: "user-1",
        brand: project.brand,
        authority_position_ref: project.authorityPositionRef,
        pillar_ref: project.pillarRef,
        big_idea_ref: project.bigIdeaRef,
        primary_job: project.primaryJob,
        origin: project.origin,
        presence_campaign_id: "campaign:pupson",
        payload: project,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
      },
      error: null,
    })

    const saved = await createContentProjectRepository().save(
      "user-1",
      project,
      "campaign:pupson",
    )

    expect(mocks.from).toHaveBeenCalledWith("jhadina_social_content_projects")
    expect(mocks.chain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: project.id,
        user_id: "user-1",
        presence_campaign_id: "campaign:pupson",
      }),
      { onConflict: "user_id,id" },
    )
    expect(saved.project.id).toBe(project.id)
    expect(saved.presenceCampaignId).toBe("campaign:pupson")
  })

  it("does not clear an existing campaign link when a later save omits it", async () => {
    mocks.single.mockResolvedValueOnce({
      data: {
        id: project.id,
        user_id: "user-1",
        brand: project.brand,
        authority_position_ref: project.authorityPositionRef,
        pillar_ref: project.pillarRef,
        big_idea_ref: project.bigIdeaRef,
        primary_job: project.primaryJob,
        origin: project.origin,
        presence_campaign_id: "campaign:pupson",
        payload: project,
        created_at: project.createdAt,
        updated_at: project.updatedAt,
      },
      error: null,
    })

    await createContentProjectRepository().save("user-1", project)
    const persisted = mocks.chain.upsert.mock.calls[0]?.[0]
    expect(persisted).not.toHaveProperty("presence_campaign_id")
  })
})
