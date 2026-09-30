import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const verify = vi.fn(async () => ({ userId: "user-1", sessionId: "session-1" }))
const inspectMarketing = vi.fn()
const handleMarketing = vi.fn()
const inspectGrowth = vi.fn()
const handleGrowth = vi.fn()
const inspectSocial = vi.fn()
const handleSocial = vi.fn()
const inspectVideo = vi.fn()
const createVideo = vi.fn()
const handleGeneric = vi.fn()
const recordShortcutExperience = vi.fn(async () => "reason-marketing")
const realizeExpression = vi.fn(async (input: {
  proposal: { recommendation: string; disposition: string }
}) => ({
  proposal: input.proposal,
  presentation: {
    mode: input.proposal.disposition === "ASK" ? "clarifying" : "direct",
    allowProfanity: false,
    allowQuip: true,
  },
  segments: [{ kind: "semantic", text: input.proposal.recommendation }],
}))

vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify }),
}))

vi.mock("@/lib/intelligence/ask-marketing-presence-command", () => ({
  inspectAskMarketingPresenceIntent: (...args: unknown[]) => inspectMarketing(...args),
  handleAskMarketingPresenceCommand: (...args: unknown[]) => handleMarketing(...args),
}))

vi.mock("@/lib/intelligence/ask-growth-command", () => ({
  inspectAskGrowthReadIntent: (...args: unknown[]) => inspectGrowth(...args),
  handleAskGrowthReadCommand: (...args: unknown[]) => handleGrowth(...args),
}))

vi.mock("@/lib/intelligence/ask-social-command", () => ({
  inspectAskSocialIntent: (...args: unknown[]) => inspectSocial(...args),
  handleAskSocialCommand: (...args: unknown[]) => handleSocial(...args),
}))

vi.mock("@/lib/director-video-job-service", () => ({
  inspectAskVideoIntent: (...args: unknown[]) => inspectVideo(...args),
  createAndSubmitAskVideoJob: (...args: unknown[]) => createVideo(...args),
}))

vi.mock("@/lib/intelligence/jhadina-command", () => ({
  handleJhadinaCommand: (...args: unknown[]) => handleGeneric(...args),
}))

vi.mock("@/lib/intelligence/ask-shortcut-experience", () => ({
  recordAskShortcutExperience: recordShortcutExperience,
  finalizeAskShortcutExperience: vi.fn(),
}))

vi.mock("@/lib/intelligence/ask-expression", () => ({
  realizeAskJhadinaExpression: realizeExpression,
}))

import { POST } from "./route"

function request() {
  return new NextRequest("http://localhost/api/jhadina/command", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-jhadina-user-id": "user-1",
    },
    body: JSON.stringify({
      activeTask: "Market this song and grow its online presence",
      activeProject: "Midnight Test Song",
      surface: "music",
      route: "/music",
    }),
  })
}

describe("Ask Jhadina Marketing Presence routing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inspectGrowth.mockReturnValue(null)
    inspectSocial.mockReturnValue(null)
    inspectVideo.mockReturnValue(null)
    inspectMarketing.mockReturnValue({
      matched: true,
      kind: "music",
      brandId: "brand:atwood-bookie",
      mechanic: "demonstration",
    })
    handleMarketing.mockResolvedValue({
      proposal: {
        id: "proposal-presence",
        contextId: "presence:campaign-1",
        disposition: "PROCEED",
        recommendation: "Campaign campaign-1 is now durable.",
        rationale: "Planning-only marketing presence.",
        evidence: [],
        uncertainty: [],
        alternatives: [],
      },
      workPlan: {
        kind: "marketing_presence",
        authority: "PLANNING_ONLY",
        nextBoundary: "growth_research",
        brandId: "brand:atwood-bookie",
        sellableKind: "music",
        offerName: "Midnight Test Song",
        campaignId: "campaign-1",
        persisted: true,
        targetQuestions: ["What is Midnight Test Song?"],
        notes: [],
      },
      storedCampaign: {
        campaign: { id: "campaign-1" },
        offers: [],
        status: "draft",
        updatedAt: "2026-09-30T07:30:00Z",
      },
      verified: true,
      verificationReason: "persisted",
    })
  })

  it("routes a marketing request before ordinary Growth/Social shortcuts", async () => {
    const response = await POST(request())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(verify).toHaveBeenCalledWith({ userId: "user-1" })
    expect(handleMarketing).toHaveBeenCalledWith(expect.objectContaining({
      userId: "user-1",
      activeTask: "Market this song and grow its online presence",
      activeProject: "Midnight Test Song",
    }))
    expect(json.data.marketingPresenceWorkPlan).toEqual(expect.objectContaining({
      campaignId: "campaign-1",
      authority: "PLANNING_ONLY",
      nextBoundary: "growth_research",
    }))
    expect(recordShortcutExperience).toHaveBeenCalledWith(expect.objectContaining({
      shortcut: "growth",
      metadata: expect.objectContaining({
        operation: "marketing_presence",
        campaignId: "campaign-1",
        persisted: true,
      }),
    }))
    expect(handleGrowth).not.toHaveBeenCalled()
    expect(handleSocial).not.toHaveBeenCalled()
    expect(createVideo).not.toHaveBeenCalled()
    expect(handleGeneric).not.toHaveBeenCalled()
  })
})
