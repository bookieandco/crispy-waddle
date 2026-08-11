export interface ActionRequestIdentity {
  userId: string
  sessionId: string
}

export interface JhadinaActionRequest {
  userId: string
}

export interface JhadinaIdentityVerifier {
  verify(request: JhadinaActionRequest): Promise<ActionRequestIdentity>
}

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
 * Adapts a request-scoped Supabase Auth client to Jhadina's identity
 * verification boundary.
 *
 * Identity comes only from server-verified Supabase claims. The request's
 * userId must match the verified subject before a future governed executor
 * can be allowed to run.
 */
export class SupabaseActionIdentityVerifier implements JhadinaIdentityVerifier {
  constructor(private readonly supabase: SupabaseClaimsClient) {}

  async verify(request: JhadinaActionRequest): Promise<ActionRequestIdentity> {
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
