import { evaluateSideHustleExperiment } from "@jhadina/opportunity-core"
import type { Opportunity, OpportunityLearningSignal, OpportunityOutcome, OpportunityPursuitCase, OpportunityStatus, PursuitTaskStatus, SideHustleExperiment, SideHustleExperimentEvaluation, SideHustleExperimentObservation } from "@jhadina/opportunity-core"
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

type SideHustleExperimentRow = {
  payload: SideHustleExperiment
}

type SideHustleExperimentObservationRow = {
  payload: SideHustleExperimentObservation
}

export type StoredSideHustleExperiment = {
  experiment: SideHustleExperiment
  observations: SideHustleExperimentObservation[]
  evaluation?: SideHustleExperimentEvaluation
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
      void userId
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_opportunity_ingest", {
        p_opportunity: opportunity,
        p_triage_state: triageState,
      })
      if (error || !data) throw new Error(`Unable to persist opportunity: ${error?.message ?? "no result returned"}`)

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

    async setTriage(id: string, triageState: OpportunityTriageState): Promise<StoredCanonicalOpportunity | undefined> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_opportunity_set_triage", {
        p_opportunity_id: id,
        p_triage_state: triageState,
      })
      if (error) {
        if (error.message.toLowerCase().includes("not found")) return undefined
        throw new Error(`Unable to update opportunity triage: ${error.message}`)
      }
      if (!data) return undefined
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

    async listSideHustleExperiments(opportunityId: string): Promise<StoredSideHustleExperiment[]> {
      const supabase = await createClient()
      const [{ data: experimentRows, error: experimentError }, { data: observationRows, error: observationError }] = await Promise.all([
        supabase
          .from("jhadina_side_hustle_experiments")
          .select("payload")
          .eq("opportunity_id", opportunityId)
          .order("created_at", { ascending: false })
          .returns<SideHustleExperimentRow[]>(),
        supabase
          .from("jhadina_side_hustle_experiment_observations")
          .select("payload")
          .eq("opportunity_id", opportunityId)
          .order("observed_at", { ascending: true })
          .returns<SideHustleExperimentObservationRow[]>(),
      ])
      if (experimentError) throw new Error(`Unable to list side hustle experiments: ${experimentError.message}`)
      if (observationError) throw new Error(`Unable to list side hustle observations: ${observationError.message}`)

      const observations = (observationRows ?? []).map((row) => row.payload)
      return (experimentRows ?? []).map((row) => {
        const experiment = row.payload
        const experimentObservations = observations.filter((observation) => observation.experimentId === experiment.id)
        const evaluation = ["running", "completed"].includes(experiment.status)
          ? evaluateSideHustleExperiment({
              experiment,
              observations: experimentObservations,
              evaluatedAt: new Date().toISOString(),
            })
          : undefined
        return { experiment, observations: experimentObservations, evaluation }
      })
    },

    async createSideHustleExperiment(experiment: SideHustleExperiment): Promise<SideHustleExperiment> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_side_hustle_experiment_create", {
        p_experiment: experiment,
      })
      if (error || !data) throw new Error(`Unable to create side hustle experiment: ${error?.message ?? "no result returned"}`)
      return data as SideHustleExperiment
    },

    async startSideHustleExperiment(experimentId: string, startedAt: string): Promise<SideHustleExperiment> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_side_hustle_experiment_start", {
        p_experiment_id: experimentId,
        p_started_at: startedAt,
      })
      if (error || !data) throw new Error(`Unable to start side hustle experiment: ${error?.message ?? "no result returned"}`)
      return data as SideHustleExperiment
    },

    async recordSideHustleExperimentObservation(
      observation: SideHustleExperimentObservation,
    ): Promise<SideHustleExperimentObservation> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_side_hustle_experiment_record_observation", {
        p_observation: observation,
      })
      if (error || !data) throw new Error(`Unable to record side hustle observation: ${error?.message ?? "no result returned"}`)
      return data as SideHustleExperimentObservation
    },

    async completeSideHustleExperiment(experimentId: string, completedAt: string): Promise<SideHustleExperiment> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_side_hustle_experiment_complete", {
        p_experiment_id: experimentId,
        p_completed_at: completedAt,
      })
      if (error || !data) throw new Error(`Unable to complete side hustle experiment: ${error?.message ?? "no result returned"}`)
      return data as SideHustleExperiment
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
  }
}
