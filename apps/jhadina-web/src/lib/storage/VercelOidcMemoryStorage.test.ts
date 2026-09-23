import { describe, expect, it, vi } from "vitest"
import { VercelOidcMemoryStorage } from "./VercelOidcMemoryStorage"

describe("VercelOidcMemoryStorage", () => {
  it("uses the Vercel OIDC bearer token for a read-only durable probe", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const headers = new Headers(init?.headers)
      expect(headers.get("authorization")).toBe("Bearer oidc-token")
      expect(JSON.parse(String(init?.body))).toEqual({ action: "probe", payload: {} })
      return new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })

    const storage = new VercelOidcMemoryStorage({
      endpoint: "https://example.test/memory",
      tokenProvider: () => "oidc-token",
      fetchImpl: fetchImpl as typeof fetch,
    })

    await expect(storage.probe()).resolves.toBeUndefined()
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })

  it("supports an async runtime OIDC token provider", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const requestHeaders = new Headers(init?.headers)
      expect(requestHeaders.get("authorization")).toBe("Bearer runtime-oidc")
      return new Response(JSON.stringify({ data: { ok: true } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      })
    })
    const storage = new VercelOidcMemoryStorage({
      tokenProvider: async () => "runtime-oidc",
      fetchImpl: fetchImpl as typeof fetch,
    })

    await expect(storage.probe()).resolves.toBeUndefined()
  })

  it("round-trips typed Memory results through the gateway", async () => {
    const memory = {
      id: "mem-1",
      userId: "user-1",
      type: "PREFERENCE" as const,
      status: "APPROVED" as const,
      content: "Keep it direct.",
      confidence: 1,
      createdAt: "2026-09-23T00:00:00.000Z",
      approvedAt: "2026-09-23T00:00:00.000Z",
    }
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({ data: [memory] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    const storage = new VercelOidcMemoryStorage({
      tokenProvider: () => "oidc-token",
      fetchImpl: fetchImpl as typeof fetch,
    })

    await expect(storage.listMemories("user-1")).resolves.toEqual([memory])
  })

  it("fails closed when Vercel OIDC is unavailable", async () => {
    const storage = new VercelOidcMemoryStorage({
      tokenProvider: () => undefined,
      fetchImpl: vi.fn() as unknown as typeof fetch,
    })

    await expect(storage.probe()).rejects.toThrow("JHADINA_MEMORY_VERCEL_OIDC_REQUIRED")
  })

  it("fails closed when the gateway rejects the workload identity", async () => {
    const storage = new VercelOidcMemoryStorage({
      tokenProvider: () => "bad-token",
      fetchImpl: (async () =>
        new Response(JSON.stringify({ error: "unauthorized" }), {
          status: 401,
          headers: { "content-type": "application/json" },
        })) as typeof fetch,
    })

    await expect(storage.probe()).rejects.toThrow(
      "JHADINA_MEMORY_GATEWAY_FAILED:probe:401:unauthorized",
    )
  })
})
