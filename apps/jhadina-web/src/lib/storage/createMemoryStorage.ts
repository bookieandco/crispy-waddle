/**
 * Single Memory Core storage composition boundary.
 *
 * Production must use the durable Supabase store. In-memory storage is
 * intentionally limited to local development and tests so the application
 * composition root and route handlers cannot silently create two memory
 * universes.
 */

import type { MemoryStorage } from "./MemoryStorage"
import { InMemoryStorage } from "./InMemoryStorage"
import { SupabaseMemoryStorage } from "./SupabaseMemoryStorage"
import { createServiceRoleClient } from "../supabase/service-role"

export function createMemoryStorage(): MemoryStorage {
  const client = createServiceRoleClient()
  if (client) return new SupabaseMemoryStorage(client)

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "JHADINA_MEMORY_STORAGE_NOT_CONFIGURED: durable memory storage is required in production",
    )
  }

  console.warn(
    "[jhadina-web] durable memory storage is not configured; using InMemoryStorage for local development/tests",
  )
  return new InMemoryStorage()
}
