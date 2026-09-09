import { describe, expect, it } from "vitest"
import { SupabaseActionIdentityVerifier, type SupabaseClaimsClient } from "./supabase-identity-verifier"

function client(claims: { sub?: unknown; session_id?: unknown }): SupabaseClaimsClient {
  return {
    auth: {
      async getClaims() {
        return { data: { claims }, error: null }
      },
    },
  }
}

describe("SupabaseActionIdentityVerifier", () => {
  it("derives identity without requiring a client-supplied user id", async () => {
    const verifier = new SupabaseActionIdentityVerifier(client({ sub: "user-123", session_id: "session-456" }))
    await expect(verifier.verify()).resolves.toEqual({ userId: "user-123", sessionId: "session-456" })
  })

  it("treats a supplied user id only as a consistency assertion", async () => {
    const verifier = new SupabaseActionIdentityVerifier(client({ sub: "user-123", session_id: "session-456" }))
    await expect(verifier.verify({ userId: "user-123" })).resolves.toEqual({ userId: "user-123", sessionId: "session-456" })
    await expect(verifier.verify({ userId: "attacker" })).rejects.toThrow("Action identity mismatch")
  })

  it("fails closed when the authenticated session is incomplete", async () => {
    const verifier = new SupabaseActionIdentityVerifier(client({ sub: "user-123" }))
    await expect(verifier.verify()).rejects.toThrow("Authenticated session missing")
  })
})
