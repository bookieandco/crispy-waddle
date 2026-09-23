import { afterEach, describe, expect, it, vi } from "vitest"
import { InMemoryStorage } from "./InMemoryStorage"
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

    expect(() => createMemoryStorageForRuntime()).toThrow(
      "JHADINA_MEMORY_DURABLE_STORAGE_REQUIRED",
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
