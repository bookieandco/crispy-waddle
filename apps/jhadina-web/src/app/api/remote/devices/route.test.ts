import { describe, expect, it, vi } from "vitest"

const list = vi.fn(() => [
  { deviceId: "tv-1", entityId: "media_player.tv" },
  { deviceId: "speaker-1", entityId: "media_player.speaker" },
])

vi.mock("@jhadina/capability-registry", () => ({
  createRemoteRuntime: () => ({ devices: { list } }),
}))
vi.mock("@jhadina/capability-registry/remote-development-policy", () => ({
  RemoteDevelopmentPolicy: class {},
}))

describe("GET /api/remote/devices", () => {
  it("returns the authoritative device list without transport credentials", async () => {
    const { GET } = await import("./route")
    const response = await GET()

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      devices: [
        { deviceId: "tv-1", entityId: "media_player.tv" },
        { deviceId: "speaker-1", entityId: "media_player.speaker" },
      ],
    })
  })
})
