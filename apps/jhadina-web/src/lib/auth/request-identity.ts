import { getJhadinaApplication } from "../application/createJhadinaApplication"
import { createClient } from "../supabase/server"
import type { SupabaseClaimsClient } from "./supabase-identity-verifier"

/**
 * Builds the request-scoped Jhadina identity verifier from the authenticated
 * Supabase SSR client. Call this only from server-side request handling.
 *
 * Reuses the existing createClient() from lib/supabase/server.ts (the same
 * client JH-014's middleware/route protection already uses) rather than a
 * second server-client constructor — one Supabase server-client boundary,
 * not two. The real SupabaseClient's auth.getClaims() has a richer return
 * shape (JWT header/signature, distinct error branches) than the narrow
 * SupabaseClaimsClient contract the identity verifier depends on, so it's
 * normalized here rather than widening that contract to the SDK's shape.
 */
export async function createRequestIdentityVerifier() {
  const application = getJhadinaApplication()
  const supabase = await createClient()
  const claimsClient: SupabaseClaimsClient = {
    auth: {
      async getClaims() {
        const { data, error } = await supabase.auth.getClaims()
        return {
          data: { claims: data?.claims ?? null },
          error: error ? { message: error.message } : null,
        }
      },
    },
  }
  return application.identity.createVerifier(claimsClient)
}
