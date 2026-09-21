import type {
  JhadinaBrand,
  SocialContactState,
  SocialMessageOutboxJob,
  SocialMessageProposal,
  SocialPlatform,
  SocialProviderName,
} from "@jhadina/social-core"
import { createClient } from "../supabase/server"

type ContactRow = {
  id: string
  user_id: string
  recipient_ref: string
  provider: string
  platform: SocialPlatform
  provider_recipient_id: string
  state: SocialContactState
  evidence: string[]
  observed_at: string
  created_at: string
  updated_at: string
}

type ProposalRow = {
  id: string
  user_id: string
  action_id: string
  brand: JhadinaBrand
  sender_account_id: string
  provider: string
  provider_profile_id: string
  platform: SocialPlatform
  recipient_ref: string
  provider_recipient_id: string
  conversation_ref: string | null
  text: string
  offer_ref: string | null
  outreach_plan_ref: string | null
  touch_id: string | null
  brand_voice_profile_ref: string
  channel_voice_profile_ref: string
  eligibility_evidence: string[]
  eligibility_observed_at: string
  status: SocialMessageProposal["status"]
  request_fingerprint: string
  idempotency_key: string
  approval_receipt_id: string | null
  provider_message_id: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

type OutboxRow = {
  id: string
  proposal_id: string
  user_id: string
  action_id: string
  sender_account_id: string
  provider: string
  provider_profile_id: string
  platform: SocialPlatform
  provider_recipient_id: string
  conversation_ref: string | null
  text: string
  status: SocialMessageOutboxJob["status"]
  idempotency_key: string
  attempt_count: number
  provider_message_id: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface SocialContactRecord {
  recipientRef: string
  provider: SocialProviderName
  platform: SocialPlatform
  providerRecipientId: string
  state: SocialContactState
  evidenceRefs: string[]
  observedAt: string
}

export interface SocialMessageRepository {
  upsertContactState(input: {
    userId: string
    recipientRef: string
    provider: SocialProviderName
    platform: SocialPlatform
    providerRecipientId: string
    state: SocialContactState
    evidenceRefs: readonly string[]
    observedAt: string
  }): Promise<SocialContactRecord>
  getContactState(input: {
    userId: string
    provider: SocialProviderName
    providerRecipientId: string
  }): Promise<SocialContactRecord | null>
  createProposal(input: {
    userId: string
    actionId: string
    brand: JhadinaBrand
    senderAccountId: string
    recipientRef: string
    providerRecipientId: string
    conversationRef?: string
    text: string
    offerRef?: string
    outreachPlanRef?: string
    touchId?: string
    brandVoiceProfileRef: string
    channelVoiceProfileRef: string
    eligibilityEvidenceRefs: readonly string[]
    eligibilityObservedAt: string
    requestFingerprint: string
    idempotencyKey: string
  }): Promise<SocialMessageProposal>
  attachApprovalReceipt(userId: string, proposalId: string, receiptId: string): Promise<SocialMessageProposal>
  getProposal(userId: string, proposalId: string): Promise<SocialMessageProposal>
  enqueueOutbox(userId: string, proposalId: string): Promise<SocialMessageOutboxJob>
  getOutbox(userId: string, proposalId: string): Promise<SocialMessageOutboxJob | null>
  beginOutboxAttempt(userId: string, outboxId: string): Promise<SocialMessageOutboxJob>
  completeOutbox(userId: string, outboxId: string, providerMessageId: string): Promise<SocialMessageOutboxJob>
  failOutbox(
    userId: string,
    outboxId: string,
    error: string,
    ambiguous?: boolean,
    providerMessageId?: string,
  ): Promise<SocialMessageOutboxJob>
}

function contactFromRow(row: ContactRow): SocialContactRecord {
  return {
    recipientRef: row.recipient_ref,
    provider: row.provider,
    platform: row.platform,
    providerRecipientId: row.provider_recipient_id,
    state: row.state,
    evidenceRefs: row.evidence ?? [],
    observedAt: row.observed_at,
  }
}

function proposalFromRow(row: ProposalRow): SocialMessageProposal {
  return {
    id: row.id,
    userId: row.user_id,
    actionId: row.action_id,
    brand: row.brand,
    senderAccountId: row.sender_account_id,
    provider: row.provider,
    platform: row.platform,
    providerProfileId: row.provider_profile_id,
    recipientRef: row.recipient_ref,
    providerRecipientId: row.provider_recipient_id,
    conversationRef: row.conversation_ref ?? undefined,
    text: row.text,
    offerRef: row.offer_ref ?? undefined,
    outreachPlanRef: row.outreach_plan_ref ?? undefined,
    touchId: row.touch_id ?? undefined,
    brandVoiceProfileRef: row.brand_voice_profile_ref,
    channelVoiceProfileRef: row.channel_voice_profile_ref,
    eligibilityEvidenceRefs: row.eligibility_evidence ?? [],
    eligibilityObservedAt: row.eligibility_observed_at,
    status: row.status,
    requestFingerprint: row.request_fingerprint,
    idempotencyKey: row.idempotency_key,
    approvalReceiptId: row.approval_receipt_id ?? undefined,
    providerMessageId: row.provider_message_id ?? undefined,
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function outboxFromRow(row: OutboxRow): SocialMessageOutboxJob {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    userId: row.user_id,
    actionId: row.action_id,
    senderAccountId: row.sender_account_id,
    provider: row.provider,
    providerProfileId: row.provider_profile_id,
    platform: row.platform,
    providerRecipientId: row.provider_recipient_id,
    conversationRef: row.conversation_ref ?? undefined,
    text: row.text,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    attemptCount: row.attempt_count,
    providerMessageId: row.provider_message_id ?? undefined,
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createSocialMessageRepository(): SocialMessageRepository {
  return {
    async upsertContactState(input) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_upsert_contact_state", {
          p_recipient_ref: input.recipientRef,
          p_provider: input.provider,
          p_platform: input.platform,
          p_provider_recipient_id: input.providerRecipientId,
          p_state: input.state,
          p_evidence: [...input.evidenceRefs],
          p_observed_at: input.observedAt,
        })
        .single<ContactRow>()
      if (error || !data) throw new Error(`Unable to update social contact state: ${error?.message ?? "no state returned"}`)
      if (data.user_id !== input.userId) throw new Error("SOCIAL_CONTACT_OWNER_MISMATCH")
      return contactFromRow(data)
    },

    async getContactState(input) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_social_contact_states")
        .select("*")
        .eq("user_id", input.userId)
        .eq("provider", input.provider)
        .eq("provider_recipient_id", input.providerRecipientId)
        .maybeSingle<ContactRow>()
      if (error) throw new Error(`Unable to load social contact state: ${error.message}`)
      return data ? contactFromRow(data) : null
    },

    async createProposal(input) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_social_create_message_proposal", {
        p_action_id: input.actionId,
        p_brand: input.brand,
        p_sender_account_id: input.senderAccountId,
        p_recipient_ref: input.recipientRef,
        p_provider_recipient_id: input.providerRecipientId,
        p_conversation_ref: input.conversationRef ?? null,
        p_text: input.text,
        p_offer_ref: input.offerRef ?? null,
        p_outreach_plan_ref: input.outreachPlanRef ?? null,
        p_touch_id: input.touchId ?? null,
        p_brand_voice_profile_ref: input.brandVoiceProfileRef,
        p_channel_voice_profile_ref: input.channelVoiceProfileRef,
        p_eligibility_evidence: [...input.eligibilityEvidenceRefs],
        p_eligibility_observed_at: input.eligibilityObservedAt,
        p_request_fingerprint: input.requestFingerprint,
        p_idempotency_key: input.idempotencyKey,
      })
      if (error || !data) throw new Error(`Unable to create social message proposal: ${error?.message ?? "no proposal returned"}`)
      return this.getProposal(input.userId, String(data))
    },

    async attachApprovalReceipt(userId, proposalId, receiptId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_attach_message_approval", {
          p_proposal_id: proposalId,
          p_receipt_id: receiptId,
        })
        .single<ProposalRow>()
      if (error || !data) throw new Error(`Unable to attach message approval: ${error?.message ?? "proposal unavailable"}`)
      if (data.user_id !== userId) throw new Error("SOCIAL_MESSAGE_OWNER_MISMATCH")
      return proposalFromRow(data)
    },

    async getProposal(userId, proposalId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_social_message_proposals")
        .select("*")
        .eq("user_id", userId)
        .eq("id", proposalId)
        .single<ProposalRow>()
      if (error || !data) throw new Error("SOCIAL_MESSAGE_PROPOSAL_NOT_FOUND")
      return proposalFromRow(data)
    },

    async enqueueOutbox(userId, proposalId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_enqueue_message_outbox", { p_proposal_id: proposalId })
        .single<OutboxRow>()
      if (error || !data) throw new Error(`Unable to enqueue social message: ${error?.message ?? "outbox unavailable"}`)
      if (data.user_id !== userId) throw new Error("SOCIAL_MESSAGE_OUTBOX_OWNER_MISMATCH")
      return outboxFromRow(data)
    },

    async getOutbox(userId, proposalId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_social_message_outbox")
        .select("*")
        .eq("user_id", userId)
        .eq("proposal_id", proposalId)
        .maybeSingle<OutboxRow>()
      if (error) throw new Error(`Unable to load social message outbox: ${error.message}`)
      return data ? outboxFromRow(data) : null
    },

    async beginOutboxAttempt(userId, outboxId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_begin_message_attempt", { p_outbox_id: outboxId })
        .single<OutboxRow>()
      if (error || !data) throw new Error(`Unable to begin message attempt: ${error?.message ?? "outbox unavailable"}`)
      if (data.user_id !== userId) throw new Error("SOCIAL_MESSAGE_OUTBOX_OWNER_MISMATCH")
      return outboxFromRow(data)
    },

    async completeOutbox(userId, outboxId, providerMessageId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_complete_message_outbox", {
          p_outbox_id: outboxId,
          p_provider_message_id: providerMessageId,
        })
        .single<OutboxRow>()
      if (error || !data) throw new Error(`Unable to complete social message: ${error?.message ?? "outbox unavailable"}`)
      if (data.user_id !== userId) throw new Error("SOCIAL_MESSAGE_OUTBOX_OWNER_MISMATCH")
      return outboxFromRow(data)
    },

    async failOutbox(userId, outboxId, errorMessage, ambiguous = false, providerMessageId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_fail_message_outbox", {
          p_outbox_id: outboxId,
          p_error: errorMessage,
          p_ambiguous: ambiguous,
          p_provider_message_id: providerMessageId ?? null,
        })
        .single<OutboxRow>()
      if (error || !data) throw new Error(`Unable to fail social message: ${error?.message ?? "outbox unavailable"}`)
      if (data.user_id !== userId) throw new Error("SOCIAL_MESSAGE_OUTBOX_OWNER_MISMATCH")
      return outboxFromRow(data)
    },
  }
}
