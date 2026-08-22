import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import { createClient } from "../supabase/server"

/**
 * Intelligence's own durable audit ledger — same shape as Growth's
 * (PL-2), Commerce's (PL-5), and Money's (PL-8), reusing
 * SupabaseAuditLedger and the existing append_jhadina_audit_event /
 * list_jhadina_audit_events RPCs (20260814000000_append_jhadina_audit_event.sql).
 * No new table, RPC, or ledger abstraction for this domain.
 *
 * Reuses the same request-scoped Supabase client
 * createRequestIdentityVerifier() already builds (session cookies via
 * @supabase/ssr), not a service-role client or new credential.
 */
export const INTELLIGENCE_AUDIT_DOMAIN = "intelligence"

export async function createIntelligenceAuditLedger(): Promise<SupabaseAuditLedger> {
  const supabase = await createClient()
  const client: AuditRpcClient = {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await supabase.rpc(fn, args)
      return { data: (data ?? null) as T | null, error: error ? { message: error.message } : null }
    },
  }
  return new SupabaseAuditLedger({ client, domain: INTELLIGENCE_AUDIT_DOMAIN })
}
