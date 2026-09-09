import { createClient } from "@/lib/supabase/server"

export type AuthenticatedUser = {
  userId: string
  sessionId: string
}

/**
 * Canonical route boundary for authenticated identity.
 *
 * The browser may carry cookies, but it never chooses the authorization
 * subject. Supabase verifies the session and this helper derives the user
 * identity from that verified session only.
 */
export async function requireAuthenticatedUser(): Promise<AuthenticatedUser> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error) throw new Error(`Authentication verification failed: ${error.message}`)

  const userId = typeof data.claims?.sub === "string" ? data.claims.sub : ""
  const sessionId =
    typeof data.claims?.session_id === "string" ? data.claims.session_id : ""

  if (!userId) throw new Error("Authenticated user missing")
  if (!sessionId) throw new Error("Authenticated session missing")

  return { userId, sessionId }
}
