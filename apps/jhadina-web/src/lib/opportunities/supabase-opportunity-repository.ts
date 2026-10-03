import { evaluateSideHustleExperiment } from "@jhadina/opportunity-core"
import type { CommercialAcceptanceReceipt, CommercialDeliveryReceipt, CommercialDeliveryRoutingPlan, CommercialDeliveryStartReceipt, CommercialServiceOutcomeBridge, CommercialValidationTest, CommercialWorkOrder, IdealCustomerProfile, MarketLearning, OfferCanvas, Opportunity, OpportunityLearningSignal, OpportunityOutcome, OpportunityPursuitCase, OpportunityStatus, ProofSprint, ProspectRecord, PursuitTaskStatus, RecurringOfferAssessment, SideHustleCommercialCertification, SideHustleExperiment, SideHustleExperimentEvaluation, SideHustleExperimentObservation } from "@jhadina/opportunity-core"
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


type OpportunityResearchCaseRow = {
  id: string
  opportunity_id: string
  title: string
  status: OpportunityPursuitCase["status"]
  created_at: string
  updated_at: string
}

type OpportunityResearchTaskRow = {
  id: string
  research_case_id: string
  kind: OpportunityPursuitCase["tasks"][number]["kind"]
  title: string
  required: boolean
  status: PursuitTaskStatus
  evidence_refs: string[]
  created_at: string
  completed_at: string | null
}

type SideHustleExperimentObservationRow = {
  payload: SideHustleExperimentObservation
}

type OpportunityOutcomeRow = {
  payload: OpportunityOutcome
}

type SideHustleCommercialWorkOrderRow = {
  payload: CommercialWorkOrder
}

export type SideHustleCommercialReceiptKind =
  | "delivery_start"
  | "delivery"
  | "acceptance"
  | "routing"
  | "outcome_bridge"
  | "certification"

export type SideHustleCommercialReceiptPayload =
  | CommercialDeliveryStartReceipt
  | CommercialDeliveryReceipt
  | CommercialAcceptanceReceipt
  | CommercialDeliveryRoutingPlan
  | CommercialServiceOutcomeBridge
  | SideHustleCommercialCertification

export type StoredSideHustleCommercialReceipt = {
  id: string
  workOrderId?: string
  opportunityId?: string
  family: CommercialWorkOrder["family"]
  kind: SideHustleCommercialReceiptKind
  evidenceRefs: string[]
  payload: SideHustleCommercialReceiptPayload
  recordedAt: string
}

type SideHustleCommercialReceiptRow = {
  id: string
  work_order_id: string | null
  opportunity_id: string | null
  family: CommercialWorkOrder["family"]
  kind: SideHustleCommercialReceiptKind
  evidence_refs: string[]
  payload: SideHustleCommercialReceiptPayload
  recorded_at: string
}

export type CommercialLearningKind =
  | "offer_canvas"
  | "validation_test"
  | "market_learning"
  | "proof_sprint"
  | "recurring_offer_assessment"

export type CommercialLearningPayload =
  | OfferCanvas
  | CommercialValidationTest
  | MarketLearning
  | ProofSprint
  | RecurringOfferAssessment

export type StoredCommercialLearningRecord = {
  id: string
  opportunityId: string
  kind: CommercialLearningKind
  payload: CommercialLearningPayload
  recordedAt: string
}

type CommercialLearningRow = {
  id: string
  opportunity_id: string
  kind: CommercialLearningKind
  payload: CommercialLearningPayload
  recorded_at: string
}

type ProspectIcpRow = {
  payload: IdealCustomerProfile
}

