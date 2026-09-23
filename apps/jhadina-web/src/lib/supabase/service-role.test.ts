import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createServiceRoleClient,
  createVercelOidcSupabaseProxyFetch,
} from "./service-role"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("service-role runtime composition", () => {
  it("keeps the direct server secret path preferred", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test")
    vi.stubEnv("VERCEL_OIDC_TOKEN", "oidc-test")
    vi.stubEnv("VERCEL_ENV", "production")

    expect(createServiceRoleClient()).not.toBeNull()
  })

  it("admits the OIDC bridge only in Vercel production", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "publishable-test")
    vi.stubEnv("VERCEL_OIDC_TOKEN", "oidc-test")
    vi.stubEnv("VERCEL_ENV", "production")

    expect(createServiceRoleClient()).not.toBeNull()

    vi.stubEnv("VERCEL_ENV", "preview")
    expect(createServiceRoleClient()).toBeNull()
  })

  it("rewrites privileged Supabase HTTP traffic through the OIDC proxy", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify([{ ok: true }]), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    )
    const proxyFetch = createVercelOidcSupabaseProxyFetch(
      "https://project.supabase.co",
      "signed-vercel-oidc",
    )

    const response = await proxyFetch(
      "https://project.supabase.co/rest/v1/rpc/jhadina_query_knowledge?limit=1",
      {
        method: "POST",
        headers: {
          apikey: "public-key",
          authorization: "Bearer public-key",
          prefer: "return=representation",
          "content-type": "application/json",
        },
        body: JSON.stringify({ p_user_id: "user-1" }),
      },
    )

    expect(response.status).toBe(200)
    expect(upstream).toHaveBeenCalledTimes(1)
    const [url, init] = upstream.mock.calls[0]!
    expect(String(url)).toBe(
      "https://project.supabase.co/functions/v1/jhadina-service-proxy",
    )
    const headers = new Headers(init?.headers)
    expect(headers.get("authorization")).toBe("Bearer signed-vercel-oidc")
    expect(headers.get("apikey")).toBeNull()
    expect(headers.get("x-jhadina-target-path")).toBe(
      "/rest/v1/rpc/jhadina_query_knowledge?limit=1",
    )
    expect(headers.get("prefer")).toBe("return=representation")
  })

  it("supports Storage paths and blocks cross-origin or non-privileged targets", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 }),
    )
    const proxyFetch = createVercelOidcSupabaseProxyFetch(
      "https://project.supabase.co",
      "signed-vercel-oidc",
    )

    await proxyFetch(
      "https://project.supabase.co/storage/v1/object/jhadina-artifacts/user/file.txt",
      {
        method: "POST",
        headers: { "content-type": "text/plain" },
        body: "payload",
      },
    )
    expect(upstream).toHaveBeenCalledTimes(1)

    await expect(
      proxyFetch("https://evil.example/rest/v1/jhadina_memories"),
    ).rejects.toThrow("JHADINA_SUPABASE_PROXY_TARGET_FORBIDDEN")

    await expect(
      proxyFetch("https://project.supabase.co/functions/v1/other"),
    ).rejects.toThrow("JHADINA_SUPABASE_PROXY_TARGET_FORBIDDEN")
  })
})
