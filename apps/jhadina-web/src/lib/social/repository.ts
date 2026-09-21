import type {
  JhadinaBrand,
  SocialAccount,
  SocialObservation,
  SocialOutboxJob,
  SocialPlatform,
  SocialPublicationProposal,
  SocialPublishTarget,
} from "@jhadina/social-core"
import { createClient } from "../supabase/server"

type AccountRow = {
  id: string
  user_id: string
  brand: JhadinaBrand
  provider: string
  provider_profile_id: string
  platform: SocialPlatform
  display_name: string
  handle: string | null
  status: SocialAccount["status"]
  created_at: string
  updated_at: string
}

type ProposalRow = {
  id: string
  user_id: string
  action_id: string
  brand: JhadinaBrand
  text: string
  media_urls: string[]
  scheduled_at: string | null
  status: SocialPublicationProposal["status"]
  request_fingerprint: string
  idempotency_key: string
  approval_receipt_id: string | null
  created_at: string
  updated_at: string
}

type TargetRow = {
  account_id: string
  brand: JhadinaBrand
  provider: string
  provider_profile_id: string
  platform: SocialPlatform
}

type OutboxRow = {
  id: string
  proposal_id: string
  user_id: string
  action_id: string
  brand: JhadinaBrand
  provider: string
  provider_profile_id: string
  platform: SocialPlatform
  text: string
  media_urls: string[]
  scheduled_at: string | null
  status: SocialOutboxJob["status"]
  idempotency_key: string
  attempt_count: number
  provider_post_id: string | null
  last_error: string | null
  created_at: string
  updated_at: string
  target_id: string
}

type ObservationRow = {
  id: string
  user_id: string
  kind: SocialObservation["kind"]
  source: string
  provider: string | null
  platform: SocialPlatform
  account_id: string | null
  provider_profile_id: string | null
  content_id: string | null
  observed_at: string
  source_url: string | null
  evidence: string[]
  metrics: Record<string, number>
  attributes: Record<string, string | number | boolean | null>
}

