export interface ActionRequestIdentity {
  userId: string
  sessionId: string
}

export interface JhadinaActionRequest {
  /** Optional legacy assertion; authorization always comes from verified claims. */
  userId?: string
}

export interface JhadinaIdentityVerifier {
  verify(request?: JhadinaActionRequest): Promise<ActionRequestIdentity>
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
 * Identity is always derived from server-verified Supabase claims. A caller
 * supplied userId is optional and, when present, is treated only as a
 * consistency assertion — never as the source of authorization identity.
 */
export class SupabaseActionIdentityVerifier implements JhadinaIdentityVerifier {
  constructor(private readonly supabase: SupabaseClaimsClient) {}

  async verify(request: JhadinaActionRequest = {}): Promise<ActionRequestIdentity> {
    const { data, error } = await this.supabase.auth.getClaims()

    if (error) {
      throw new Error(`Supabase identity verification failed: ${error.message}`)
    }

    const userId = typeof data.claims?.sub === "string" ? data.claims.sub : ""
    const sessionId =
      typeof data.claims?.session_id === "string" ? data.claims.session_id : ""

    if (!userId) throw new Error("Authenticated user missing")
    if (!sessionId) throw new Error("Authenticated session missing")

    if (request.userId !== undefined && userId !== request.userId) {
      throw new Error("Action identity mismatch")
    }

    return { userId, sessionId }
  }
}
