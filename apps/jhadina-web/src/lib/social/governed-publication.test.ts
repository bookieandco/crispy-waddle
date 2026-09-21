import { describe, expect, it } from "vitest"
import {
  InMemoryActionLedger,
  InMemoryApprovalReceiptStore,
  type ActionPolicy,
} from "@jhadina/action-core"
import type {
  JhadinaBrand,
  SocialAccount,
  SocialObservation,
  SocialOutboxJob,
  SocialPlatform,
  SocialProvider,
  SocialPublicationProposal,
  SocialPublishAction,
  SocialPublishTarget,
} from "@jhadina/social-core"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import {
  approveAndPublishSocialProposal,
  reconcileSocialProposal,
  requestSocialPublication,
  type SocialPublicationRuntimeOverrides,
} from "./governed-publication"
import type { SocialRepository } from "./repository"

class MemorySocialRepository implements SocialRepository {
  readonly accounts: SocialAccount[]
  readonly proposals = new Map<string, SocialPublicationProposal>()
  readonly outbox = new Map<string, SocialOutboxJob>()
  readonly observations: SocialObservation[] = []
  private counter = 0

  constructor(userId = "user-1") {
    this.accounts = [{
      id: "account-1",
      userId,
      brand: "jhadinatv",
      provider: "hootsuite",
      providerProfileId: "profile-1",
      platform: "youtube",
      displayName: "JhadinaTV",
      status: "connected",
      createdAt: "2026-09-20T00:00:00.000Z",
      updatedAt: "2026-09-20T00:00:00.000Z",
    }]
  }

  async listAccounts(userId: string) {
    return this.accounts.filter((account) => account.userId === userId)
  }

  async resolveTargets(userId: string, brand: JhadinaBrand, accountIds: readonly string[]) {
    const matches = this.accounts.filter(
      (account) => account.userId === userId && account.brand === brand && accountIds.includes(account.id),
    )
    if (matches.length !== new Set(accountIds).size) {
      throw new Error("SOCIAL_TARGET_OWNERSHIP_OR_BRAND_MISMATCH")
    }
    return matches.map((account): SocialPublishTarget => ({
      accountId: account.id,
      brand: account.brand,
      provider: account.provider,
      providerProfileId: account.providerProfileId,
      platform: account.platform,
    }))
  }