function accountFromRow(row: AccountRow): SocialAccount {
  return {
    id: row.id,
    userId: row.user_id,
    brand: row.brand,
    provider: row.provider,
    providerProfileId: row.provider_profile_id,
    platform: row.platform,
    displayName: row.display_name,
    handle: row.handle ?? undefined,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function targetFromRow(row: TargetRow): SocialPublishTarget {
  return {
    accountId: row.account_id,
    brand: row.brand,
    provider: row.provider,
    providerProfileId: row.provider_profile_id,
    platform: row.platform,
  }
}

function outboxFromRow(row: OutboxRow): SocialOutboxJob {
  return {
    id: row.id,
    proposalId: row.proposal_id,
    userId: row.user_id,
    actionId: row.action_id,
    target: {
      accountId: row.target_id,
      brand: row.brand,
      provider: row.provider,
      providerProfileId: row.provider_profile_id,
      platform: row.platform,
    },
    text: row.text,
    mediaUrls: row.media_urls ?? [],
    scheduledAt: row.scheduled_at ?? undefined,
    status: row.status,
    idempotencyKey: row.idempotency_key,
    attemptCount: row.attempt_count,
    providerPostId: row.provider_post_id ?? undefined,
    lastError: row.last_error ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function observationFromRow(row: ObservationRow): SocialObservation {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind,
    source: row.source,
    provider: row.provider ?? undefined,
    platform: row.platform,
    accountId: row.account_id ?? undefined,
    providerProfileId: row.provider_profile_id ?? undefined,
    contentId: row.content_id ?? undefined,
    observedAt: row.observed_at,
    sourceUrl: row.source_url ?? undefined,
    evidence: row.evidence ?? [],
    metrics: row.metrics ?? {},
    attributes: row.attributes ?? {},
  }
}

export interface SocialRepository {
  listAccounts(userId: string): Promise<SocialAccount[]>
  resolveTargets(userId: string, brand: JhadinaBrand, accountIds: readonly string[]): Promise<SocialPublishTarget[]>
  registerAccount(input: {
    userId: string
    brand: JhadinaBrand
    provider: string
    providerProfileId: string
    platform: SocialPlatform
    displayName: string
    handle?: string
  }): Promise<SocialAccount>
  createProposal(input: {
    userId: string
    actionId: string
    brand: JhadinaBrand
    text: string
    mediaUrls: readonly string[]
    scheduledAt?: string
    targetAccountIds: readonly string[]
    requestFingerprint: string
    idempotencyKey: string
  }): Promise<SocialPublicationProposal>
  attachApprovalReceipt(userId: string, proposalId: string, receiptId: string): Promise<SocialPublicationProposal>
  getProposal(userId: string, proposalId: string): Promise<SocialPublicationProposal>
  listProposals(userId: string): Promise<SocialPublicationProposal[]>
  enqueueOutbox(userId: string, proposalId: string): Promise<SocialOutboxJob[]>
  listOutbox(userId: string, proposalId?: string): Promise<SocialOutboxJob[]>
  beginOutboxAttempt(userId: string, outboxId: string): Promise<SocialOutboxJob>
  completeOutbox(userId: string, outboxId: string, providerPostId: string): Promise<SocialOutboxJob>
  failOutbox(userId: string, outboxId: string, error: string, ambiguous?: boolean): Promise<SocialOutboxJob>
  recordObservation(input: {
    userId: string
    proposalId?: string
    outboxId?: string
    observation: Omit<SocialObservation, "id" | "userId">
  }): Promise<SocialObservation>
  listObservations(userId: string): Promise<SocialObservation[]>
}

async function proposalWithTargets(userId: string, row: ProposalRow): Promise<SocialPublicationProposal> {
  const supabase = await createClient()
  const { data: targets, error } = await supabase
    .from("jhadina_social_publication_targets")
    .select("account_id,brand,provider,provider_profile_id,platform")
    .eq("user_id", userId)
    .eq("proposal_id", row.id)
    .order("created_at", { ascending: true })

  if (error) throw new Error(`Unable to load social targets: ${error.message}`)

  return {
    id: row.id,
    userId: row.user_id,
    actionId: row.action_id,
    brand: row.brand,
    text: row.text,
    mediaUrls: row.media_urls ?? [],
    scheduledAt: row.scheduled_at ?? undefined,
    targets: ((targets ?? []) as TargetRow[]).map(targetFromRow),
    status: row.status,
    requestFingerprint: row.request_fingerprint,
    idempotencyKey: row.idempotency_key,
    approvalReceiptId: row.approval_receipt_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function createSocialRepository(): SocialRepository {
  return {
    async listAccounts(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_social_accounts")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
      if (error) throw new Error(`Unable to load social accounts: ${error.message}`)
      return ((data ?? []) as AccountRow[]).map(accountFromRow)
    },

    async resolveTargets(userId, brand, accountIds) {
      if (!accountIds.length) throw new Error("SOCIAL_TARGETS_REQUIRED")
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_social_accounts")
        .select("*")
        .eq("user_id", userId)
        .eq("brand", brand)
        .eq("status", "connected")
        .in("id", [...accountIds])
      if (error) throw new Error(`Unable to resolve social targets: ${error.message}`)
      const rows = (data ?? []) as AccountRow[]
      if (rows.length !== new Set(accountIds).size) throw new Error("SOCIAL_TARGET_OWNERSHIP_OR_BRAND_MISMATCH")
      return rows.map((row) => ({
        accountId: row.id,
        brand: row.brand,
        provider: row.provider,
        providerProfileId: row.provider_profile_id,
        platform: row.platform,
      }))
    },

    async registerAccount(input) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_upsert_account", {
          p_brand: input.brand,
          p_provider: input.provider,
          p_provider_profile_id: input.providerProfileId,
          p_platform: input.platform,
          p_display_name: input.displayName,
          p_handle: input.handle ?? null,
        })
        .single<AccountRow>()
      if (error || !data) throw new Error(`Unable to register social account: ${error?.message ?? "no account returned"}`)
      if (data.user_id !== input.userId) throw new Error("SOCIAL_ACCOUNT_OWNER_MISMATCH")
      return accountFromRow(data)
    },

    async createProposal(input) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_social_create_proposal", {
        p_action_id: input.actionId,
        p_brand: input.brand,
        p_text: input.text,
        p_media_urls: [...input.mediaUrls],
        p_scheduled_at: input.scheduledAt ?? null,
        p_target_account_ids: [...input.targetAccountIds],
        p_request_fingerprint: input.requestFingerprint,
        p_idempotency_key: input.idempotencyKey,
      })
      if (error || !data) throw new Error(`Unable to create social proposal: ${error?.message ?? "no proposal returned"}`)
      return this.getProposal(input.userId, String(data))
    },

    async attachApprovalReceipt(userId, proposalId, receiptId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_attach_approval_receipt", {
          p_proposal_id: proposalId,
          p_receipt_id: receiptId,
        })
        .single<ProposalRow>()
      if (error || !data) throw new Error(`Unable to attach social approval: ${error?.message ?? "proposal unavailable"}`)
      return proposalWithTargets(userId, data)
    },

    async getProposal(userId, proposalId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_social_publication_proposals")
        .select("*")
        .eq("user_id", userId)
        .eq("id", proposalId)
        .single<ProposalRow>()
      if (error || !data) throw new Error("SOCIAL_PROPOSAL_NOT_FOUND")
      return proposalWithTargets(userId, data)
    },

    async listProposals(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_social_publication_proposals")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
      if (error) throw new Error(`Unable to load social proposals: ${error.message}`)
      return Promise.all(((data ?? []) as ProposalRow[]).map((row) => proposalWithTargets(userId, row)))
    },

    async enqueueOutbox(userId, proposalId) {
      const supabase = await createClient()
      const { error } = await supabase.rpc("jhadina_social_enqueue_outbox", { p_proposal_id: proposalId })
      if (error) throw new Error(`Unable to enqueue social outbox: ${error.message}`)
      return this.listOutbox(userId, proposalId)
    },

    async listOutbox(userId, proposalId) {
      const supabase = await createClient()
      let query = supabase
        .from("jhadina_social_outbox")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
      if (proposalId) query = query.eq("proposal_id", proposalId)
      const { data, error } = await query
      if (error) throw new Error(`Unable to load social outbox: ${error.message}`)
      return ((data ?? []) as OutboxRow[]).map(outboxFromRow)
    },

    async beginOutboxAttempt(userId, outboxId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_begin_outbox_attempt", { p_outbox_id: outboxId })
        .single<OutboxRow>()
      if (error || !data) throw new Error(`Unable to begin social dispatch: ${error?.message ?? "job unavailable"}`)
      if (data.user_id !== userId) throw new Error("SOCIAL_OUTBOX_OWNER_MISMATCH")
      return outboxFromRow(data)
    },

    async completeOutbox(userId, outboxId, providerPostId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_complete_outbox", {
          p_outbox_id: outboxId,
          p_provider_post_id: providerPostId,
        })
        .single<OutboxRow>()
      if (error || !data) throw new Error(`Unable to complete social dispatch: ${error?.message ?? "job unavailable"}`)
      if (data.user_id !== userId) throw new Error("SOCIAL_OUTBOX_OWNER_MISMATCH")
      return outboxFromRow(data)
    },

    async failOutbox(userId, outboxId, errorMessage, ambiguous = false) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_fail_outbox", {
          p_outbox_id: outboxId,
          p_error: errorMessage,
          p_ambiguous: ambiguous,
        })
        .single<OutboxRow>()
      if (error || !data) throw new Error(`Unable to fail social dispatch: ${error?.message ?? "job unavailable"}`)
      if (data.user_id !== userId) throw new Error("SOCIAL_OUTBOX_OWNER_MISMATCH")
      return outboxFromRow(data)
    },

    async recordObservation(input) {
      const observation = input.observation
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_record_observation", {
          p_proposal_id: input.proposalId ?? null,
          p_outbox_id: input.outboxId ?? null,
          p_kind: observation.kind,
          p_source: observation.source,
          p_provider: observation.provider ?? null,
          p_platform: observation.platform,
          p_account_id: observation.accountId ?? null,
          p_provider_profile_id: observation.providerProfileId ?? null,
          p_content_id: observation.contentId ?? null,
          p_observed_at: observation.observedAt,
          p_source_url: observation.sourceUrl ?? null,
          p_evidence: [...observation.evidence],
          p_metrics: observation.metrics ?? {},
          p_attributes: observation.attributes ?? {},
        })
        .single<ObservationRow>()
      if (error || !data) throw new Error(`Unable to record social observation: ${error?.message ?? "observation unavailable"}`)
      if (data.user_id !== input.userId) throw new Error("SOCIAL_OBSERVATION_OWNER_MISMATCH")
      return observationFromRow(data)
    },

    async listObservations(userId) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .from("jhadina_social_observations")
        .select("*")
        .eq("user_id", userId)
        .order("observed_at", { ascending: false })
      if (error) throw new Error(`Unable to load social observations: ${error.message}`)
      return ((data ?? []) as ObservationRow[]).map(observationFromRow)
    },
  }
}
