import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const runExecuteCommerceProposal = vi.fn()
vi.mock("@/lib/commerce/commerce-proposal-runtime", () => ({
  runExecuteCommerceProposal: (...args: unknown[]) => runExecuteCommerceProposal(...args),
}))

import { POST } from "./route"

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/commerce/proposals/p1/execute", {
    method: "POST",
    headers,
  })
}

describe("POST /api/commerce/proposals/:id/execute", () => {
  beforeEach(() => {
    runExecuteCommerceProposal.mockReset()
  })

  it("executes an approved proposal and returns the payment result", async () => {
    runExecuteCommerceProposal.mockResolvedValue({
      proposal: { id: "p1", status: "executed" },
      verifiedUserId: "user-1",
      paymentId: "p1",
      providerReference: "ref_p1",
      status: "captured",
    })

    const res = await POST(request({ "x-jhadina-user-id": "user-1" }), { params: { id: "p1" } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.status).toBe("captured")
    expect(runExecuteCommerceProposal).toHaveBeenCalledWith("user-1", "p1")
  })

  it("maps an identity failure to 401", async () => {
    runExecuteCommerceProposal.mockRejectedValue(new Error("Action identity mismatch"))
    const res = await POST(request(), { params: { id: "p1" } })
    expect(res.status).toBe(401)
  })

  it("maps a not-found proposal to 404", async () => {
    runExecuteCommerceProposal.mockRejectedValue(new Error("Commerce proposal not found"))
    const res = await POST(request(), { params: { id: "missing" } })
    expect(res.status).toBe(404)
  })

  it("maps an unapproved proposal to 409", async () => {
    runExecuteCommerceProposal.mockRejectedValue(new Error("Commerce proposal is not approved and ready to execute: pending"))
    const res = await POST(request(), { params: { id: "p1" } })
    expect(res.status).toBe(409)
  })

  it("maps an invalid/expired/replayed receipt to 409", async () => {
    runExecuteCommerceProposal.mockRejectedValue(new Error("Invalid, expired, or already-consumed commerce approval receipt"))
    const res = await POST(request(), { params: { id: "p1" } })
    expect(res.status).toBe(409)
  })

  it("maps a missing sandbox credential to 503 — the expected human gate, not a server error", async () => {
    runExecuteCommerceProposal.mockRejectedValue(new Error("CREDENTIAL_NOT_CONFIGURED:commerce/stripe/sandbox"))
    const res = await POST(request(), { params: { id: "p1" } })
    expect(res.status).toBe(503)
  })
})
