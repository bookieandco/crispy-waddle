import { afterEach, describe, expect, it, vi } from "vitest"
import {
  createOidcSupabaseProxyFetch,
  createSchedulerServiceRoleClient,
  createServiceRoleClient,
  createVercelOidcSupabaseProxyFetch,
  resolveServiceRoleConfig,
} from "./service-role"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe("resolveServiceRoleConfig", () => {
  it("prefers NEXT_PUBLIC_SUPABASE_URL when both URL aliases exist", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://public.example.supabase.co")
    vi.stubEnv("SUPABASE_URL", "https://server.example.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role")

    expect(resolveServiceRoleConfig()).toEqual({
      url: "https://public.example.supabase.co",
      key: "service-role",
    })
  })

  it("accepts the server-only SUPABASE_URL alias", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    vi.stubEnv("SUPABASE_URL", "https://server.example.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role")

    expect(resolveServiceRoleConfig()).toEqual({
      url: "https://server.example.supabase.co",
      key: "service-role",
    })
  })

  it("fails closed without the service-role key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://public.example.supabase.co")
    vi.stubEnv("SUPABASE_URL", "")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")

    expect(resolveServiceRoleConfig()).toBeNull()
  })
})

describe("Vercel OIDC privileged Supabase fallback", () => {
  it("keeps the direct server secret path preferred", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    vi.stubEnv("VERCEL_OIDC_TOKEN", "oidc-test")
    vi.stubEnv("VERCEL_ENV", "production")

    expect(createServiceRoleClient()).not.toBeNull()
  })

  it("admits the OIDC bridge only in Vercel production", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    vi.stubEnv("VERCEL_OIDC_TOKEN", "oidc-test")
    vi.stubEnv("VERCEL_ENV", "production")

    expect(createServiceRoleClient()).not.toBeNull()

    vi.stubEnv("VERCEL_ENV", "preview")
    expect(createServiceRoleClient()).toBeNull()
  })

  it("constructs the production OIDC bridge without a static token", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    vi.stubEnv("SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    vi.stubEnv("VERCEL_OIDC_TOKEN", "")
    vi.stubEnv("VERCEL_ENV", "production")

    expect(createServiceRoleClient()).not.toBeNull()
  })

  it("rewrites privileged RPC/PostgREST traffic through the OIDC proxy", async () => {
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

  it("refreshes a rotating OIDC token provider for direct scheduler workers", async () => {
    const upstream = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 }),
    )
    const tokens = ["scheduler-oidc-1", "scheduler-oidc-2"]
    const tokenProvider = vi.fn(async () => tokens.shift() ?? "scheduler-oidc-final")
    const proxyFetch = createOidcSupabaseProxyFetch(
      "https://project.supabase.co",
      tokenProvider,
    )

    await proxyFetch("https://project.supabase.co/rest/v1/first")
    await proxyFetch("https://project.supabase.co/rest/v1/second")

    expect(tokenProvider).toHaveBeenCalledTimes(2)
    expect(upstream).toHaveBeenCalledTimes(2)
    expect(new Headers(upstream.mock.calls[0]![1]?.headers).get("authorization"))
      .toBe("Bearer scheduler-oidc-1")
    expect(new Headers(upstream.mock.calls[1]![1]?.headers).get("authorization"))
      .toBe("Bearer scheduler-oidc-2")
  })

  it("retries transient transport failures for idempotent privileged updates", async () => {
    const upstream = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
    const tokenProvider = vi.fn(async () => "scheduler-oidc")
    const proxyFetch = createOidcSupabaseProxyFetch(
      "https://project.supabase.co",
      tokenProvider,
    )

    const response = await proxyFetch(
      "https://project.supabase.co/rest/v1/jhadina_public_source_discovery_jobs?id=eq.job-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "blocked" }),
      },
    )

    expect(response.status).toBe(200)
    expect(upstream).toHaveBeenCalledTimes(2)
    expect(tokenProvider).toHaveBeenCalledTimes(2)
  })

  it("retries Postgres statement timeout responses for idempotent updates", async () => {
    const upstream = vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(
        JSON.stringify({ code: "57014", message: "canceling statement due to statement timeout" }),
        { status: 500, headers: { "content-type": "application/json" } },
      ))
      .mockResolvedValueOnce(new Response("ok", { status: 200 }))
    const proxyFetch = createOidcSupabaseProxyFetch(
      "https://project.supabase.co",
      "scheduler-oidc",
    )

    const response = await proxyFetch(
      "https://project.supabase.co/rest/v1/jhadina_public_source_discovery_jobs?id=eq.job-1",
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "blocked" }),
      },
    )

    expect(response.status).toBe(200)
    expect(upstream).toHaveBeenCalledTimes(2)
  })

  it("does not retry ordinary POST writes after a transport failure", async () => {
    const upstream = vi.spyOn(globalThis, "fetch")
      .mockRejectedValueOnce(new TypeError("fetch failed"))
    const proxyFetch = createOidcSupabaseProxyFetch(
      "https://project.supabase.co",
      "scheduler-oidc",
    )

    await expect(proxyFetch(
      "https://project.supabase.co/rest/v1/jhadina_public_awards",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: "award-1" }),
      },
    )).rejects.toThrow("fetch failed")

    expect(upstream).toHaveBeenCalledTimes(1)
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


describe("GitHub scheduler OIDC privileged Supabase fallback", () => {
  it("uses the authenticated scheduler bearer token in Vercel production", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    vi.stubEnv("VERCEL_ENV", "production")

    const request = new Request("https://example.test/internal", {
      headers: { authorization: "Bearer signed-github-scheduler-oidc" },
    })

    expect(createSchedulerServiceRoleClient(request)).not.toBeNull()
  })

  it("accepts the canonical anon-key alias used by the public Supabase config", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "eyJ-public-anon-test")
    vi.stubEnv("SUPABASE_PUBLISHABLE_KEY", "")
    vi.stubEnv("VERCEL_ENV", "production")

    const request = new Request("https://example.test/internal", {
      headers: { authorization: "Bearer signed-github-scheduler-oidc" },
    })
    expect(createSchedulerServiceRoleClient(request)).not.toBeNull()
  })

  it("fails closed without a scheduler bearer token", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    vi.stubEnv("VERCEL_ENV", "")

    expect(
      createSchedulerServiceRoleClient(new Request("https://example.test/internal")),
    ).toBeNull()
  })

  it("accepts an authenticated scheduler token without depending on VERCEL_ENV", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test")
    vi.stubEnv("VERCEL_ENV", "preview")

    expect(
      createSchedulerServiceRoleClient(
        new Request("https://example.test/internal", {
          headers: { authorization: "Bearer signed-github-scheduler-oidc" },
        }),
      ),
    ).not.toBeNull()
  })

  it("keeps the direct service-role key preferred for scheduler workers", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://project.supabase.co")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "")
    vi.stubEnv("VERCEL_ENV", "preview")

    expect(
      createSchedulerServiceRoleClient(new Request("https://example.test/internal")),
    ).not.toBeNull()
  })
})
