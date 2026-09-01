import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import { createClient } from "../supabase/server"

export const INTELLIGENCE_AUDIT_DOMAIN = "intelligence"

/** Request-scoped Supabase RPC adapter shared by durable Intelligence stores. */
export async function createIntelligenceAuditRpcClient(): Promise<AuditRpcClient> {
  const supabase = await createClient()
  return {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await supabase.rpc(fn, args)
      return { data: (data ?? null) as T | null, error: error ? { message: error.message } : null }
    },
  }
}

export async function createIntelligenceAuditLedger(): Promise<SupabaseAuditLedger> {
  return new SupabaseAuditLedger({
    client: await createIntelligenceAuditRpcClient(),
    domain: INTELLIGENCE_AUDIT_DOMAIN,
  })
}
