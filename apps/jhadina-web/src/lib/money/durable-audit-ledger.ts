import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import { createClient } from "../supabase/server"

/**
 * PL-8 (Jhadina OS Integration Phase 2, Money real-integration Phase 1):
 * Money's durable audit ledger, the same shape as Growth's
 * durable-audit-ledger.ts (PL-2) and Commerce's durable-audit-ledger.ts
 * (PL-5).
 *
 * No new table, RPC, or ledger abstraction — append_jhadina_audit_event
 * and list_jhadina_audit_events are already domain-parameterized
 * (p_domain), so "money" is just another value in the same
 * hash-chained table Growth and Commerce already durably write to.
 * Reuses the same request-scoped Supabase client
 * createRequestIdentityVerifier() (and Growth's/Commerce's ledgers)
 * already build — no service-role client, no new credential class.
 *
 * Unlike Growth/Commerce (which hand-drive their own ledger.append()
 * calls and so want a SupabaseAuditLedger directly), Money's production
 * composition goes through money-core's createProductionActionExecutor,
 * which always builds its own internal SupabaseAuditLedger from a raw
 * AuditRpcClient — there is no in-memory-ledger branch to swap out, and
 * nothing here should wrap one before handing it over.
 * createMoneyAuditRpcClient() is therefore the piece the production
 * account-read runtime actually consumes; createMoneyAuditLedger()
 * (built on top of the same client) is exposed for direct ledger
 * reads/verification, the same way PL-7 used Commerce's ledger to
 * inspect its own event trail.
 */
export const MONEY_AUDIT_DOMAIN = "money"

export async function createMoneyAuditRpcClient(): Promise<AuditRpcClient> {
  const supabase = await createClient()
  return {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await supabase.rpc(fn, args)
      return { data: (data ?? null) as T | null, error: error ? { message: error.message } : null }
    },
  }
}

export async function createMoneyAuditLedger(): Promise<SupabaseAuditLedger> {
  const client = await createMoneyAuditRpcClient()
  return new SupabaseAuditLedger({ client, domain: MONEY_AUDIT_DOMAIN })
}
