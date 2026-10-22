import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import { createClient } from "../supabase/server"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import { createRuntimeServiceRoleClient } from "../supabase/service-role"
import { SOCIAL_RPC_AUTHORITY_FLAG } from "./server-mutation-rpc"

export const SOCIAL_AUDIT_DOMAIN = "social"

/**
 * A hash-chained row is an integrity record, not authorization proof.
 *
 * Social writes must originate from a trusted, owner-verified server route.
 * The production audit RPC still allows authenticated writes from other
 * subsystems, so the domain-specific SQL denial must be commissioned before
 * enabling live Social operations.
 */
export async function createSocialAuditLedger(): Promise<SupabaseAuditLedger> {
  const client: AuditRpcClient = {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      if (fn !== "append_jhadina_audit_event" && fn !== "list_jhadina_audit_events") {
        return { data: null, error: { message: "SOCIAL_AUDIT_RPC_FORBIDDEN" } }
      }
      if (args.p_domain !== SOCIAL_AUDIT_DOMAIN) {
        return { data: null, error: { message: "SOCIAL_AUDIT_DOMAIN_MISMATCH" } }
      }
      try {
        const identity = await (await createRequestIdentityVerifier()).verify({})
        if (!identity.userId || args.p_actor_id !== identity.userId) {
          return { data: null, error: { message: "SOCIAL_AUDIT_OWNER_MISMATCH" } }
        }

        if (fn === "append_jhadina_audit_event") {
          if (process.env[SOCIAL_RPC_AUTHORITY_FLAG] !== "true") {
            return { data: null, error: { message: "SOCIAL_AUDIT_NOT_COMMISSIONED" } }
          }
          const privileged = await createRuntimeServiceRoleClient()
          if (!privileged) {
            return { data: null, error: { message: "SOCIAL_AUDIT_PRIVILEGED_UNAVAILABLE" } }
          }
          const { data, error } = await privileged.rpc(fn, args)
          return { data: (data ?? null) as T | null,
            error: error ? { message: "SOCIAL_AUDIT_APPEND_FAILED" } : null }
        }

        const userClient = await createClient()
        const { data, error } = await userClient.rpc(fn, args)
        return { data: (data ?? null) as T | null,
          error: error ? { message: "SOCIAL_AUDIT_LIST_FAILED" } : null }
      } catch {
        return { data: null, error: { message: "SOCIAL_AUDIT_IDENTITY_UNAVAILABLE" } }
      }
    },
  }
  return new SupabaseAuditLedger({ client, domain: SOCIAL_AUDIT_DOMAIN })
}
