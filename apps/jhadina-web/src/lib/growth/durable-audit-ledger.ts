import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import { createClient } from "../supabase/server"

/**
 * Durability milestone (Jhadina OS Integration Phase 2): swaps
 * InMemoryActionLedger for the real, already-implemented
 * SupabaseAuditLedger. This is the only new file the swap needed — the
 * UI, governance flow, and ActionExecutor are all unchanged.
 *
 * Reuses the same request-scoped Supabase client
 * createRequestIdentityVerifier() already builds (session cookies via
 * @supabase/ssr) rather than introducing a service-role client or any
 * new credential. Both RPCs the migration adds
 * (append_jhadina_audit_event, list_jhadina_audit_events) are granted
 * to `authenticated` and self-enforce auth.uid() = the actor being
 * written or read — a database-level backstop behind the identity
 * check already done in governed-approval.ts, not a replacement for
 * it.
 */
export const GROWTH_AUDIT_DOMAIN = "growth"

export async function createGrowthAuditLedger(): Promise<SupabaseAuditLedger> {
  const supabase = await createClient()
  const client: AuditRpcClient = {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await supabase.rpc(fn, args)
      return { data: (data ?? null) as T | null, error: error ? { message: error.message } : null }
    },
  }
  return new SupabaseAuditLedger({ client, domain: GROWTH_AUDIT_DOMAIN })
}
