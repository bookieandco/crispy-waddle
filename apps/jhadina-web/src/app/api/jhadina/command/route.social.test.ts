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
const finalizeShortcutExperience = vi.fn(async (input: { reasoningEventId: string }) => input.reasoningEventId)
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
  finalizeAskShortcutExperience: (input: unknown) => finalizeShortcutExperience(input as { reasoningEventId: string }),
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

describe("Ask Jhadina Social routing", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    finalizeShortcutExperience.mockImplementation(async (input: { reasoningEventId: string }) => input.reasoningEventId)
    inspectGrowth.mockReturnValue(null)
    inspectSocial.mockReturnValue(null)
    inspectVideo.mockReturnValue(null)
  })

  it("resolves Social scope first and then starts Director for an explicit Social video request", async () => {
    inspectSocial.mockReturnValue({
      matched: true,
      operation: "produce_creative",
      requestedPlatforms: ["tiktok"],
      requestedCharacterProfiles: [],
      requestedBrand: "pupsonstuff",
      accountTerms: [],
    })
    inspectVideo.mockReturnValue({ mode: "text-to-video" })
    createVideo.mockResolvedValue({
      job: {
        id: "video-job-social-1",
        projectId: "project-social-1",
        mode: "short",
        aspectRatio: "9:16",
        status: "queued",
        providerId: "provider-1",
      },
    })
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
        character: {
          id: "character:pupsonstuff",
          brand: "pupsonstuff",
          label: "PupsonStuff",
          aliases: ["pupsonstuff"],
          description: "Pet-product character",
          toneTraits: ["playful", "warm"],
          pointOfView: "Make personalized pet products recognizable and delightful.",
          voiceProfileRef: "brand-voice:pupsonstuff",
          evidenceRefs: ["character:pupsonstuff"],
          status: "active",
          authority: "EXPRESSION_ONLY",
        },
        accounts: [{
          accountId: "acct-pups-tiktok",
          brand: "pupsonstuff",
          platform: "tiktok",
          provider: "ayrshare",
          displayName: "PupsonStuff TikTok",
          handle: "pupsonstuff",
          attentionScore: 0,
          attentionReasons: ["no operational exception detected"],
        }],
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
    expect(json.data.videoJob.id).toBe("video-job-social-1")
    expect(json.data.proposal.recommendation).toContain("Director started video job video-job-social-1")
    expect(json.data.feedbackEligible).toBe(false)
    expect(handleSocial).toHaveBeenCalledTimes(1)
    expect(createVideo).toHaveBeenCalledTimes(1)
    expect(realizeExpression).toHaveBeenCalledTimes(1)
    expect(recordShortcutExperience).toHaveBeenCalledWith(expect.objectContaining({
      shortcut: "social",
      userId: "user-1",
      activeTask: "Make a TikTok video for PupsonStuff",
      proposal: expect.objectContaining({
        disposition: "PROCEED",
        recommendation: "Route PupsonStuff TikTok creative to Director.",
      }),
      metadata: expect.objectContaining({
        directorOutcome: "pending",
      }),
    }))
    expect(finalizeShortcutExperience).toHaveBeenCalledWith(expect.objectContaining({
      reasoningEventId: "reason-social",
      proposal: expect.objectContaining({
        disposition: "PROCEED",
        recommendation: expect.stringContaining("Director started video job video-job-social-1"),
      }),
      metadata: expect.objectContaining({
        directorOutcome: "started",
        videoJobId: "video-job-social-1",
        videoStatus: "queued",
      }),
    }))
    expect(createVideo).toHaveBeenCalledWith(expect.objectContaining({
      socialExpression: expect.objectContaining({
        brand: "pupsonstuff",
        characterProfileRef: "character:pupsonstuff",
        voiceProfileRef: "brand-voice:pupsonstuff",
        accountScopes: [expect.objectContaining({
          accountId: "acct-pups-tiktok",
          platform: "tiktok",
          provider: "ayrshare",
        })],
      }),
    }))
    expect(handleGeneric).not.toHaveBeenCalled()
  })

  it("does not turn a completed Director job into an API failure when Experience finalization fails", async () => {
    inspectSocial.mockReturnValue({
      matched: true,
      operation: "produce_creative",
      requestedPlatforms: ["tiktok"],
      requestedCharacterProfiles: [],
      requestedBrand: "pupsonstuff",
      accountTerms: [],
    })
    inspectVideo.mockReturnValue({ mode: "text-to-video" })
    createVideo.mockResolvedValue({
      job: {
        id: "video-job-finalize-fail",
        projectId: "project-finalize-fail",
        mode: "short",
        aspectRatio: "9:16",
        status: "queued",
        providerId: "provider-1",
      },
    })
    handleSocial.mockResolvedValue({
      proposal: {
        id: "proposal-finalize-fail",
        contextId: "ctx-finalize-fail",
        disposition: "PROCEED",
        recommendation: "Route PupsonStuff TikTok creative to Director.",
        rationale: "Resolved from Social.",
        evidence: [],
        uncertainty: [],
        alternatives: [],
      },
      reasoningEventId: "social-command:finalize-fail",
      workPlan: {
        kind: "social_marketing",
        operation: "produce_creative",
        character: {
          id: "character:pupsonstuff",
          brand: "pupsonstuff",
          label: "PupsonStuff",
          aliases: ["pupsonstuff"],
          description: "Pet-product character",
          toneTraits: ["playful"],
          pointOfView: "Pet products.",
          voiceProfileRef: "brand-voice:pupsonstuff",
          evidenceRefs: ["character:pupsonstuff"],
          status: "active",
          authority: "EXPRESSION_ONLY",
        },
        accounts: [{
          accountId: "acct-pups-tiktok",
          brand: "pupsonstuff",
          platform: "tiktok",
          provider: "ayrshare",
          displayName: "PupsonStuff TikTok",
          handle: "pupsonstuff",
          attentionScore: 0,
          attentionReasons: [],
        }],
        requestedPlatforms: ["tiktok"],
        nextBoundary: "director_production",
        authority: "PLANNING_ONLY",
        requiresExplicitApprovalForExecution: false,
        notes: [],
      },
      verified: true,
      verificationReason: "resolved",
    })
    finalizeShortcutExperience.mockRejectedValueOnce(new Error("reasoning store unavailable"))

    const response = await POST(request("Make a TikTok video for PupsonStuff"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.videoJob.id).toBe("video-job-finalize-fail")
    expect(json.data.proposal.recommendation).toContain("Director started video job video-job-finalize-fail")
    expect(json.data.proposal.uncertainty).toContain(
      "Director outcome is durable, but the conversation Experience could not be finalized in Hippocampus. Do not retry the video solely for this logging failure.",
    )
    expect(json.data.verificationReason).toContain("video job remains authoritative")
    expect(createVideo).toHaveBeenCalledTimes(1)
  })

  it("does not start Director when a resolved Social work plan lacks an exact connected account", async () => {
    inspectSocial.mockReturnValue({
      matched: true,
      operation: "produce_creative",
      requestedPlatforms: ["tiktok"],
      requestedCharacterProfiles: [],
      requestedBrand: "pupsonstuff",
      accountTerms: [],
    })
    inspectVideo.mockReturnValue({ mode: "short" })
    handleSocial.mockResolvedValue({
      proposal: {
        id: "proposal-no-account",
        contextId: "ctx-no-account",
        disposition: "PROCEED",
        recommendation: "Route PupsonStuff creative to Director.",
        rationale: "Resolved brand but no account.",
        evidence: [],
        uncertainty: [],
        alternatives: [],
      },
      reasoningEventId: "social-command:no-account",
      workPlan: {
        kind: "social_marketing",
        operation: "produce_creative",
        character: {
          id: "character:pupsonstuff",
          brand: "pupsonstuff",
          label: "PupsonStuff",
          aliases: ["pupsonstuff"],
          description: "Pet-product character",
          toneTraits: ["playful"],
          pointOfView: "Pet products.",
          voiceProfileRef: "brand-voice:pupsonstuff",
          evidenceRefs: ["character:pupsonstuff"],
          status: "active",
          authority: "EXPRESSION_ONLY",
        },
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
    expect(json.data.proposal.disposition).toBe("ASK")
    expect(json.data.proposal.recommendation).toContain("connected Social account")
    expect(createVideo).not.toHaveBeenCalled()
    expect(recordShortcutExperience).toHaveBeenCalledWith(expect.objectContaining({
      proposal: expect.objectContaining({
        disposition: "ASK",
        recommendation: expect.stringContaining("connected Social account"),
      }),
      metadata: expect.objectContaining({
        directorOutcome: "scope_clarification",
      }),
    }))
  })

  it("does not start Director when Social needs clarification", async () => {
    inspectSocial.mockReturnValue({
      matched: true,
      operation: "produce_creative",
      requestedPlatforms: ["tiktok"],
      requestedCharacterProfiles: [],
      requestedBrand: "pupsonstuff",
      accountTerms: [],
    })
    inspectVideo.mockReturnValue({ mode: "short" })
    handleSocial.mockResolvedValue({
      proposal: {
        id: "proposal-ask",
        contextId: "ctx-ask",
        disposition: "ASK",
        recommendation: "Choose a connected TikTok account.",
        rationale: "Account scope is ambiguous.",
        evidence: [],
        uncertainty: [],
        alternatives: [],
      },
      reasoningEventId: "social-command:ask",
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
      verificationReason: "resolved with clarification",
    })

    const response = await POST(request("Make a TikTok video for PupsonStuff"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.proposal.disposition).toBe("ASK")
    expect(createVideo).not.toHaveBeenCalled()
    expect(recordShortcutExperience).toHaveBeenCalledWith(expect.objectContaining({
      proposal: expect.objectContaining({
        disposition: "ASK",
        recommendation: "Choose a connected TikTok account.",
      }),
    }))
  })

  it("routes an explicit personal/history Social read through full JLLM context", async () => {
    inspectSocial.mockReturnValue({
      matched: true,
      operation: "account_attention",
      requestedPlatforms: ["instagram"],
      requestedCharacterProfiles: [],
      requestedBrand: "pupsonstuff",
      accountTerms: [],
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

    const response = await POST(request("Based on what you know about me, which Instagram account should I work on?"))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data.reasoningEventId).toBe("reason-contextual")
    expect(handleGeneric).toHaveBeenCalledTimes(1)
    expect(handleSocial).not.toHaveBeenCalled()
    expect(createVideo).not.toHaveBeenCalled()
    expect(recordShortcutExperience).not.toHaveBeenCalled()
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
    expect(recordShortcutExperience).toHaveBeenCalledWith(expect.objectContaining({
      shortcut: "director",
      userId: "user-1",
    }))
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