  async registerAccount(input: {
    userId: string
    brand: JhadinaBrand
    provider: string
    providerProfileId: string
    platform: SocialPlatform
    displayName: string
    handle?: string
  }) {
    const account: SocialAccount = {
      id: `account-${this.accounts.length + 1}`,
      ...input,
      status: "connected",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.accounts.push(account)
    return account
  }

  async createProposal(input: {
    userId: string
    actionId: string
    brand: JhadinaBrand
    text: string
    mediaUrls: readonly string[]
    scheduledAt?: string
    targetAccountIds: readonly string[]
    requestFingerprint: string
    idempotencyKey: string
  }) {
    const existing = [...this.proposals.values()].find(
      (proposal) => proposal.userId === input.userId && proposal.idempotencyKey === input.idempotencyKey,
    )
    if (existing) {
      if (existing.requestFingerprint !== input.requestFingerprint) throw new Error("SOCIAL_IDEMPOTENCY_CONFLICT")
      return existing
    }

    const targets = await this.resolveTargets(input.userId, input.brand, input.targetAccountIds)
    const now = new Date().toISOString()
    const proposal: SocialPublicationProposal = {
      id: `proposal-${++this.counter}`,
      userId: input.userId,
      actionId: input.actionId,
      brand: input.brand,
      text: input.text,
      mediaUrls: [...input.mediaUrls],
      scheduledAt: input.scheduledAt,
      targets,
      status: "pending_approval",
      requestFingerprint: input.requestFingerprint,
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      updatedAt: now,
    }
    this.proposals.set(proposal.id, proposal)
    return proposal
  }

  async attachApprovalReceipt(userId: string, proposalId: string, receiptId: string) {
    const proposal = await this.getProposal(userId, proposalId)
    const updated = { ...proposal, approvalReceiptId: receiptId, updatedAt: new Date().toISOString() }
    this.proposals.set(proposalId, updated)
    return updated
  }

  async getProposal(userId: string, proposalId: string) {
    const proposal = this.proposals.get(proposalId)
    if (!proposal || proposal.userId !== userId) throw new Error("SOCIAL_PROPOSAL_NOT_FOUND")
    return proposal
  }

  async listProposals(userId: string) {
    return [...this.proposals.values()].filter((proposal) => proposal.userId === userId)
  }

  async enqueueOutbox(userId: string, proposalId: string) {
    const proposal = await this.getProposal(userId, proposalId)
    for (const target of proposal.targets) {
      const id = `outbox:${proposalId}:${target.accountId}`
      if (this.outbox.has(id)) continue
      this.outbox.set(id, {
        id,
        proposalId,
        userId,
        actionId: proposal.actionId,
        target,
        text: proposal.text,
        mediaUrls: [...proposal.mediaUrls],
        scheduledAt: proposal.scheduledAt,
        status: "pending",
        idempotencyKey: `${proposalId}:${target.accountId}`,
        attemptCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
    }
    this.proposals.set(proposalId, { ...proposal, status: "queued", updatedAt: new Date().toISOString() })
    return this.listOutbox(userId, proposalId)
  }

  async listOutbox(userId: string, proposalId?: string) {
    return [...this.outbox.values()].filter(
      (job) => job.userId === userId && (!proposalId || job.proposalId === proposalId),
    )
  }

  async beginOutboxAttempt(userId: string, outboxId: string) {
    const job = this.outbox.get(outboxId)
    if (!job || job.userId !== userId || !["pending", "failed"].includes(job.status)) {
      throw new Error("social outbox job cannot be attempted")
    }
    const updated: SocialOutboxJob = {
      ...job,
      status: "attempting",
      attemptCount: job.attemptCount + 1,
      updatedAt: new Date().toISOString(),
    }
    this.outbox.set(outboxId, updated)
    return updated
  }

  async completeOutbox(userId: string, outboxId: string, providerPostId: string) {
    const job = this.outbox.get(outboxId)
    if (!job || job.userId !== userId) throw new Error("SOCIAL_OUTBOX_OWNER_MISMATCH")
    const updated: SocialOutboxJob = {
      ...job,
      status: "delivered",
      providerPostId,
      updatedAt: new Date().toISOString(),
    }
    this.outbox.set(outboxId, updated)
    const proposal = await this.getProposal(userId, job.proposalId)
    this.proposals.set(job.proposalId, { ...proposal, status: "delivered", updatedAt: new Date().toISOString() })
    return updated
  }

  async failOutbox(
    userId: string,
    outboxId: string,
    error: string,
    ambiguous = false,
    providerPostId?: string,
  ) {
    const job = this.outbox.get(outboxId)
    if (!job || job.userId !== userId) throw new Error("SOCIAL_OUTBOX_OWNER_MISMATCH")
    const updated: SocialOutboxJob = {
      ...job,
      status: ambiguous ? "ambiguous" : "failed",
      providerPostId: providerPostId ?? job.providerPostId,
      lastError: error,
      updatedAt: new Date().toISOString(),
    }
    this.outbox.set(outboxId, updated)
    const proposal = await this.getProposal(userId, job.proposalId)
    this.proposals.set(job.proposalId, { ...proposal, status: "failed", updatedAt: new Date().toISOString() })
    return updated
  }

  async recordObservation(input: {
    userId: string
    proposalId?: string
    outboxId?: string
    observation: Omit<SocialObservation, "id" | "userId">
  }) {
    const observation: SocialObservation = {
      ...input.observation,
      id: `observation-${this.observations.length + 1}`,
      userId: input.userId,
    }
    this.observations.push(observation)
    return observation
  }

  async listObservations(userId: string) {
    return this.observations.filter((observation) => observation.userId === userId)
  }
}

function identity(userId: string): JhadinaIdentityVerifier {
  return { verify: async () => ({ userId, sessionId: `session-${userId}` }) }
}

const approvalPolicy: ActionPolicy<SocialPublishAction> = {
  evaluate: async () => "approval_required",
}

function harness(options: { state?: "scheduled" | "published" | "failed" | "unknown" } = {}) {
  const repository = new MemorySocialRepository()
  const approvalStore = new InMemoryApprovalReceiptStore()
  const ledger = new InMemoryActionLedger()
  let publishCalls = 0
  let listCalls = 0

  const provider: SocialProvider = {
    name: "hootsuite",
    discoverProfiles: async () => [],
    async publish(input) {
      publishCalls += 1
      return [{
        provider: "hootsuite",
        providerProfileId: input.targets[0].providerProfileId,
        platform: input.targets[0].platform,
        providerPostId: "provider-post-1",
        state: options.state ?? "scheduled",
        observedAt: new Date().toISOString(),
      }]
    },
    async listDeliveries() {
      listCalls += 1
      return [{
        provider: "hootsuite",
        providerProfileId: "profile-1",
        platform: "youtube",
        providerPostId: "provider-post-1",
        state: "published",
        observedAt: new Date().toISOString(),
      }]
    },
    deleteDelivery: async () => {},
  }

  const overrides: SocialPublicationRuntimeOverrides = {
    identityVerifier: identity("user-1"),
    repository,
    approvalStore,
    ledger,
    policy: approvalPolicy,
    providerFactory: () => provider,
  }

  return {
    repository,
    overrides,
    get publishCalls() { return publishCalls },
    get listCalls() { return listCalls },
  }
}

describe("governed social publication", () => {
  it("does not call a provider while merely requesting approval", async () => {
    const test = harness()
    const requested = await requestSocialPublication({
      brand: "jhadinatv",
      text: "A governed post",
      targetAccountIds: ["account-1"],
      idempotencyKey: "request-only",
    }, test.overrides)

    expect(requested.proposal.status).toBe("pending_approval")
    expect(requested.approvalReceiptId).toBeTruthy()
    expect(test.publishCalls).toBe(0)
  })

  it("consumes one approval and prevents replay or duplicate provider dispatch", async () => {
    const test = harness()
    const requested = await requestSocialPublication({
      brand: "jhadinatv",
      text: "Publish exactly once",
      targetAccountIds: ["account-1"],
      idempotencyKey: "exactly-once",
    }, test.overrides)

    const first = await approveAndPublishSocialProposal(
      requested.proposal.id,
      requested.approvalReceiptId,
      test.overrides,
    )
    expect(first.proposal.status).toBe("delivered")
    expect(test.publishCalls).toBe(1)

    await expect(approveAndPublishSocialProposal(
      requested.proposal.id,
      requested.approvalReceiptId,
      test.overrides,
    )).rejects.toThrow("SOCIAL_PROPOSAL_NOT_AWAITING_APPROVAL")
    expect(test.publishCalls).toBe(1)
  })

  it("preserves an ambiguous provider id and reconciles without republishing", async () => {
    const test = harness({ state: "unknown" })
    const requested = await requestSocialPublication({
      brand: "jhadinatv",
      text: "Unknown provider state",
      targetAccountIds: ["account-1"],
      idempotencyKey: "ambiguous",
    }, test.overrides)

    await expect(approveAndPublishSocialProposal(
      requested.proposal.id,
      requested.approvalReceiptId,
      test.overrides,
    )).rejects.toThrow("SOCIAL_DISPATCH_REQUIRES_RECONCILIATION")

    const ambiguous = (await test.repository.listOutbox("user-1", requested.proposal.id))[0]
    expect(ambiguous.status).toBe("ambiguous")
    expect(ambiguous.providerPostId).toBe("provider-post-1")
    expect(test.publishCalls).toBe(1)

    const reconciled = await reconcileSocialProposal(requested.proposal.id, test.overrides)
    expect(reconciled.status).toBe("delivered")
    expect(test.publishCalls).toBe(1)
    expect(test.listCalls).toBe(1)
  })

  it("fails closed when another authenticated user addresses an existing proposal", async () => {
    const test = harness()
    const requested = await requestSocialPublication({
      brand: "jhadinatv",
      text: "Owner only",
      targetAccountIds: ["account-1"],
      idempotencyKey: "owner-only",
    }, test.overrides)

    await expect(approveAndPublishSocialProposal(
      requested.proposal.id,
      requested.approvalReceiptId,
      { ...test.overrides, identityVerifier: identity("user-2") },
    )).rejects.toThrow("SOCIAL_PROPOSAL_NOT_FOUND")
    expect(test.publishCalls).toBe(0)
  })
})
