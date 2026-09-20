import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export const RESEARCH_AUDIT_DOMAIN = "research"

export async function createResearchAuditLedger(): Promise<SupabaseAuditLedger> {
  const supabase = createServiceRoleClient()
  if (!supabase) throw new Error("Research audit ledger requires SUPABASE_SERVICE_ROLE_KEY")

  const client: AuditRpcClient = {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await supabase.rpc(fn, args)
      return {
        data: (data ?? null) as T | null,
        error: error ? { message: error.message } : null,
      }
    },
  }
  return new SupabaseAuditLedger({ client, domain: RESEARCH_AUDIT_DOMAIN })
}