type ProspectRow = {
  payload: ProspectRecord
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

    async getResearchCase(id: string): Promise<OpportunityPursuitCase | undefined> {
      const supabase = await createClient()
      const [{ data: caseRow, error: caseError }, { data: taskRows, error: taskError }] = await Promise.all([
        supabase
          .from("jhadina_opportunity_research_cases")
          .select("id,opportunity_id,title,status,created_at,updated_at")
          .eq("id", id)
          .maybeSingle<OpportunityResearchCaseRow>(),
        supabase
          .from("jhadina_opportunity_research_tasks")
          .select("id,research_case_id,kind,title,required,status,evidence_refs,created_at,completed_at")
          .eq("research_case_id", id)
          .order("created_at", { ascending: true })
          .order("id", { ascending: true })
          .returns<OpportunityResearchTaskRow[]>(),
      ])
      if (caseError) throw new Error(`Unable to load opportunity research case: ${caseError.message}`)
      if (taskError) throw new Error(`Unable to load opportunity research tasks: ${taskError.message}`)
      if (!caseRow) return undefined
      return {
        id: caseRow.id,
        opportunityId: caseRow.opportunity_id,
        title: caseRow.title,
        status: caseRow.status,
        tasks: (taskRows ?? []).map((row) => ({
          id: row.id,
          kind: row.kind,
          title: row.title,
          required: row.required,
          status: row.status,
          evidenceRefs: row.evidence_refs ?? [],
          createdAt: row.created_at,
          completedAt: row.completed_at ?? undefined,
        })),
        createdAt: caseRow.created_at,
        updatedAt: caseRow.updated_at,
      }
    },

    async getOutcome(id: string): Promise<OpportunityOutcome | undefined> {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_opportunity_outcomes")
        .select("payload")
        .eq("id", id)
        .maybeSingle<OpportunityOutcomeRow>()
      if (error) throw new Error(`Unable to load opportunity outcome: ${error.message}`)
      return data?.payload
    },

    async listOutcomes(opportunityId: string): Promise<OpportunityOutcome[]> {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_opportunity_outcomes")
        .select("payload")
        .eq("opportunity_id", opportunityId)
        .order("observed_at", { ascending: true })
        .returns<OpportunityOutcomeRow[]>()
      if (error) throw new Error(`Unable to list opportunity outcomes: ${error.message}`)
      return (data ?? []).map((row) => row.payload)
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

    async getSideHustleCommercialWorkOrder(id: string): Promise<CommercialWorkOrder | undefined> {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_side_hustle_work_orders")
        .select("payload")
        .eq("id", id)
        .maybeSingle<SideHustleCommercialWorkOrderRow>()
      if (error) throw new Error(`Unable to load Side Hustle commercial work order: ${error.message}`)
      return data?.payload
    },

    async listSideHustleCommercialWorkOrders(opportunityId?: string): Promise<CommercialWorkOrder[]> {
      const supabase = await createClient()
      let query = supabase
        .from("jhadina_side_hustle_work_orders")
        .select("payload")
        .order("updated_at", { ascending: false })
      if (opportunityId) query = query.eq("opportunity_id", opportunityId)
      const { data, error } = await query.returns<SideHustleCommercialWorkOrderRow[]>()
      if (error) throw new Error(`Unable to list Side Hustle commercial work orders: ${error.message}`)
      return (data ?? []).map((row) => row.payload)
    },

    async saveSideHustleCommercialWorkOrder(workOrder: CommercialWorkOrder): Promise<CommercialWorkOrder> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_side_hustle_work_order_save", {
        p_work_order: workOrder,
      })
      if (error || !data) {
        throw new Error(`Unable to persist Side Hustle commercial work order: ${error?.message ?? "no result returned"}`)
      }
      return data as CommercialWorkOrder
    },

    async listSideHustleCommercialReceipts(input: {
      opportunityId?: string
      workOrderId?: string
      family?: CommercialWorkOrder["family"]
      kind?: SideHustleCommercialReceiptKind
    } = {}): Promise<StoredSideHustleCommercialReceipt[]> {
      const supabase = await createClient()
      let query = supabase
        .from("jhadina_side_hustle_commercial_receipts")
        .select("id,work_order_id,opportunity_id,family,kind,evidence_refs,payload,recorded_at")
        .order("recorded_at", { ascending: true })
      if (input.opportunityId) query = query.eq("opportunity_id", input.opportunityId)
      if (input.workOrderId) query = query.eq("work_order_id", input.workOrderId)
      if (input.family) query = query.eq("family", input.family)
      if (input.kind) query = query.eq("kind", input.kind)
      const { data, error } = await query.returns<SideHustleCommercialReceiptRow[]>()
      if (error) throw new Error(`Unable to list Side Hustle commercial receipts: ${error.message}`)
      return (data ?? []).map((row) => ({
        id: row.id,
        workOrderId: row.work_order_id ?? undefined,
        opportunityId: row.opportunity_id ?? undefined,
        family: row.family,
        kind: row.kind,
        evidenceRefs: row.evidence_refs ?? [],
        payload: row.payload,
        recordedAt: row.recorded_at,
      }))
    },

    async recordSideHustleCommercialReceipt(
      record: StoredSideHustleCommercialReceipt,
    ): Promise<SideHustleCommercialReceiptPayload> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_side_hustle_commercial_receipt_record", {
        p_record: {
          id: record.id,
          workOrderId: record.workOrderId,
          opportunityId: record.opportunityId,
          family: record.family,
          kind: record.kind,
          evidenceRefs: record.evidenceRefs,
          payload: record.payload,
          recordedAt: record.recordedAt,
        },
      })
      if (error || !data) {
        throw new Error(`Unable to persist Side Hustle commercial receipt: ${error?.message ?? "no result returned"}`)
      }
      return data as SideHustleCommercialReceiptPayload
    },

    async listCommercialLearning(opportunityId: string): Promise<StoredCommercialLearningRecord[]> {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_commercial_learning_records")
        .select("id,opportunity_id,kind,payload,recorded_at")
        .eq("opportunity_id", opportunityId)
        .order("recorded_at", { ascending: true })
        .returns<CommercialLearningRow[]>()
      if (error) throw new Error(`Unable to list commercial learning: ${error.message}`)
      return (data ?? []).map((row) => ({
        id: row.id,
        opportunityId: row.opportunity_id,
        kind: row.kind,
        payload: row.payload,
        recordedAt: row.recorded_at,
      }))
    },

    async upsertCommercialLearning(
      record: StoredCommercialLearningRecord,
    ): Promise<StoredCommercialLearningRecord> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_commercial_learning_upsert", {
        p_record: {
          id: record.id,
          opportunityId: record.opportunityId,
          kind: record.kind,
          payload: record.payload,
          recordedAt: record.recordedAt,
        },
      })
      if (error || !data) {
        throw new Error(`Unable to persist commercial learning: ${error?.message ?? "no result returned"}`)
      }
      const row = data as CommercialLearningRow
      return {
        id: row.id,
        opportunityId: row.opportunity_id,
        kind: row.kind,
        payload: row.payload,
        recordedAt: row.recorded_at,
      }
    },

    async listProspectIcps(): Promise<IdealCustomerProfile[]> {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_prospect_icps")
        .select("payload")
        .order("updated_at", { ascending: false })
        .returns<ProspectIcpRow[]>()
      if (error) throw new Error(`Unable to list prospect ICPs: ${error.message}`)
      return (data ?? []).map((row) => row.payload)
    },

    async upsertProspectIcp(icp: IdealCustomerProfile): Promise<IdealCustomerProfile> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_prospect_icp_upsert", {
        p_icp: icp,
      })
      if (error || !data) throw new Error(`Unable to persist prospect ICP: ${error?.message ?? "no result returned"}`)
      return (data as ProspectIcpRow).payload
    },

    async listProspects(icpId?: string): Promise<ProspectRecord[]> {
      const supabase = await createClient()
      let query = supabase
        .from("jhadina_prospects")
        .select("payload")
        .order("last_verified_at", { ascending: false })
      if (icpId) query = query.eq("icp_id", icpId)
      const { data, error } = await query.returns<ProspectRow[]>()
      if (error) throw new Error(`Unable to list prospects: ${error.message}`)
      return (data ?? []).map((row) => row.payload)
    },

    async upsertProspect(prospect: ProspectRecord): Promise<ProspectRecord> {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_prospect_upsert", {
        p_prospect: prospect,
      })
      if (error || !data) throw new Error(`Unable to persist prospect: ${error?.message ?? "no result returned"}`)
      return (data as ProspectRow).payload
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
