import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const verify = vi.fn(async () => ({ userId: "user-1", sessionId: "session-1" }))
const handleGrowth = vi.fn()
const inspectGrowth = vi.fn()
const handleSocial = vi.fn()
const inspectSocial = vi.fn()
const inspectVideo = vi.fn()
const createVideo = vi.fn()
const handleGeneric = vi.fn()
const recordShortcutExperience = vi.fn(async (input: { shortcut: string }) => `reason-${input.shortcut}`)
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
  recordAskShortcutExperience: (input: unknown) => recordShortcutExperience(input as { shortcut: string }),
}))

vi.mock("@/lib/intelligence/ask-expression", () => ({
  realizeAskJhadinaExpression: (input: unknown) => realizeExpression(input as {
    proposal: { recommendation: string; disposition: string }
  }),
}))

import { POST } from "./route"

function request(activeTask: string) {
  return new NextRequest("http://localhost/api/jhadina/command", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-jhadina-user-id": "user-1",
    },
    body: JSON.stringify({ activeTask, surface: "assistant", route: "/ask-jhadina" }),
  })
}

describe("Ask Jhadina Growth routing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inspectGrowth.mockReturnValue(null)
    inspectSocial.mockReturnValue(null)
    inspectVideo.mockReturnValue(null)
  })

  it("routes a Growth state read before Social planning", async () => {
    inspectGrowth.mockReturnValue({ matched: true, operation: "list_campaigns" })
    inspectSocial.mockReturnValue({
      matched: true,
      operation: "paid_campaign",
      requestedPlatforms: ["instagram"],
      requestedCharacterProfiles: [],
      accountTerms: [],
    })
    handleGrowth.mockResolvedValue({
      proposal: {
        id: "proposal-growth",
        contextId: "ctx-growth",
        disposition: "PROCEED",
        recommendation: "I found 2 durable paid campaign records.",
        rationale: "Read-only Growth state.",
        evidence: [],
        uncertainty: [],
        alternatives: [],
      },
      reasoningEventId: "growth-command:1",
      workPlan: {
        kind: "growth_intelligence",
        operation: "list_campaigns",
        authority: "READ_ONLY",
        nextBoundary: "growth_read_only",
        campaigns: [],
        audiences: [],
        pendingWork: [],
        performance: [],
        attention: [],
        notes: [],
      },
      verified: true,
      verificationReason: "read-only",
    })

    const response = await POST(request("Show me my Meta campaigns"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.growthWorkPlan.operation).toBe("list_campaigns")
    expect(json.data.feedbackEligible).toBe(false)
    expect(handleGrowth).toHaveBeenCalledTimes(1)
    expect(realizeExpression).toHaveBeenCalledTimes(1)
    expect(recordShortcutExperience).toHaveBeenCalledWith(expect.objectContaining({
      shortcut: "growth",
      userId: "user-1",
      activeTask: "Show me my Meta campaigns",
    }))
    expect(handleSocial).not.toHaveBeenCalled()
    expect(createVideo).not.toHaveBeenCalled()
    expect(handleGeneric).not.toHaveBeenCalled()
  })

  it("routes an explicit personal/history Growth read through full JLLM context", async () => {
    inspectGrowth.mockReturnValue({
      matched: true,
      operation: "campaign_attention",
      requestedChannels: ["meta"],
      requestedBrandIds: [],
    })
    handleGeneric.mockResolvedValue({
      proposal: {
        id: "proposal-contextual",
        contextId: "ctx-contextual",
        disposition: "PROCEED",
        recommendation: "Contextual answer",
        rationale: "Full JLLM context",
        evidence: [],
        uncertainty: [],
        alternatives: [],
      },
      reasoningEventId: "reason-contextual",
      expression: {
        proposal: { id: "proposal-contextual" },
        presentation: { mode: "direct", allowProfanity: false, allowQuip: false },
        segments: [{ kind: "semantic", text: "Contextual answer" }],
      },
      verified: true,
      verificationReason: "verified",
    })

    const response = await POST(request("Use my goals and preferences to tell me which Meta campaign needs attention"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.reasoningEventId).toBe("reason-contextual")
    expect(handleGeneric).toHaveBeenCalledTimes(1)
    expect(handleGrowth).not.toHaveBeenCalled()
    expect(recordShortcutExperience).not.toHaveBeenCalled()
  })

  it("lets a mutating paid-media request continue to Social planning", async () => {
    inspectGrowth.mockReturnValue(null)
    inspectSocial.mockReturnValue({
      matched: true,
      operation: "paid_campaign",
      requestedPlatforms: ["instagram"],
      requestedCharacterProfiles: [],
      requestedBrand: "pupsonstuff",
      accountTerms: [],
    })
    handleSocial.mockResolvedValue({
      proposal: {
        id: "proposal-social",
        contextId: "ctx-social",
        disposition: "PROCEED",
        recommendation: "Prepare a governed campaign plan.",
        rationale: "Planning only.",
        evidence: [],
        uncertainty: [],
        alternatives: [],
      },
      reasoningEventId: "social-command:1",
      workPlan: {
        kind: "social_marketing",
        operation: "paid_campaign",
        accounts: [],
        requestedPlatforms: ["instagram"],
        nextBoundary: "growth_paid_media",
        authority: "PLANNING_ONLY",
        requiresExplicitApprovalForExecution: true,
        notes: [],
      },
      verified: true,
      verificationReason: "planning only",
    })

    const response = await POST(request("Launch a Meta campaign for PupsonStuff"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.socialWorkPlan.nextBoundary).toBe("growth_paid_media")
    expect(handleSocial).toHaveBeenCalledTimes(1)
    expect(handleGrowth).not.toHaveBeenCalled()
  })

  it("falls through when no specialized reader or planner matches", async () => {
    handleGeneric.mockResolvedValue({
      proposal: {
        id: "proposal-generic",
        contextId: "ctx-generic",
        disposition: "PROCEED",
        recommendation: "Generic answer",
        rationale: "Generic reasoning",
        evidence: [],
        uncertainty: [],
        alternatives: [],
      },
      reasoningEventId: "reason-1",
      expression: {
        proposal: { id: "proposal-generic" },
        presentation: { mode: "direct", allowProfanity: false, allowQuip: false },
        segments: [{ kind: "semantic", text: "Generic answer" }],
      },
      verified: true,
      verificationReason: "verified",
    })

    const response = await POST(request("Explain Bayesian updating"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.reasoningEventId).toBe("reason-1")
    expect(handleGeneric).toHaveBeenCalledTimes(1)
  })
})
