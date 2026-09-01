import { createClient } from "../supabase/server"

/**
 * Returns the user identity from a server-verified Supabase session.
 * Client-controlled identity headers are intentionally ignored.
 */
export async function requireAuthenticatedUserId(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()

  if (error) throw new Error(`Supabase identity verification failed: ${error.message}`)

  const userId = typeof data.claims?.sub === "string" ? data.claims.sub : ""
  const sessionId = typeof data.claims?.session_id === "string" ? data.claims.session_id : ""

  if (!userId) throw new Error("Authenticated user missing")
  if (!sessionId) throw new Error("Authenticated session missing")

  return userId
}
