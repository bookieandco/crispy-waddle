import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import { createClient } from "../supabase/server"

export const SOCIAL_AUDIT_DOMAIN = "social"

export async function createSocialAuditLedger(): Promise<SupabaseAuditLedger> {
  const supabase = await createClient()
  const client: AuditRpcClient = {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await supabase.rpc(fn, args)
      return { data: (data ?? null) as T | null, error: error ? { message: error.message } : null }
    },
  }
  return new SupabaseAuditLedger({ client, domain: SOCIAL_AUDIT_DOMAIN })
}
