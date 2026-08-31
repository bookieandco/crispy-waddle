import { describe, expect, it } from "vitest"
import { GET } from "./route"

describe("GET /api/remote/capabilities", () => {
  it("rejects requests without a deviceId", async () => {
    const response = await GET(new Request("http://localhost/api/remote/capabilities"))
    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({ error: "deviceId is required" })
  })

  it("rejects unknown devices", async () => {
    const response = await GET(new Request("http://localhost/api/remote/capabilities?deviceId=unknown-device"))
    expect(response.status).toBe(404)
    await expect(response.json()).resolves.toEqual({ error: "unknown device" })
  })
})
