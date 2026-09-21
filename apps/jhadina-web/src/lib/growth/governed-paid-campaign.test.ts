import { describe, expect, it } from "vitest"
import {
  InMemoryActionLedger,
  createBaseSecurityCoreActionPolicy,
} from "@jhadina/action-core"
import {
  approvePaidCampaign,
  requestPaidCampaign,
  type CreatePaidCampaignInput,
  type PaidMediaProviderFactory,
} from "./governed-paid-campaign"
import type {
  GrowthApprovalReceiptRow,
  GrowthPaidCampaignRow,
  GrowthPaidOutboxRow,
  GrowthProductionRepository,
} from "./production-repository"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"

const input: CreatePaidCampaignInput = {
  brandId: "pupsonstuff",
  name: "High LTV lookalike",
  objective: "sales",
  channel: "meta",
  provider: "markifact",
  providerAccountId: "meta:test",
  audienceIds: ["aud:high-ltv"],
  creativeIds: ["creative:1"],
  currency: "USD",
  dailyBudgetMinor: 2500,
  lifetimeBudgetMinor: 25000,
  idempotencyKey: "idem:1",
}

function identity(userId: string): JhadinaIdentityVerifier {
  return { verify: async () => ({ userId, sessionId: `session:${userId}` }) }
}

class FakeRepository implements GrowthProductionRepository {
  campaign?: GrowthPaidCampaignRow
  receipt?: GrowthApprovalReceiptRow
  outbox?: GrowthPaidOutboxRow

  async createPaidCampaign(record: Parameters<GrowthProductionRepository["createPaidCampaign"]>[0]) {
    if (this.campaign) {
      if (this.campaign.request_fingerprint !== record.requestFingerprint) throw new Error("GROWTH_IDEMPOTENCY_CONFLICT")
      return this.campaign
    }
    const now = "2026-09-21T20:00:00.000Z"
    this.campaign = {
      id: "campaign-db-1", user_id: "u1", action_id: record.actionId, brand_id: record.brandId,
      name: record.name, objective: record.objective, channel: record.channel, provider: record.provider,
      provider_account_id: record.providerAccountId, audience_ids: record.audienceIds, creative_ids: record.creativeIds,
      landing_page_id: record.landingPageId ?? null, currency: record.currency, daily_budget_minor: record.dailyBudgetMinor,
      lifetime_budget_minor: record.lifetimeBudgetMinor ?? null, starts_at: record.startsAt ?? null, ends_at: record.endsAt ?? null,
      request_fingerprint: record.requestFingerprint, idempotency_key: record.idempotencyKey, approval_receipt_id: null,
      status: "pending_approval", provider_campaign_id: null, last_error: null, created_at: now, updated_at: now,
    }
    return this.campaign
  }

  async getPaidCampaign(userId: string, campaignId: string) {
    if (!this.campaign || this.campaign.id !== campaignId || this.campaign.user_id !== userId) {
      throw new Error("GROWTH_PAID_CAMPAIGN_NOT_FOUND")
    }
    return this.campaign
  }

  async listPaidCampaigns(userId: string) {
    return this.campaign?.user_id === userId ? [this.campaign] : []
  }

  async requestApproval(campaignId: string, actionId: string, fingerprint: string, expiresAt: string) {
    if (!this.campaign || this.campaign.id !== campaignId) throw new Error("campaign not found")
    this.receipt = {
      id: "receipt-1", user_id: this.campaign.user_id, campaign_id: campaignId, action_id: actionId,
      type: "paid-ad.publish", fingerprint, status: "pending", requested_at: "2026-09-21T20:00:00.000Z",
      approved_at: null, expires_at: expiresAt, consumed_at: null,
    }
    this.campaign = { ...this.campaign, approval_receipt_id: this.receipt.id }
    return this.receipt
  }

