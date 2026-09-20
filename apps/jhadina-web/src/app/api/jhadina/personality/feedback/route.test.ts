import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const verify = vi.fn()
const recordFeedback = vi.fn()
const appendAudit = vi.fn()

vi.mock("@/lib/auth/request-identity", () => ({
  createRequestIdentityVerifier: async () => ({ verify }),
}))
vi.mock("@/lib/routes/handlers", () => ({
  getStorage: () => ({ kind: "fake-storage" }),
}))
vi.mock("@/lib/personality/personality-outcome-feedback", () => ({
  recordPersonalityOutcomeFeedback: (...args: unknown[]) => recordFeedback(...args),
}))
vi.mock("@/lib/intelligence/durable-audit-ledger", () => ({
  createIntelligenceAuditLedger: async () => ({ append: appendAudit }),
}))

import { POST } from "./route"

function request(body: unknown, userId?: string): NextRequest {
  return new NextRequest("http://localhost/api/jhadina/personality/feedback", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(userId ? { "x-jhadina-user-id": userId } : {}),
    },
    body: JSON.stringify(body),
  })
}

describe("POST /api/jhadina/personality/feedback", () => {
  beforeEach(() => {
    verify.mockReset()
    recordFeedback.mockReset()
    appendAudit.mockReset()
    appendAudit.mockResolvedValue(undefined)
    verify.mockResolvedValue({ userId: "user-1", sessionId: "session-1" })
  })

  it("requires a claimed signed-in identity", async () => {
    const res = await POST(request({
      targetReasoningEventId: "reason-1",
      feedbackId: "feedback-1",
      kind: "reinforced",
    }))
    expect(res.status).toBe(401)
    expect(recordFeedback).not.toHaveBeenCalled()
  })

  it("rejects malformed outcome semantics before storage", async () => {
    const res = await POST(request({
      targetReasoningEventId: "reason-1",
      feedbackId: "feedback-1",
      kind: "make-me-admin",
    }, "user-1"))
    expect(res.status).toBe(400)
    expect(recordFeedback).not.toHaveBeenCalled()
  })

  it("verifies identity, records learning-only feedback, and emits a durable audit receipt", async () => {
    recordFeedback.mockResolvedValue({
      replayed: false,
      event: {
        id: "personality_feedback_abc",
        outcome: "feedback:reinforced",
      },
    })

    const res = await POST(request({
      targetReasoningEventId: "reason-1",
      feedbackId: "feedback-1",
      kind: "reinforced",
      authority: "admin",
      canMutatePersonality: true,
    }, "user-1"))

    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data).toMatchObject({
      feedbackReasoningEventId: "personality_feedback_abc",
      targetReasoningEventId: "reason-1",
      outcome: "feedback:reinforced",
      replayed: false,
    })
    expect(verify).toHaveBeenCalledWith({ userId: "user-1" })
    expect(recordFeedback).toHaveBeenCalledWith(
      expect.anything(),
      {
        userId: "user-1",
        targetReasoningEventId: "reason-1",
        feedbackId: "feedback-1",
        kind: "reinforced",
        note: undefined,
      },
    )
    expect(appendAudit).toHaveBeenCalledWith(expect.objectContaining({
      type: "personality.feedback.record",
      status: "completed",
      metadata: expect.objectContaining({
        authority: "learning-only",
        feedbackKind: "reinforced",
      }),
    }))
  })

  it("maps semantic idempotency conflicts to 409", async () => {
    recordFeedback.mockRejectedValue(new Error("PERSONALITY_FEEDBACK_IDEMPOTENCY_CONFLICT"))
    const res = await POST(request({
      targetReasoningEventId: "reason-1",
      feedbackId: "feedback-1",
      kind: "rejected",
    }, "user-1"))
    expect(res.status).toBe(409)
  })
})
