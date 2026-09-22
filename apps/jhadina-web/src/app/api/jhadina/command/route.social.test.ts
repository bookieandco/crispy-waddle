import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const verify = vi.fn(async () => ({ userId: "user-1", sessionId: "session-1" }))
const handleSocial = vi.fn()
const inspectSocial = vi.fn()
const inspectVideo = vi.fn()
const createVideo = vi.fn()
const handleGeneric = vi.fn()

vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify }),
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

describe("Ask Jhadina Social routing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inspectSocial.mockReturnValue(null)
    inspectVideo.mockReturnValue(null)
  })

  it("routes a Social video request through Social before the generic Director video shortcut", async () => {
    inspectSocial.mockReturnValue({
      matched: true,
      operation: "produce_creative",
      requestedPlatforms: ["tiktok"],
      requestedCharacterProfiles: [],
      requestedBrand: "pupsonstuff",
      accountTerms: [],
    })
    inspectVideo.mockReturnValue({ mode: "text-to-video" })
    handleSocial.mockResolvedValue({
      proposal: {
        id: "proposal-social",
        contextId: "ctx-social",
        disposition: "PROCEED",
        recommendation: "Route PupsonStuff TikTok creative to Director.",
        rationale: "Resolved from Social.",
        evidence: [],
        uncertainty: [],
        alternatives: [],
      },
      reasoningEventId: "social-command:1",
      workPlan: {
        kind: "social_marketing",
        operation: "produce_creative",
        accounts: [],
        requestedPlatforms: ["tiktok"],
        nextBoundary: "director_production",
        authority: "PLANNING_ONLY",
        requiresExplicitApprovalForExecution: false,
        notes: [],
      },
      verified: true,
      verificationReason: "resolved",
    })

    const response = await POST(request("Make a TikTok video for PupsonStuff"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.socialWorkPlan.nextBoundary).toBe("director_production")
    expect(json.data.feedbackEligible).toBe(false)
    expect(handleSocial).toHaveBeenCalledTimes(1)
    expect(createVideo).not.toHaveBeenCalled()
    expect(handleGeneric).not.toHaveBeenCalled()
  })

  it("preserves the generic Director shortcut when the request is not Social", async () => {
    inspectSocial.mockReturnValue(null)
    inspectVideo.mockReturnValue({ mode: "text-to-video" })
    createVideo.mockResolvedValue({
      job: {
        id: "video-job-1",
        projectId: "project-1",
        mode: "text-to-video",
        aspectRatio: "16:9",
        status: "queued",
        providerId: "provider-1",
      },
    })

    const response = await POST(request("Make a cinematic video about a lighthouse"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.videoJob.id).toBe("video-job-1")
    expect(createVideo).toHaveBeenCalledTimes(1)
    expect(handleSocial).not.toHaveBeenCalled()
  })

  it("falls through to main intelligence when neither specialized intent matches", async () => {
    inspectSocial.mockReturnValue(null)
    inspectVideo.mockReturnValue(null)
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

    const response = await POST(request("What is your personality like?"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.reasoningEventId).toBe("reason-1")
    expect(handleGeneric).toHaveBeenCalledTimes(1)
    expect(createVideo).not.toHaveBeenCalled()
    expect(handleSocial).not.toHaveBeenCalled()
  })
})
