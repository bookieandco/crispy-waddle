"use client"

import { createClient } from "../supabase/client"

/**
 * Real, client-side signed-in user id — read from the actual Supabase
 * browser session (the same one the app's global middleware already
 * requires before any protected route renders; see src/middleware.ts).
 *
 * This replaces the "user_demo" hardcoded header that /growth and
 * /opportunity previously sent as their claimed identity. That value
 * could never match a real Supabase session subject, so any request it
 * backed would fail SP-1's real, server-side
 * SupabaseActionIdentityVerifier with "Action identity mismatch" —
 * the governed Growth approval path could not actually complete
 * end-to-end against a real signed-in user until this was fixed.
 *
 * Not a new identity system: this only reads the identity Supabase
 * already established client-side and hands it to the same
 * server-verified boundary SP-1 already built.
 */
export async function getCurrentUserId(): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) return null
  return data.user.id
}
