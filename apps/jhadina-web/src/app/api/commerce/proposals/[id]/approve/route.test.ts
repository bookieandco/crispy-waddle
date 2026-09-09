import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const runApproveCommerceProposal = vi.fn()
vi.mock("@/lib/commerce/commerce-proposal-runtime", () => ({
  runApproveCommerceProposal: (...args: unknown[]) => runApproveCommerceProposal(...args),
}))
vi.mock("@/lib/auth/require-authenticated-user", () => ({
  requireAuthenticatedUser: vi.fn().mockResolvedValue({ userId: "user-1", sessionId: "session-1" }),
}))

import { POST } from "./route"

function request(): NextRequest {
  return new NextRequest("http://localhost/api/commerce/proposals/p1/approve", { method: "POST" })
}

describe("POST /api/commerce/proposals/:id/approve", () => {
  beforeEach(() => {
    runApproveCommerceProposal.mockReset()
  })

  it("approves a pending proposal and returns the single-use receipt id", async () => {
    runApproveCommerceProposal.mockResolvedValue({
      proposal: { id: "p1", status: "approved" },
      verifiedUserId: "user-1",
      approvalReceiptId: "receipt-1",
    })

    const res = await POST(request(), { params: { id: "p1" } })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.data.proposal.status).toBe("approved")
    expect(json.data.approvalReceiptId).toBe("receipt-1")
    expect(runApproveCommerceProposal).toHaveBeenCalledWith(undefined, "p1")
  })

  it("maps an identity failure to 401", async () => {
    runApproveCommerceProposal.mockRejectedValue(new Error("Action identity mismatch"))
    const res = await POST(request(), { params: { id: "p1" } })
    expect(res.status).toBe(401)
  })

  it("maps a not-found proposal to 404", async () => {
    runApproveCommerceProposal.mockRejectedValue(new Error("Commerce proposal not found"))
    const res = await POST(request(), { params: { id: "missing" } })
    expect(res.status).toBe(404)
  })

  it("maps an already-approved proposal (invalid state transition) to 409", async () => {
    runApproveCommerceProposal.mockRejectedValue(new Error("Commerce proposal is not pending approval: approved"))
    const res = await POST(request(), { params: { id: "p1" } })
    expect(res.status).toBe(409)
  })
})
