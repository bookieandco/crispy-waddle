import { describe, expect, it, vi } from "vitest"

const execute = vi.fn(async (proposal: Record<string, unknown>) => ({
  status: proposal.capability === "remote.power" && proposal.deviceId === "tv-1" ? "accepted" : "rejected",
  requestId: proposal.requestId,
  ...(proposal.capability === "remote.power" && proposal.deviceId === "tv-1" ? {} : { reason: "denied" }),
}))

vi.mock("@jhadina/capability-registry", () => ({
  createRemoteRuntime: () => ({ executor: { execute } }),
}))
vi.mock("@jhadina/capability-registry/remote-development-policy", () => ({
  RemoteDevelopmentPolicy: class {},
}))

describe("POST /api/remote/command", () => {
  it("rejects malformed JSON", async () => {
    const { POST } = await import("./route")
    const request = new Request("http://localhost/api/remote/command", { method: "POST", body: "{" })
    const response = await POST(request)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ status: "rejected", reason: "invalid-json" })
  })

  it("rejects non-object JSON", async () => {
    const { POST } = await import("./route")
    const request = new Request("http://localhost/api/remote/command", { method: "POST", body: JSON.stringify(["bad"]) })
    const response = await POST(request)
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ status: "rejected", reason: "invalid-request" })
  })

  it("maps governed rejection to 403", async () => {
    const { POST } = await import("./route")
    const request = new Request("http://localhost/api/remote/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "req-denied", deviceId: "unknown", capability: "remote.power" }),
    })
    const response = await POST(request)
    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toMatchObject({ status: "rejected", requestId: "req-denied", reason: "denied" })
  })

  it("maps accepted execution to 200", async () => {
    const { POST } = await import("./route")
    const request = new Request("http://localhost/api/remote/command", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId: "req-ok", deviceId: "tv-1", capability: "remote.power" }),
    })
    const response = await POST(request)
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ status: "accepted", requestId: "req-ok" })
  })
})
