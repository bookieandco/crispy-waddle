import type { ActionIdentityVerifier, ActionRequest, VerifiedIdentity } from "@jhadina/action-core"

export interface SupabaseClaims {
  sub?: unknown
  session_id?: unknown
}

export interface SupabaseClaimsClient {
  auth: {
    getClaims(): Promise<{
      data: { claims: SupabaseClaims | null }
      error: { message: string } | null
    }>
  }
}

/**
 * Adapts a request-scoped Supabase Auth client to Jhadina's governed
 * ActionIdentityVerifier contract.
 *
 * Identity comes only from server-verified Supabase claims. The caller's
 * ActionRequest userId must match the verified subject before execution can
 * proceed through VerifiedActionExecutor.
 */
export class SupabaseActionIdentityVerifier implements ActionIdentityVerifier {
  constructor(private readonly supabase: SupabaseClaimsClient) {}

  async verify(request: ActionRequest): Promise<VerifiedIdentity> {
    const { data, error } = await this.supabase.auth.getClaims()

    if (error) {
      throw new Error(`Supabase identity verification failed: ${error.message}`)
    }

    const userId = typeof data.claims?.sub === "string" ? data.claims.sub : ""
    const sessionId =
      typeof data.claims?.session_id === "string" ? data.claims.session_id : ""

    if (!userId) {
      throw new Error("Authenticated user missing")
    }

    if (!sessionId) {
      throw new Error("Authenticated session missing")
    }

    if (userId !== request.userId) {
      throw new Error("Action identity mismatch")
    }

    return { userId, sessionId }
  }
}
