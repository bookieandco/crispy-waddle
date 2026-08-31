import { describe, expect, it, vi } from "vitest"

const list = vi.fn(() => [{ deviceId: "tv-1", entityId: "media_player.tv" }])
const capabilityList = vi.fn(() => [{ name: "remote.power", description: "Power", risk: "medium", version: 1 }])
const availability = vi.fn(() => [{ name: "remote.power", available: true }])

vi.mock("@jhadina/capability-registry", () => ({
  createRemoteRuntime: () => ({
    devices: { list },
    capabilities: { list: capabilityList },
    transports: [],
  }),
}))
vi.mock("@jhadina/capability-registry/remote-capability-availability", () => ({
  listRemoteCapabilityAvailability: availability,
}))
vi.mock("@jhadina/capability-registry/remote-development-policy", () => ({
  RemoteDevelopmentPolicy: class {},
}))

describe("GET /api/remote/capabilities", () => {
  it("rejects requests without a deviceId", async () => {
    const { GET } = await import("./route")
    const response = await GET(new Request("http://localhost/api/remote/capabilities"))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "deviceId is required" })
  })

  it("rejects unknown devices", async () => {
    const { GET } = await import("./route")
    const response = await GET(new Request("http://localhost/api/remote/capabilities?deviceId=unknown-device"))
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "unknown device" })
  })

  it("returns capabilities for a known device", async () => {
    const { GET } = await import("./route")
    const response = await GET(new Request("http://localhost/api/remote/capabilities?deviceId=tv-1"))
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      deviceId: "tv-1",
      capabilities: [{
        name: "remote.power",
        description: "Power",
        risk: "medium",
        version: 1,
        available: true,
      }],
    })
    expect(availability).toHaveBeenCalledWith(expect.anything(), expect.anything(), "tv-1")
  })
})