  async approveReceipt(receiptId: string) {
    if (!this.receipt || this.receipt.id !== receiptId || this.receipt.status !== "pending") throw new Error("approval receipt unavailable")
    this.receipt = { ...this.receipt, status: "approved", approved_at: new Date().toISOString() }
    return this.receipt
  }

  async consumeReceipt(receiptId: string, actionId: string, fingerprint: string) {
    if (!this.receipt || this.receipt.id !== receiptId || this.receipt.status !== "approved") return false
    if (this.receipt.action_id !== actionId || this.receipt.fingerprint !== fingerprint) return false
    this.receipt = { ...this.receipt, status: "consumed", consumed_at: new Date().toISOString() }
    if (this.campaign) this.campaign = { ...this.campaign, status: "approved" }
    return true
  }

  async enqueuePaidCampaign(campaignId: string) {
    if (!this.receipt || this.receipt.status !== "consumed") throw new Error("GROWTH_CONSUMED_APPROVAL_REQUIRED")
    if (this.outbox) return this.outbox
    this.outbox = {
      id: "outbox-1", user_id: "u1", campaign_id: campaignId, approval_receipt_id: this.receipt.id,
      provider: "markifact", channel: "meta", provider_account_id: "meta:test",
      operation_intent: "create_paused_campaign", payload: {}, request_fingerprint: this.campaign!.request_fingerprint,
      idempotency_key: "campaign-db-1:meta:meta:test", status: "pending", attempt_count: 0,
      provider_operation_id: null, provider_campaign_id: null, last_error: null,
      created_at: "2026-09-21T20:00:00.000Z", updated_at: "2026-09-21T20:00:00.000Z",
    }
    this.campaign = { ...this.campaign!, status: "queued" }
    return this.outbox
  }

  async listOutbox(userId: string, campaignId: string) {
    return this.outbox?.user_id === userId && this.outbox.campaign_id === campaignId ? [this.outbox] : []
  }

  async beginOutboxAttempt(outboxId: string) {
    if (!this.outbox || this.outbox.id !== outboxId || this.outbox.status !== "pending") throw new Error("cannot attempt")
    this.outbox = { ...this.outbox, status: "attempting", attempt_count: this.outbox.attempt_count + 1 }
    this.campaign = { ...this.campaign!, status: "attempting" }
    return this.outbox
  }

  async resolveOutbox(
    outboxId: string,
    status: "delivered" | "failed" | "ambiguous",
    providerOperationId?: string,
    providerCampaignId?: string,
    error?: string,
  ) {
    if (!this.outbox || this.outbox.id !== outboxId || this.outbox.status !== "attempting") throw new Error("cannot resolve")
    this.outbox = {
      ...this.outbox, status, provider_operation_id: providerOperationId ?? null,
      provider_campaign_id: providerCampaignId ?? null, last_error: error ?? null,
    }
    this.campaign = {
      ...this.campaign!, status, provider_campaign_id: providerCampaignId ?? this.campaign!.provider_campaign_id,
      last_error: error ?? null,
    }
    return this.outbox
  }

  async recordCustomerEvent() { return {} }
  async createAudience() { return {} }
  async addAudienceMember() { return {} }
  async recordProviderObservation() { return {} }
  async proposeLifecycleAction() { return {} }
}

const policy = createBaseSecurityCoreActionPolicy("growth-paid")
const spendCeilings = { dailyMinor: 10_000, lifetimeMinor: 100_000, currency: "USD" } as const

