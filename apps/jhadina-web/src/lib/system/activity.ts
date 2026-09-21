import { SupabaseAuditLedger, type ActionAuditEvent, type AuditRpcClient } from "@jhadina/action-core"
import { createClient } from "../supabase/server"

export type JhadinaActivityEvent = ActionAuditEvent & { domain: string }

const ACTIVITY_DOMAINS = ["intelligence", "growth", "commerce", "money", "social"] as const

function rpcClient(supabase: Awaited<ReturnType<typeof createClient>>): AuditRpcClient {
  return {
    async rpc<T>(fn: string, args: Record<string, unknown>) {
      const { data, error } = await supabase.rpc(fn, args)
      return { data: (data ?? null) as T | null, error: error ? { message: error.message } : null }
    },
  }
}

/**
 * Read-only system activity projection over the existing canonical durable
 * ActionAudit ledger. No second agent audit store is created.
 */
export async function listJhadinaActivity(actorId: string): Promise<JhadinaActivityEvent[]> {
  const supabase = await createClient()
  const client = rpcClient(supabase)
  const groups = await Promise.all(
    ACTIVITY_DOMAINS.map(async (domain) => {
      const ledger = new SupabaseAuditLedger({ client, domain })
      const events = await ledger.list({ domain, actorId })
      return events.map((event) => ({ ...event, domain }))
    }),
  )

  return groups.flat().sort((a, b) => b.timestamp.localeCompare(a.timestamp))
}
