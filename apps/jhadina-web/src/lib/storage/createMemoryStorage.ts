import type { MemoryStorage } from "./MemoryStorage"
import { InMemoryStorage } from "./InMemoryStorage"
import { SupabaseMemoryStorage } from "./SupabaseMemoryStorage"
import { VercelOidcMemoryStorage } from "./VercelOidcMemoryStorage"
import { createServiceRoleClient } from "../supabase/service-role"

let canonicalStorage: MemoryStorage | undefined

type MemoryStorageProvider = "auto" | "supabase" | "oidc_gateway"

function configuredProvider(): MemoryStorageProvider {
  const raw = process.env.JHADINA_MEMORY_STORAGE_PROVIDER?.trim().toLowerCase()
  if (!raw) return "auto"
  if (raw === "auto" || raw === "supabase" || raw === "oidc_gateway") return raw
  throw new Error("JHADINA_MEMORY_STORAGE_PROVIDER_INVALID")
}

function configuredGatewayEndpoint(): string {
  const raw = process.env.JHADINA_MEMORY_GATEWAY_URL?.trim()
  if (!raw) throw new Error("JHADINA_MEMORY_GATEWAY_URL_REQUIRED")
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error("JHADINA_MEMORY_GATEWAY_URL_INVALID")
  }
  if (process.env.NODE_ENV === "production" && parsed.protocol !== "https:") {
    throw new Error("JHADINA_MEMORY_GATEWAY_HTTPS_REQUIRED")
  }
  return parsed.toString()
}

/**
 * One canonical Memory graph for the server process.
 *
 * Production is never allowed to silently fall back to volatile memory.
 * Provider selection is explicit when migrating off hosted Supabase:
 *
 * - auto: preserve the current Supabase-first behavior;
 * - supabase: require a direct service-role client;
 * - oidc_gateway: use the bounded Vercel-OIDC MemoryStorage protocol at
 *   JHADINA_MEMORY_GATEWAY_URL, regardless of whether Supabase keys are still
 *   present during migration.
 *
 * Local development and tests may use InMemoryStorage only in auto mode when
 * no durable provider is configured.
 */
export function createMemoryStorageForRuntime(): MemoryStorage {
  const provider = configuredProvider()

  if (provider === "oidc_gateway") {
    return new VercelOidcMemoryStorage({ endpoint: configuredGatewayEndpoint() })
  }

  const client = createServiceRoleClient()
  if (client) return new SupabaseMemoryStorage(client)

  if (provider === "supabase") {
    throw new Error("JHADINA_MEMORY_SUPABASE_STORAGE_REQUIRED")
  }

  if (
    process.env.NODE_ENV === "production" &&
    (process.env.VERCEL === "1" || process.env.VERCEL_ENV?.trim())
  ) {
    return new VercelOidcMemoryStorage()
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("JHADINA_MEMORY_DURABLE_STORAGE_REQUIRED")
  }

  return new InMemoryStorage()
}

export function getCanonicalMemoryStorage(): MemoryStorage {
  if (!canonicalStorage) canonicalStorage = createMemoryStorageForRuntime()
  return canonicalStorage
}

/** Test-only seam. Production callers must never swap the canonical store. */
export function resetCanonicalMemoryStorageForTests(): void {
  if (process.env.NODE_ENV === "production") {
    throw new Error("JHADINA_MEMORY_STORAGE_RESET_FORBIDDEN")
  }
  canonicalStorage = undefined
}