describe("governed paid campaign runtime", () => {
  it("creates an approval proposal without a provider call, then leaves one durable job pending when provider is unavailable", async () => {
    const repository = new FakeRepository()
    let providerCalls = 0
    const providerFactory: PaidMediaProviderFactory = () => ({
      name: "markifact", configured: false,
      async dispatch() { providerCalls += 1; throw new Error("should not run") },
    })
    const overrides = { identityVerifier: identity("u1"), ledger: new InMemoryActionLedger(), repository, policy, providerFactory, spendCeilings }

    const requested = await requestPaidCampaign(input, overrides)
    expect(providerCalls).toBe(0)
    expect(requested.campaign.status).toBe("pending_approval")

    const approved = await approvePaidCampaign(requested.campaign.id, requested.approvalReceiptId, overrides)
    expect(providerCalls).toBe(0)
    expect(approved.providerState).toBe("pending_configuration")
    expect(repository.outbox?.status).toBe("pending")
    expect(repository.outbox?.attempt_count).toBe(0)

    await expect(approvePaidCampaign(requested.campaign.id, requested.approvalReceiptId, overrides)).rejects.toThrow()
    expect(providerCalls).toBe(0)
    expect(repository.outbox?.attempt_count).toBe(0)
  })

  it("dispatches exactly once after approval when a real provider adapter is configured", async () => {
    const repository = new FakeRepository()
    let providerCalls = 0
    const providerFactory: PaidMediaProviderFactory = () => ({
      name: "fake-live", configured: true,
      async dispatch() {
        providerCalls += 1
        return { state: "delivered", providerOperationId: "op-1", providerCampaignId: "external-1" }
      },
    })
    const overrides = { identityVerifier: identity("u1"), ledger: new InMemoryActionLedger(), repository, policy, providerFactory, spendCeilings }
    const requested = await requestPaidCampaign({ ...input, idempotencyKey: "idem:2" }, overrides)
    const approved = await approvePaidCampaign(requested.campaign.id, requested.approvalReceiptId, overrides)
    expect(approved.providerState).toBe("delivered")
    expect(providerCalls).toBe(1)
    expect(repository.outbox?.attempt_count).toBe(1)
    expect(repository.campaign?.provider_campaign_id).toBe("external-1")

    await expect(approvePaidCampaign(requested.campaign.id, requested.approvalReceiptId, overrides)).rejects.toThrow()
    expect(providerCalls).toBe(1)
  })

  it("marks an uncertain external side effect ambiguous and never turns it back into a retryable pending job", async () => {
    const repository = new FakeRepository()
    const providerFactory: PaidMediaProviderFactory = () => ({
      name: "fake-live", configured: true,
      async dispatch() { throw new Error("connection lost after submit") },
    })
    const overrides = { identityVerifier: identity("u1"), ledger: new InMemoryActionLedger(), repository, policy, providerFactory, spendCeilings }
    const requested = await requestPaidCampaign({ ...input, idempotencyKey: "idem:3" }, overrides)
    const approved = await approvePaidCampaign(requested.campaign.id, requested.approvalReceiptId, overrides)
    expect(approved.providerState).toBe("ambiguous")
    expect(repository.outbox?.status).toBe("ambiguous")
    expect(repository.outbox?.attempt_count).toBe(1)
  })

  it("rejects spend above the configured ceiling before a campaign is persisted", async () => {
    const repository = new FakeRepository()
    await expect(requestPaidCampaign(
      { ...input, idempotencyKey: "idem:ceiling", dailyBudgetMinor: 10_001 },
      { identityVerifier: identity("u1"), ledger: new InMemoryActionLedger(), repository, policy, spendCeilings },
    )).rejects.toThrow("EXCEEDS_CEILING")
    expect(repository.campaign).toBeUndefined()
  })

  it("fails closed across users", async () => {
    const repository = new FakeRepository()
    const u1 = { identityVerifier: identity("u1"), ledger: new InMemoryActionLedger(), repository, policy, spendCeilings }
    const requested = await requestPaidCampaign({ ...input, idempotencyKey: "idem:4" }, u1)
    await expect(approvePaidCampaign(requested.campaign.id, requested.approvalReceiptId, {
      identityVerifier: identity("u2"), ledger: new InMemoryActionLedger(), repository, policy, spendCeilings,
    })).rejects.toThrow("GROWTH_PAID_CAMPAIGN_NOT_FOUND")
  })
})
