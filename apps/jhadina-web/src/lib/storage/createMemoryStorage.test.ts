import { afterEach, describe, expect, it, vi } from "vitest"
import { InMemoryStorage } from "./InMemoryStorage"
import { VercelOidcMemoryStorage } from "./VercelOidcMemoryStorage"
import {
  createMemoryStorageForRuntime,
  getCanonicalMemoryStorage,
  resetCanonicalMemoryStorageForTests,
} from "./createMemoryStorage"

afterEach(() => {
  vi.unstubAllEnvs()
  resetCanonicalMemoryStorageForTests()
})

describe("canonical Memory storage composition", () => {
  it("fails closed in production when durable Supabase storage is unavailable", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    vi.stubEnv("VERCEL", "")
    vi.stubEnv("VERCEL_ENV", "")

    expect(() => createMemoryStorageForRuntime()).toThrow(
      "JHADINA_MEMORY_DURABLE_STORAGE_REQUIRED",
    )
  })

  it("uses the Vercel OIDC durable gateway in production when no direct service-role key is present", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")
    vi.stubEnv("VERCEL", "1")
    vi.stubEnv("VERCEL_ENV", "production")

    expect(createMemoryStorageForRuntime()).toBeInstanceOf(VercelOidcMemoryStorage)
  })


  it("uses an explicitly selected OIDC gateway even when migrating away from hosted storage", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("JHADINA_MEMORY_STORAGE_PROVIDER", "oidc_gateway")
    vi.stubEnv("JHADINA_MEMORY_GATEWAY_URL", "https://portable.example.test/v1/memory")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://legacy.supabase.co")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "legacy-public")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "legacy-service-role")

    expect(createMemoryStorageForRuntime()).toBeInstanceOf(VercelOidcMemoryStorage)
  })

  it("fails closed when an explicit OIDC gateway has no endpoint", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("JHADINA_MEMORY_STORAGE_PROVIDER", "oidc_gateway")
    vi.stubEnv("JHADINA_MEMORY_GATEWAY_URL", "")

    expect(() => createMemoryStorageForRuntime()).toThrow(
      "JHADINA_MEMORY_GATEWAY_URL_REQUIRED",
    )
  })

  it("rejects plaintext OIDC gateway transport in production", () => {
    vi.stubEnv("NODE_ENV", "production")
    vi.stubEnv("JHADINA_MEMORY_STORAGE_PROVIDER", "oidc_gateway")
    vi.stubEnv("JHADINA_MEMORY_GATEWAY_URL", "http://portable.example.test/v1/memory")

    expect(() => createMemoryStorageForRuntime()).toThrow(
      "JHADINA_MEMORY_GATEWAY_HTTPS_REQUIRED",
    )
  })

  it("uses one process-local storage graph in dev/test", () => {
    vi.stubEnv("NODE_ENV", "test")
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "")
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "")

    const first = getCanonicalMemoryStorage()
    const second = getCanonicalMemoryStorage()

    expect(first).toBeInstanceOf(InMemoryStorage)
    expect(second).toBe(first)
  })
})
