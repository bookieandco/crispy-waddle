import type { MemoryStorage } from "./MemoryStorage"
import { InMemoryStorage } from "./InMemoryStorage"
import { SupabaseMemoryStorage } from "./SupabaseMemoryStorage"
import { VercelOidcMemoryStorage } from "./VercelOidcMemoryStorage"
import { createServiceRoleClient } from "../supabase/service-role"

let canonicalStorage: MemoryStorage | undefined

/**
 * One canonical Memory graph for the server process.
 *
 * Production is never allowed to silently fall back to volatile memory. Local
 * development and tests may use InMemoryStorage when Supabase is intentionally
 * absent.
 */
export function createMemoryStorageForRuntime(): MemoryStorage {
  const client = createServiceRoleClient()
  if (client) return new SupabaseMemoryStorage(client)

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
