import { createClient } from "../supabase/server"

export type GrowthPaidCampaignRow = {
  id: string; user_id: string; action_id: string; brand_id: string; name: string; objective: string
  channel: string; provider: string; provider_account_id: string; audience_ids: string[]; creative_ids: string[]
  landing_page_id: string | null; currency: string; daily_budget_minor: number; lifetime_budget_minor: number | null
  starts_at: string | null; ends_at: string | null; request_fingerprint: string; idempotency_key: string
  approval_receipt_id: string | null; status: string; provider_campaign_id: string | null; last_error: string | null
  created_at: string; updated_at: string
}

export type GrowthApprovalReceiptRow = {
  id: string; user_id: string; campaign_id: string; action_id: string; type: string; fingerprint: string
  status: "pending" | "approved" | "consumed" | "expired"; requested_at: string; approved_at: string | null
  expires_at: string; consumed_at: string | null
}

export type GrowthPaidOutboxRow = {
  id: string; user_id: string; campaign_id: string; approval_receipt_id: string; provider: string; channel: string
  provider_account_id: string; operation_intent: string; payload: Record<string, unknown>; request_fingerprint: string
  idempotency_key: string; status: "pending" | "attempting" | "delivered" | "failed" | "ambiguous" | "cancelled"
  attempt_count: number; provider_operation_id: string | null; provider_campaign_id: string | null; last_error: string | null
  created_at: string; updated_at: string
}

export type CreatePaidCampaignRecord = {
  actionId: string; brandId: string; name: string; objective: string; channel: string; provider: string
  providerAccountId: string; audienceIds: string[]; creativeIds: string[]; landingPageId?: string
  currency: string; dailyBudgetMinor: number; lifetimeBudgetMinor?: number; startsAt?: string; endsAt?: string
  requestFingerprint: string; idempotencyKey: string
}

export interface GrowthProductionRepository {
  createPaidCampaign(input: CreatePaidCampaignRecord): Promise<GrowthPaidCampaignRow>
  getPaidCampaign(userId: string, campaignId: string): Promise<GrowthPaidCampaignRow>
  listPaidCampaigns(userId: string): Promise<GrowthPaidCampaignRow[]>
  requestApproval(campaignId: string, actionId: string, fingerprint: string, expiresAt: string): Promise<GrowthApprovalReceiptRow>
  approveReceipt(receiptId: string): Promise<GrowthApprovalReceiptRow>
  consumeReceipt(receiptId: string, actionId: string, fingerprint: string): Promise<boolean>
  enqueuePaidCampaign(campaignId: string): Promise<GrowthPaidOutboxRow>
  listOutbox(userId: string, campaignId: string): Promise<GrowthPaidOutboxRow[]>
  beginOutboxAttempt(outboxId: string): Promise<GrowthPaidOutboxRow>
  resolveOutbox(outboxId: string, status: "delivered" | "failed" | "ambiguous", providerOperationId?: string, providerCampaignId?: string, error?: string): Promise<GrowthPaidOutboxRow>
  recordCustomerEvent(input: {
    eventKey: string; brandId: string; customerKey: string; eventType: string; occurredAt: string; source: string
    productId?: string; value?: number; currency?: string; confidence?: number; evidence?: Record<string, unknown>
  }): Promise<Record<string, unknown>>
  createAudience(input: { brandId: string; name: string; kind: string; definition: Record<string, unknown> }): Promise<Record<string, unknown>>
  addAudienceMember(input: { audienceId: string; customerId: string; score: number; evidence?: Record<string, unknown> }): Promise<Record<string, unknown>>
  recordProviderObservation(input: { observationKey: string; campaignId: string; source: string; observedAt: string; metrics: Record<string, unknown>; evidence?: Record<string, unknown>; confidence?: number }): Promise<Record<string, unknown>>
  proposeLifecycleAction(input: { customerId: string; action: string; channel?: string; rationale: string; idempotencyKey: string }): Promise<Record<string, unknown>>
}

