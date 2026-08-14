import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import { createClient } from "../supabase/server"

/**
 * PL-5 (Jhadina OS Integration Phase 2): Commerce's durable audit
 * ledger, the same shape as Growth's durable-audit-ledger.ts (PL-2).
 *
 * No new table, RPC, or ledger abstraction — append_jhadina_audit_event
 * and list_jhadina_audit_events are already domain-parameterized
 * (p_domain), so "commerce" is just another value in the same
 * hash-chained table Growth already durably writes to. Reuses the same
 * request-scoped Supabase client createRequestIdentityVerifier() (and
 * Growth's ledger) already build — no service-role client, no new
 * credential class.
 */
export const COMMERCE_AUDIT_DOMAIN = "commerce"

export async function createCommerceAuditLedger(): Promise<SupabaseAuditLedger> {
  const supabase = await createClient()
  const client: AuditRpcClient = {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await supabase.rpc(fn, args)
      return { data: (data ?? null) as T | null, error: error ? { message: error.message } : null }
    },
  }
  return new SupabaseAuditLedger({ client, domain: COMMERCE_AUDIT_DOMAIN })
}
