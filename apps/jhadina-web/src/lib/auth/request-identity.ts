import { getJhadinaApplication } from "../application/createJhadinaApplication"
import { createSupabaseServerClient } from "./supabase-server"

/**
 * Builds the request-scoped Jhadina identity verifier from the authenticated
 * Supabase SSR client. Call this only from server-side request handling.
 */
export async function createRequestIdentityVerifier() {
  const application = getJhadinaApplication()
  const supabase = await createSupabaseServerClient()
  return application.identity.createVerifier(supabase)
}
