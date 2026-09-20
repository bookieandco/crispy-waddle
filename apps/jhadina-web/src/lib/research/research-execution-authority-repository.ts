import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/service-role"

export interface ResearchExecutionAuthorityRepository {
  authorize(input: {
    planId: string
    policyDecisionId: string
    requestId: string
    actorId: string
    auditDomain: string
  }): Promise<string | undefined>
}

function requireServiceRole(client?: SupabaseClient | null): SupabaseClient {
  const resolved = client ?? createServiceRoleClient()
  if (!resolved) throw new Error("Research execution authority requires SUPABASE_SERVICE_ROLE_KEY")
  return resolved
}

export function createSupabaseResearchExecutionAuthorityRepository(
  client?: SupabaseClient | null,
): ResearchExecutionAuthorityRepository {
  const supabase = requireServiceRole(client)
  return {
    async authorize(input) {
      const { data, error } = await supabase.rpc("jhadina_authorize_research_action", {
        p_plan_id: input.planId,
        p_policy_decision_id: input.policyDecisionId,
        p_request_id: input.requestId,
        p_actor_id: input.actorId,
        p_audit_domain: input.auditDomain,
      })
      if (error) throw new Error(`Unable to authorize research action: ${error.message}`)
      return typeof data === "string" ? data : undefined
    },
  }
}
