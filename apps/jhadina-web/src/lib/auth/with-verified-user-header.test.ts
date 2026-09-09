import { describe, expect, it, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const requireAuthenticatedUser = vi.fn()
vi.mock("./require-authenticated-user", () => ({
  requireAuthenticatedUser: (...args: unknown[]) => requireAuthenticatedUser(...args),
}))

import { withVerifiedUserHeader } from "./with-verified-user-header"

describe("withVerifiedUserHeader", () => {
  beforeEach(() => {
    requireAuthenticatedUser.mockReset()
  })

  it("overwrites a caller-supplied identity with the verified session user", async () => {
    requireAuthenticatedUser.mockResolvedValue({ userId: "verified-user" })
    const handler = vi.fn(async (request: NextRequest) =>
      new Response(request.headers.get("x-user-id")),
    )
    const request = new NextRequest("http://localhost/api/message", {
      method: "POST",
      headers: { "content-type": "application/json", "x-user-id": "attacker-user" },
      body: JSON.stringify({ message: "hello" }),
    })

    const response = await withVerifiedUserHeader(request, handler)
    expect(await response.text()).toBe("verified-user")
    expect(handler).toHaveBeenCalledOnce()
  })

  it("fails closed when the session cannot be authenticated", async () => {
    requireAuthenticatedUser.mockRejectedValue(new Error("Authenticated user missing"))
    const handler = vi.fn()
    const request = new NextRequest("http://localhost/api/message")

    const response = await withVerifiedUserHeader(request, handler)
    expect(response.status).toBe(401)
    expect(handler).not.toHaveBeenCalled()
  })
})
