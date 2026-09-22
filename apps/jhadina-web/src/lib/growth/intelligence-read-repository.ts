import { createClient } from "../supabase/server"

export type GrowthIntelligenceCampaignRow = {
  id: string
  user_id: string
  brand_id: string
  name: string
  objective: string
  channel: string
  provider: string
  provider_account_id: string
  audience_ids: string[]
  creative_ids: string[]
  currency: string
  daily_budget_minor: number
  lifetime_budget_minor: number | null
  starts_at: string | null
  ends_at: string | null
  approval_receipt_id: string | null
  status: string
  provider_campaign_id: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export type GrowthIntelligenceAudienceRow = {
  id: string
  user_id: string
  brand_id: string
  name: string
  kind: "seed" | "lookalike" | "intent" | "retargeting" | "suppression"
  status: "draft" | "active" | "paused" | "archived"
  created_at: string
  updated_at: string
}

export type GrowthIntelligenceApprovalRow = {
  id: string
  user_id: string
  campaign_id: string
  action_id: string
  type: string
  status: "pending" | "approved" | "consumed" | "expired"
  requested_at: string
  approved_at: string | null
  expires_at: string
  consumed_at: string | null
}

export type GrowthIntelligenceOutboxRow = {
  id: string
  user_id: string
  campaign_id: string
  provider: string
  channel: string
  provider_account_id: string
  operation_intent: string
  status: "pending" | "attempting" | "delivered" | "failed" | "ambiguous" | "cancelled"
  attempt_count: number
  provider_operation_id: string | null
  provider_campaign_id: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export type GrowthIntelligenceObservationRow = {
  id: string
  user_id: string
  campaign_id: string | null
  source: string
  observed_at: string
  metrics: Record<string, unknown>
  confidence: number
  created_at: string
  observation_key?: string | null
}

export type GrowthIntelligenceLifecycleRow = {
  id: string
  user_id: string
  action: string
  channel: string | null
  rationale: string
  status: "draft" | "pending_approval" | "approved" | "sent" | "cancelled"
  requires_approval?: boolean | null
  created_at: string
  updated_at: string
}

export interface GrowthIntelligenceReadRepository {
  listCampaigns(userId: string): Promise<GrowthIntelligenceCampaignRow[]>
  listAudiences(userId: string): Promise<GrowthIntelligenceAudienceRow[]>
  listApprovals(userId: string): Promise<GrowthIntelligenceApprovalRow[]>
  listOutbox(userId: string): Promise<GrowthIntelligenceOutboxRow[]>
  listObservations(userId: string): Promise<GrowthIntelligenceObservationRow[]>
  listLifecycleProposals(userId: string): Promise<GrowthIntelligenceLifecycleRow[]>
}

export function createGrowthIntelligenceReadRepository(): GrowthIntelligenceReadRepository {
  return {
    async listCampaigns(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_paid_campaigns")
        .select("id,user_id,brand_id,name,objective,channel,provider,provider_account_id,audience_ids,creative_ids,currency,daily_budget_minor,lifetime_budget_minor,starts_at,ends_at,approval_receipt_id,status,provider_campaign_id,last_error,created_at,updated_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
      if (error) throw new Error(`GROWTH_INTELLIGENCE_CAMPAIGNS_FAILED:${error.message}`)
      return (data ?? []) as GrowthIntelligenceCampaignRow[]
    },

    async listAudiences(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_audiences")
        .select("id,user_id,brand_id,name,kind,status,created_at,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
      if (error) throw new Error(`GROWTH_INTELLIGENCE_AUDIENCES_FAILED:${error.message}`)
      return (data ?? []) as GrowthIntelligenceAudienceRow[]
    },

    async listApprovals(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_approval_receipts")
        .select("id,user_id,campaign_id,action_id,type,status,requested_at,approved_at,expires_at,consumed_at")
        .eq("user_id", userId)
        .order("requested_at", { ascending: false })
      if (error) throw new Error(`GROWTH_INTELLIGENCE_APPROVALS_FAILED:${error.message}`)
      return (data ?? []) as GrowthIntelligenceApprovalRow[]
    },

    async listOutbox(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_paid_outbox")
        .select("id,user_id,campaign_id,provider,channel,provider_account_id,operation_intent,status,attempt_count,provider_operation_id,provider_campaign_id,last_error,created_at,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
      if (error) throw new Error(`GROWTH_INTELLIGENCE_OUTBOX_FAILED:${error.message}`)
      return (data ?? []) as GrowthIntelligenceOutboxRow[]
    },

    async listObservations(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_provider_observations")
        .select("id,user_id,campaign_id,source,observed_at,metrics,confidence,created_at,observation_key")
        .eq("user_id", userId)
        .order("observed_at", { ascending: false })
        .limit(100)
      if (error) throw new Error(`GROWTH_INTELLIGENCE_OBSERVATIONS_FAILED:${error.message}`)
      return (data ?? []) as GrowthIntelligenceObservationRow[]
    },

    async listLifecycleProposals(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_growth_lifecycle_proposals")
        .select("id,user_id,action,channel,rationale,status,requires_approval,created_at,updated_at")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(100)
      if (error) throw new Error(`GROWTH_INTELLIGENCE_LIFECYCLE_FAILED:${error.message}`)
      return (data ?? []) as GrowthIntelligenceLifecycleRow[]
    },
  }
}
