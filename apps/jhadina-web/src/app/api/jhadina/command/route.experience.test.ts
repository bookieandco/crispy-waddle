import { describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  createServerSupabaseClient: vi.fn(),
  handleJhadinaCommand: vi.fn(),
}))

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}))

vi.mock("@/lib/intelligence/jhadina-command", () => ({
  handleJhadinaCommand: mocks.handleJhadinaCommand,
}))

import { POST } from "./route"

function request(userId: string, activeTask = "test") {
  return new Request("http://localhost/api/jhadina/command", {
    method: "POST",
    headers: { "content-type": "application/json", "x-jhadina-user-id": userId },
    body: JSON.stringify({ activeTask }),
  })
}

describe("Jhadina command Experience composition", () => {
  it("rejects a claimed identity that differs from the authenticated session", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "session-user" } } }) } })
    const response = await POST(request("claimed-user"))
    expect(response.status).toBe(401)
    expect(mocks.handleJhadinaCommand).not.toHaveBeenCalled()
  })

  it("passes the authenticated session identity to the command recorder", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue({ auth: { getUser: mocks.getUser.mockResolvedValue({ data: { user: { id: "session-user" } } }) } })
    mocks.handleJhadinaCommand.mockResolvedValue({ proposal: null, candidate: null, approvalReceiptId: null, verified: true, verificationReason: "ok", experienceRecorded: true })

    const response = await POST(request("session-user"))
    expect(response.status).toBe(200)
    expect(mocks.handleJhadinaCommand).toHaveBeenCalledTimes(1)
    const [, dependencies] = mocks.handleJhadinaCommand.mock.calls[0]
    expect(dependencies.experienceRecorder).toBeDefined()
    expect(dependencies.experienceRecorder).toHaveProperty("append")
  })
})
