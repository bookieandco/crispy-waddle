import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Privileged, service-role Supabase client. Bypasses RLS by design — every
 * table this client is used against must itself restrict its policies to
 * `to service_role` (see supabase/migrations/20260822000000_create_jhadina_memory_core.sql
 * for the pattern). Never import this from a Client Component or anything
 * that ships to the browser: SUPABASE_SERVICE_ROLE_KEY has no NEXT_PUBLIC_
 * prefix specifically so Next.js never inlines it into a client bundle.
 *
 * Returns null (not a client that quietly no-ops) when the service-role key
 * isn't configured, so callers can fall back to a known-safe alternative
 * (e.g. in-memory storage) instead of silently doing nothing against a
 * durable store that was never actually reachable.
 */
export function createServiceRoleClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
