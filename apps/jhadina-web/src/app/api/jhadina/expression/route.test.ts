import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const verify = vi.fn(async () => ({ userId: "verified-user", sessionId: "session-1" }))
const recordShortcutExperience = vi.fn(async (input: { shortcut: string }) => `reason-${input.shortcut}`)
const realizeExpression = vi.fn(async (input: {
  proposal: { id: string; recommendation: string; disposition: string }
}) => ({
  proposal: input.proposal,
  presentation: {
    mode: input.proposal.disposition === "ASK" ? "clarifying" : "direct",
    allowProfanity: true,
    allowQuip: true,
  },
  segments: [{ kind: "semantic", text: input.proposal.recommendation }],
}))

vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify }),
}))

vi.mock("@/lib/intelligence/ask-shortcut-experience", () => ({
  recordAskShortcutExperience: (input: unknown) => recordShortcutExperience(input as { shortcut: string }),
}))

vi.mock("@/lib/intelligence/ask-expression", () => ({
  realizeAskJhadinaExpression: (input: unknown) => realizeExpression(input as {
    proposal: { id: string; recommendation: string; disposition: string }
  }),
}))

import { POST } from "./route"

function request(
  proposal: Record<string, unknown>,
  activeTask = "Make a product video",
  shortcut: "reference-character" | "reference-product" = "reference-product",
) {
  return new NextRequest("http://localhost/api/jhadina/expression", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-jhadina-user-id": "claimed-user",
    },
    body: JSON.stringify({ activeTask, proposal, shortcut }),
  })
}

describe("Ask Jhadina expression-only route", () => {
  beforeEach(() => vi.clearAllMocks())

  it("verifies identity, strips untrusted authority fields, and uses governed expression", async () => {
    const response = await POST(request({
      id: "client-controlled-id",
      contextId: "client-controlled-context",
      disposition: "PROCEED",
      recommendation: "Director started the reference-aware video.",
      rationale: "The governed Director job was admitted and submitted.",
      evidence: [{ id: "e1", source: "Director", summary: "Job queued." }],
      uncertainty: [],
      alternatives: [],
      executeNow: true,
      policyOverride: "allow-all",
    }))
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(verify).toHaveBeenCalledWith({ userId: "claimed-user" })
    expect(json.data.proposal.id).not.toBe("client-controlled-id")
    expect(json.data.proposal.contextId).toMatch(/^ask-expression:/)
    expect(json.data.proposal.executeNow).toBeUndefined()
    expect(json.data.proposal.policyOverride).toBeUndefined()
    expect(realizeExpression).toHaveBeenCalledWith(expect.objectContaining({
      userId: "verified-user",
      activeTask: "Make a product video",
      proposal: expect.objectContaining({
        disposition: "PROCEED",
        recommendation: "Director started the reference-aware video.",
      }),
    }))
    expect(json.data.expression.presentation.allowQuip).toBe(true)
    expect(json.data.reasoningEventId).toBe("reason-reference-product")
    expect(recordShortcutExperience).toHaveBeenCalledWith(expect.objectContaining({
      shortcut: "reference-product",
      userId: "verified-user",
      activeTask: "Make a product video",
    }))
  })

  it("rejects malformed presentation proposals before expression realization", async () => {
    const response = await POST(request({
      disposition: "PROCEED",
      rationale: "Missing recommendation.",
    }))
    const json = await response.json()

    expect(response.status).toBe(400)
    expect(json.error).toContain("INVALID_MODEL_PROPOSAL")
    expect(realizeExpression).not.toHaveBeenCalled()
    expect(recordShortcutExperience).not.toHaveBeenCalled()
  })


  it("requires the reference shortcut discriminator before realization or persistence", async () => {
    const response = await POST(new NextRequest("http://localhost/api/jhadina/expression", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-jhadina-user-id": "claimed-user",
      },
      body: JSON.stringify({
        activeTask: "Make a video",
        proposal: {
          disposition: "PROCEED",
          recommendation: "Ready.",
          rationale: "Ready.",
        },
      }),
    }))

    expect(response.status).toBe(400)
    expect(realizeExpression).not.toHaveBeenCalled()
    expect(recordShortcutExperience).not.toHaveBeenCalled()
  })

  it("requires a signed-in identity claim", async () => {
    const response = await POST(new NextRequest("http://localhost/api/jhadina/expression", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        activeTask: "Make a video",
        proposal: {
          disposition: "PROCEED",
          recommendation: "Ready.",
          rationale: "Ready.",
        },
      }),
    }))

    expect(response.status).toBe(401)
    expect(verify).not.toHaveBeenCalled()
  })
})