export function createGrowthProductionRepository(): GrowthProductionRepository {
  return {
    async createPaidCampaign(input) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_create_paid_campaign", {
        p_action_id: input.actionId, p_brand_id: input.brandId, p_name: input.name, p_objective: input.objective,
        p_channel: input.channel, p_provider: input.provider, p_provider_account_id: input.providerAccountId,
        p_audience_ids: input.audienceIds, p_creative_ids: input.creativeIds, p_landing_page_id: input.landingPageId ?? null,
        p_currency: input.currency, p_daily_budget_minor: input.dailyBudgetMinor,
        p_lifetime_budget_minor: input.lifetimeBudgetMinor ?? null, p_starts_at: input.startsAt ?? null,
        p_ends_at: input.endsAt ?? null, p_request_fingerprint: input.requestFingerprint, p_idempotency_key: input.idempotencyKey,
      }).single()
      if (error || !data) throw new Error(`GROWTH_CREATE_PAID_CAMPAIGN_FAILED:${error?.message ?? "no row"}`)
      return data as GrowthPaidCampaignRow
    },

    async getPaidCampaign(userId, campaignId) {
      const supabase = await createClient()
      const { data, error } = await supabase.from("jhadina_growth_paid_campaigns").select("*").eq("id", campaignId).eq("user_id", userId).single()
      if (error || !data) throw new Error(`GROWTH_PAID_CAMPAIGN_NOT_FOUND:${campaignId}`)
      return data as GrowthPaidCampaignRow
    },

    async listPaidCampaigns(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase.from("jhadina_growth_paid_campaigns").select("*").eq("user_id", userId).order("created_at", { ascending: false })
      if (error) throw new Error(`GROWTH_LIST_PAID_CAMPAIGNS_FAILED:${error.message}`)
      return (data ?? []) as GrowthPaidCampaignRow[]
    },

    async requestApproval(campaignId, actionId, fingerprint, expiresAt) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_request_paid_approval", {
        p_campaign_id: campaignId, p_action_id: actionId, p_fingerprint: fingerprint, p_expires_at: expiresAt,
      }).single()
      if (error || !data) throw new Error(`GROWTH_REQUEST_PAID_APPROVAL_FAILED:${error?.message ?? "no row"}`)
      return data as GrowthApprovalReceiptRow
    },

    async approveReceipt(receiptId) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_approve_paid_receipt", { p_receipt_id: receiptId }).single()
      if (error || !data) throw new Error(`GROWTH_APPROVE_PAID_RECEIPT_FAILED:${error?.message ?? "no row"}`)
      return data as GrowthApprovalReceiptRow
    },

    async consumeReceipt(receiptId, actionId, fingerprint) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_consume_paid_receipt", {
        p_receipt_id: receiptId, p_action_id: actionId, p_fingerprint: fingerprint,
      })
      if (error) throw new Error(`GROWTH_CONSUME_PAID_RECEIPT_FAILED:${error.message}`)
      return data === true
    },

    async enqueuePaidCampaign(campaignId) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_enqueue_paid_campaign", { p_campaign_id: campaignId }).single()
      if (error || !data) throw new Error(`GROWTH_ENQUEUE_PAID_CAMPAIGN_FAILED:${error?.message ?? "no row"}`)
      return data as GrowthPaidOutboxRow
    },

    async listOutbox(userId, campaignId) {
      const supabase = await createClient()
      const { data, error } = await supabase.from("jhadina_growth_paid_outbox").select("*").eq("user_id", userId).eq("campaign_id", campaignId)
      if (error) throw new Error(`GROWTH_LIST_PAID_OUTBOX_FAILED:${error.message}`)
      return (data ?? []) as GrowthPaidOutboxRow[]
    },

    async beginOutboxAttempt(outboxId) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_begin_paid_outbox_attempt", { p_outbox_id: outboxId }).single()
      if (error || !data) throw new Error(`GROWTH_BEGIN_PAID_ATTEMPT_FAILED:${error?.message ?? "no row"}`)
      return data as GrowthPaidOutboxRow
    },

    async resolveOutbox(outboxId, status, providerOperationId, providerCampaignId, errorMessage) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_resolve_paid_outbox", {
        p_outbox_id: outboxId, p_status: status, p_provider_operation_id: providerOperationId ?? null,
        p_provider_campaign_id: providerCampaignId ?? null, p_error: errorMessage ?? null,
      }).single()
      if (error || !data) throw new Error(`GROWTH_RESOLVE_PAID_OUTBOX_FAILED:${error?.message ?? "no row"}`)
      return data as GrowthPaidOutboxRow
    },

    async recordCustomerEvent(input) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_record_customer_event", {
        p_event_key: input.eventKey, p_brand_id: input.brandId, p_customer_key: input.customerKey, p_event_type: input.eventType,
        p_occurred_at: input.occurredAt, p_source: input.source, p_product_id: input.productId ?? null,
        p_value: input.value ?? null, p_currency: input.currency ?? null, p_confidence: input.confidence ?? 0.7,
        p_evidence: input.evidence ?? {},
      }).single()
      if (error || !data) throw new Error(`GROWTH_RECORD_CUSTOMER_EVENT_FAILED:${error?.message ?? "no row"}`)
      return data as Record<string, unknown>
    },

    async createAudience(input) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_create_audience", {
        p_brand_id: input.brandId, p_name: input.name, p_kind: input.kind, p_definition: input.definition,
      }).single()
      if (error || !data) throw new Error(`GROWTH_CREATE_AUDIENCE_FAILED:${error?.message ?? "no row"}`)
      return data as Record<string, unknown>
    },

    async addAudienceMember(input) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_add_audience_member", {
        p_audience_id: input.audienceId, p_customer_id: input.customerId, p_score: input.score, p_evidence: input.evidence ?? {},
      }).single()
      if (error || !data) throw new Error(`GROWTH_ADD_AUDIENCE_MEMBER_FAILED:${error?.message ?? "no row"}`)
      return data as Record<string, unknown>
    },

    async recordProviderObservation(input) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_record_provider_observation", {
        p_observation_key: input.observationKey, p_campaign_id: input.campaignId, p_source: input.source, p_observed_at: input.observedAt,
        p_metrics: input.metrics, p_evidence: input.evidence ?? {}, p_confidence: input.confidence ?? 0.5,
      }).single()
      if (error || !data) throw new Error(`GROWTH_RECORD_PROVIDER_OBSERVATION_FAILED:${error?.message ?? "no row"}`)
      return data as Record<string, unknown>
    },

    async proposeLifecycleAction(input) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_growth_propose_lifecycle_action", {
        p_customer_id: input.customerId, p_action: input.action, p_channel: input.channel ?? null, p_rationale: input.rationale, p_idempotency_key: input.idempotencyKey,
      }).single()
      if (error || !data) throw new Error(`GROWTH_PROPOSE_LIFECYCLE_ACTION_FAILED:${error?.message ?? "no row"}`)
      return data as Record<string, unknown>
    },
  }
}
