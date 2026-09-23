import { afterEach, describe, expect, it, vi } from "vitest"
import { resolveServiceRoleConfig } from "./service-role"

afterEach(() => {
  vi.unstubAllEnvs()
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
