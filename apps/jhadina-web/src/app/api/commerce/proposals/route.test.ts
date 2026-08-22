import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const runProposeCommerceAction = vi.fn()
vi.mock("@/lib/commerce/commerce-proposal-runtime", () => ({
  runProposeCommerceAction: (...args: unknown[]) => runProposeCommerceAction(...args),
}))

import { POST } from "./route"

/**
 * Route-level tests: HTTP surface only (request parsing, validation,
 * status-code mapping) — the governed propose/approve/execute logic
 * itself is proven against real in-memory fakes in
 * commerce-proposal-lifecycle.test.ts. Mocking the runtime module here
 * mirrors how this route is actually composed: a thin adapter with no
 * business logic of its own.
 */
function request(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/commerce/proposals", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  })
}

describe("POST /api/commerce/proposals", () => {
  beforeEach(() => {
    runProposeCommerceAction.mockReset()
  })

  it("rejects a non-positive-integer amountMinor", async () => {
    const res = await POST(request({ amountMinor: -5, currency: "usd", description: "x" }))
    expect(res.status).toBe(400)
    expect(runProposeCommerceAction).not.toHaveBeenCalled()
  })

  it("rejects a malformed currency", async () => {
    const res = await POST(request({ amountMinor: 100, currency: "us", description: "x" }))
    expect(res.status).toBe(400)
  })

  it("rejects a missing description", async () => {
    const res = await POST(request({ amountMinor: 100, currency: "usd" }))
    expect(res.status).toBe(400)
  })

  it("rejects an unknown test payment method", async () => {
    const res = await POST(request({ amountMinor: 100, currency: "usd", description: "x", testPaymentMethod: "pm_not_real" }))
    expect(res.status).toBe(400)
  })

  it("creates a proposal and returns 200 on success", async () => {
    runProposeCommerceAction.mockResolvedValue({
      proposal: { id: "p1", status: "pending" },
      verifiedUserId: "user-1",
    })

    const res = await POST(request({ amountMinor: 1500, currency: "usd", description: "Sandbox charge" }, { "x-jhadina-user-id": "user-1" }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.success).toBe(true)
    expect(json.data.proposal.id).toBe("p1")
    expect(runProposeCommerceAction).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ amountMinor: 1500, currency: "usd", description: "Sandbox charge" }),
    )
  })

  it("maps an identity failure to 401", async () => {
    runProposeCommerceAction.mockRejectedValue(new Error("Action identity mismatch"))
    const res = await POST(request({ amountMinor: 100, currency: "usd", description: "x" }))
    expect(res.status).toBe(401)
  })

  it("maps a policy denial to 403", async () => {
    runProposeCommerceAction.mockRejectedValue(new Error("Action denied by policy: commerce.payment.charge"))
    const res = await POST(request({ amountMinor: 100, currency: "usd", description: "x" }))
    expect(res.status).toBe(403)
  })
})
