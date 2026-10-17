import { afterEach, describe, expect, it, vi } from "vitest"
import { apiGet, apiPost } from "./apiClient"

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })
}

describe("apiClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("unwraps data on a successful envelope", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: true, data: { count: 3 } })))
    const data = await apiGet<{ count: number }>("/api/whatever")
    expect(data.count).toBe(3)
  })

  it("throws the envelope's error message on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ success: false, error: "candidate not found" }, 400))
    )
    await expect(apiGet("/api/whatever")).rejects.toThrow("candidate not found")
  })

  it("falls back to a generic message when the envelope has no error text", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({ success: false }, 500)))
    await expect(apiGet("/api/whatever")).rejects.toThrow(/Request failed \(500\)/)
  })

  it("sends a JSON body on POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ success: true, data: null }))
    vi.stubGlobal("fetch", fetchMock)

    await apiPost("/api/interactions", { placeId: "place_1", eventType: "saved" })

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/interactions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ placeId: "place_1", eventType: "saved" }),
      })
    )
  })
})
