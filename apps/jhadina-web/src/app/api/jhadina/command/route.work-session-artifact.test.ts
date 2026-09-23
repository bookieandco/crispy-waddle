import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const verify = vi.fn(async () => ({ userId: "verified-user", sessionId: "session-1" }))
const handleGeneric = vi.fn()
const resumeArtifacts = vi.fn()

vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify }),
}))

vi.mock("@/lib/supabase/service-role", () => ({
  createServiceRoleClient: () => ({ kind: "service-role-client" }),
}))

vi.mock("@/lib/artifacts/work-session-artifact-resume", () => ({
  resolveWorkSessionArtifactContext: (...args: unknown[]) => resumeArtifacts(...args),
}))

vi.mock("@/lib/intelligence/jhadina-command", () => ({
  handleJhadinaCommand: (...args: unknown[]) => handleGeneric(...args),
}))

vi.mock("@/lib/intelligence/ask-doctor-command", () => ({
  inspectAskDoctorIntent: () => null,
  doctorProposal: vi.fn(),
}))

vi.mock("@/lib/intelligence/ask-growth-command", () => ({
  inspectAskGrowthReadIntent: () => null,
  handleAskGrowthReadCommand: vi.fn(),
}))

vi.mock("@/lib/intelligence/ask-social-command", () => ({
  inspectAskSocialIntent: () => null,
  handleAskSocialCommand: vi.fn(),
}))

vi.mock("@/lib/director-video-job-service", () => ({
  inspectAskVideoIntent: () => null,
  createAndSubmitAskVideoJob: vi.fn(),
}))

vi.mock("@/lib/intelligence/ask-contextual-read-routing", () => ({
  requiresFullJllmContextForRead: () => false,
}))

vi.mock("@/lib/intelligence/ask-expression", () => ({
  realizeAskJhadinaExpression: vi.fn(),
}))

vi.mock("@/lib/intelligence/ask-shortcut-experience", () => ({
  recordAskShortcutExperience: vi.fn(),
}))

import { POST } from "./route"

describe("Ask Jhadina WorkSession artifact resume", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resumeArtifacts.mockResolvedValue({
      artifacts: [{
        id: "artifact-resumed",
        kind: "text",
        mimeType: "text/plain",
        source: "durable-artifact",
        name: "notes.txt",
        observedAt: "2026-09-22T12:00:00.000Z",
        text: "resumed clean file body",
      }],
      attemptedArtifactIds: ["artifact-resumed"],
      unavailableArtifactIds: [],
    })
    handleGeneric.mockResolvedValue({
      proposal: {
        id: "proposal-1",
        contextId: "ctx-1",
        disposition: "ASK",
        recommendation: "I can use the resumed file.",
        rationale: "The file was revalidated.",
        evidence: [],
        uncertainty: [],
        alternatives: [],
      },
      reasoningEventId: "reason-1",
      expression: {
        proposal: { id: "proposal-1" },
        presentation: { mode: "direct", allowProfanity: false, allowQuip: false },
        segments: [{ kind: "semantic", text: "I can use the resumed file." }],
      },
      verified: true,
      verificationReason: "verified",
    })
  })

  it("revalidates admitted WorkSession refs and passes resumed content to generic JLLM reasoning", async () => {
    const response = await POST(new NextRequest("http://localhost/api/jhadina/command", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-jhadina-user-id": "claimed-user",
      },
      body: JSON.stringify({
        activeTask: "Continue using the file from this session",
        workSessionId: "ws-1",
      }),
    }))

    expect(response.status).toBe(200)
    expect(verify).toHaveBeenCalledWith({ userId: "claimed-user" })
    expect(resumeArtifacts).toHaveBeenCalledWith(expect.objectContaining({
      ownerUserId: "verified-user",
      workSessionId: "ws-1",
      excludeArtifactIds: [],
      maxArtifacts: 8,
    }))
    expect(handleGeneric).toHaveBeenCalledWith(expect.objectContaining({
      workSessionId: "ws-1",
      artifacts: [expect.objectContaining({
        id: "artifact-resumed",
        source: "durable-artifact",
        text: "resumed clean file body",
      })],
    }))
  })

  it("does not require resumed artifacts for a normal no-session Ask turn", async () => {
    const response = await POST(new NextRequest("http://localhost/api/jhadina/command", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-jhadina-user-id": "claimed-user",
      },
      body: JSON.stringify({ activeTask: "Explain Bayesian updating" }),
    }))

    expect(response.status).toBe(200)
    expect(resumeArtifacts).not.toHaveBeenCalled()
    expect(handleGeneric).toHaveBeenCalledWith(expect.objectContaining({
      workSessionId: undefined,
      artifacts: [],
    }))
  })
})
