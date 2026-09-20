import type { Opportunity, OpportunityLearningSignal, OpportunityOutcome, OpportunityPursuitCase, OpportunityStatus, PursuitTaskStatus } from "@jhadina/opportunity-core"
import { createClient } from "@/lib/supabase/server"
import type { OpportunityTriageState, StoredCanonicalOpportunity } from "./canonical"

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


    async startResearch(
      opportunity: Opportunity,
      pursuitCase: OpportunityPursuitCase,
    ): Promise<StoredCanonicalOpportunity> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_opportunity_start_research", {
        p_opportunity_id: opportunity.id,
        p_opportunity: opportunity,
        p_case: pursuitCase,
        p_tasks: pursuitCase.tasks,
      })

      if (error || !data) {
        throw new Error(`Unable to start opportunity research: ${error?.message ?? "no result returned"}`)
      }

      const result = data as {
        userId: string
        opportunity: Opportunity
        triageState: OpportunityTriageState
        approvedAt?: string
        researchCaseId?: string
      }

      return {
        userId: result.userId,
        opportunity: result.opportunity,
        triageState: result.triageState,
        approvedAt: result.approvedAt,
        researchCaseId: result.researchCaseId,
      }
    },

    async updateResearchTask(input: {
      researchCaseId: string
      taskId: string
      status: PursuitTaskStatus
      evidenceRefs?: string[]
    }): Promise<OpportunityPursuitCase> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_opportunity_update_research_task", {
        p_case_id: input.researchCaseId,
        p_task_id: input.taskId,
        p_status: input.status,
        p_evidence_refs: input.evidenceRefs ?? [],
      })

      if (error || !data) {
        throw new Error(`Unable to update research task: ${error?.message ?? "no result returned"}`)
      }
      return data as OpportunityPursuitCase
    },

    async promoteReady(
      opportunity: Opportunity,
      researchCaseId: string,
    ): Promise<StoredCanonicalOpportunity> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_opportunity_promote_ready", {
        p_opportunity_id: opportunity.id,
        p_case_id: researchCaseId,
        p_opportunity: opportunity,
      })
      if (error || !data) {
        throw new Error(`Unable to promote opportunity ready: ${error?.message ?? "no result returned"}`)
      }

      const result = data as {
        userId: string
        opportunity: Opportunity
        triageState: OpportunityTriageState
        approvedAt?: string
        researchCaseId?: string
      }
      return {
        userId: result.userId,
        opportunity: result.opportunity,
        triageState: result.triageState,
        approvedAt: result.approvedAt,
        researchCaseId: result.researchCaseId,
      }
    },

    async recordOutcome(
      opportunity: Opportunity,
      outcome: OpportunityOutcome,
      learningSignal: OpportunityLearningSignal,
    ): Promise<{
      stored: StoredCanonicalOpportunity
      outcome: OpportunityOutcome
      learningSignal: OpportunityLearningSignal
    }> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_opportunity_record_outcome", {
        p_opportunity_id: opportunity.id,
        p_opportunity: opportunity,
        p_outcome: outcome,
        p_learning: learningSignal,
      })
      if (error || !data) {
        throw new Error(`Unable to record opportunity outcome: ${error?.message ?? "no result returned"}`)
      }

      const result = data as {
        userId: string
        opportunity: Opportunity
        triageState: OpportunityTriageState
        approvedAt?: string
        researchCaseId?: string
        outcome: OpportunityOutcome
        learningSignal: OpportunityLearningSignal
      }

      return {
        stored: {
          userId: result.userId,
          opportunity: result.opportunity,
          triageState: result.triageState,
          approvedAt: result.approvedAt,
          researchCaseId: result.researchCaseId,
        },
        outcome: result.outcome,
        learningSignal: result.learningSignal,
      }
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
