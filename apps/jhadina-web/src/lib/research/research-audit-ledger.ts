import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import { createClient } from "@/lib/supabase/server"

export const RESEARCH_AUDIT_DOMAIN = "research"

export async function createResearchAuditLedger(): Promise<SupabaseAuditLedger> {
  const supabase = await createClient()
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
