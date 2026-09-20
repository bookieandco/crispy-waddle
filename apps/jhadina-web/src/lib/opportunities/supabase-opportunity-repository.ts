import type { Opportunity, OpportunityStatus } from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import type { StoredCanonicalOpportunity } from "./canonical"
import type { OpportunityTriageState } from "./sideIncome"

type OpportunityRow = {
  id: string
  user_id: string
  family: Opportunity["family"]
  opportunity_type: Opportunity["type"]
  status: OpportunityStatus
  source_name: string
  source_url: string
  deadline: string | null
  fit_score: number | null
  triage_state: OpportunityTriageState
  approved_at: string | null
  research_case_id: string | null
  payload: Opportunity
  created_at: string
  updated_at: string
}

function toStored(row: OpportunityRow): StoredCanonicalOpportunity {
  return {
    userId: row.user_id,
    opportunity: row.payload,
    triageState: row.triage_state,
    approvedAt: row.approved_at ?? undefined,
    researchCaseId: row.research_case_id ?? undefined,
  }
}

function toRow(userId: string, opportunity: Opportunity, triageState: OpportunityTriageState): OpportunityRow {
  return {
    id: opportunity.id,
    user_id: userId,
    family: opportunity.family,
    opportunity_type: opportunity.type,
    status: opportunity.status,
    source_name: opportunity.sourceName,
    source_url: opportunity.sourceUrl,
    deadline: opportunity.deadline ?? null,
    fit_score: opportunity.fitScore ?? null,
    triage_state: triageState,
    approved_at: null,
    research_case_id: null,
    payload: opportunity,
    created_at: opportunity.createdAt,
    updated_at: opportunity.updatedAt,
  }
}

export function createSupabaseOpportunityRepository() {
  return {
    async list(): Promise<StoredCanonicalOpportunity[]> {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_opportunities")
        .select("*")
        .neq("triage_state", "dismissed")
        .order("fit_score", { ascending: false, nullsFirst: false })
        .order("updated_at", { ascending: false })
        .returns<OpportunityRow[]>()
      if (error) throw new Error(`Unable to list opportunities: ${error.message}`)
      return (data ?? []).map(toStored)
    },

    async get(id: string): Promise<StoredCanonicalOpportunity | undefined> {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_opportunities")
        .select("*")
        .eq("id", id)
        .maybeSingle<OpportunityRow>()
      if (error) throw new Error(`Unable to load opportunity: ${error.message}`)
      return data ? toStored(data) : undefined
    },

    async upsert(userId: string, opportunity: Opportunity, triageState: OpportunityTriageState = "review"): Promise<StoredCanonicalOpportunity> {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_opportunities")
        .upsert(toRow(userId, opportunity, triageState), { onConflict: "user_id,id" })
        .select("*")
        .single<OpportunityRow>()
      if (error || !data) throw new Error(`Unable to persist opportunity: ${error?.message ?? "no row returned"}`)
      return toStored(data)
    },

    async setTriage(id: string, triageState: OpportunityTriageState): Promise<StoredCanonicalOpportunity | undefined> {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_opportunities")
        .update({ triage_state: triageState, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select("*")
        .maybeSingle<OpportunityRow>()
      if (error) throw new Error(`Unable to update opportunity triage: ${error.message}`)
      return data ? toStored(data) : undefined
    },

    async updateLifecycle(id: string, opportunity: Opportunity, input?: { approvedAt?: string; researchCaseId?: string }): Promise<StoredCanonicalOpportunity | undefined> {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_opportunities")
        .update({
          status: opportunity.status,
          family: opportunity.family,
          opportunity_type: opportunity.type,
          source_name: opportunity.sourceName,
          source_url: opportunity.sourceUrl,
          deadline: opportunity.deadline ?? null,
          fit_score: opportunity.fitScore ?? null,
          payload: opportunity,
          updated_at: opportunity.updatedAt,
          ...(input?.approvedAt ? { approved_at: input.approvedAt } : {}),
          ...(input?.researchCaseId ? { research_case_id: input.researchCaseId } : {}),
        })
        .eq("id", id)
        .select("*")
        .maybeSingle<OpportunityRow>()
      if (error) throw new Error(`Unable to update opportunity lifecycle: ${error.message}`)
      return data ? toStored(data) : undefined
    },
  }
}
