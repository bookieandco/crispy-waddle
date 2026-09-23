import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const mocks = vi.hoisted(() => {
  const verify = vi.fn(async () => ({ userId: "11111111-1111-1111-1111-111111111111", sessionId: "session-1" }))
  const realize = vi.fn(async (input: {
    proposal: { recommendation: string; disposition: string }
  }) => ({
    proposal: input.proposal,
    presentation: { mode: "direct", allowProfanity: false, allowQuip: true },
    segments: [{ kind: "semantic", text: input.proposal.recommendation }],
  }))
  return { verify, realize }
})

vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify: mocks.verify }),
}))

vi.mock("@/lib/intelligence/ask-expression", () => ({
  realizeAskJhadinaExpression: (input: unknown) => mocks.realize(input as {
    proposal: { recommendation: string; disposition: string }
  }),
}))

import { POST } from "./route"

function request(withIdentity = true) {
  return new NextRequest("http://localhost/api/jhadina/expression", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(withIdentity ? { "x-jhadina-user-id": "11111111-1111-1111-1111-111111111111" } : {}),
    },
    body: JSON.stringify({
      activeTask: "Make the product video",
      proposal: {
        id: "product-video:1",
        disposition: "PROCEED",
        recommendation: "Director started the product-consistent video.",
        rationale: "Verified Director receipt.",
      },
    }),
  })
}

describe("Ask Jhadina expression-only route", () => {
  beforeEach(() => vi.clearAllMocks())

  it("authenticates and applies the governed expression runtime without execution authority", async () => {
    const response = await POST(request())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(mocks.verify).toHaveBeenCalledWith({
      userId: "11111111-1111-1111-1111-111111111111",
    })
    expect(mocks.realize).toHaveBeenCalledWith(expect.objectContaining({
      userId: "11111111-1111-1111-1111-111111111111",
      activeTask: "Make the product video",
      proposal: expect.objectContaining({
        id: "product-video:1",
        disposition: "PROCEED",
        recommendation: "Director started the product-consistent video.",
        evidence: [],
      }),
    }))
    expect(json.data.presentation.allowQuip).toBe(true)
    expect(json.data.segments[0].text).toContain("Director started")
  })

  it("rejects an unauthenticated presentation request", async () => {
    const response = await POST(request(false))
    expect(response.status).toBe(401)
    expect(mocks.realize).not.toHaveBeenCalled()
  })
})
