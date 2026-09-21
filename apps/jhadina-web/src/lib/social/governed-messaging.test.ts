import { describe, expect, it } from "vitest"
import {
  InMemoryActionLedger,
  InMemoryApprovalReceiptStore,
  createBaseSecurityCoreActionPolicy,
} from "@jhadina/action-core"
import type {
  JhadinaBrand,
  SocialContactState,
  SocialMessageAction,
  SocialMessageOutboxJob,
  SocialMessageProposal,
  SocialMessageProvider,
  SocialPlatform,
  SocialProviderName,
} from "@jhadina/social-core"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import {
  approveAndSendSocialMessage,
  reconcileSocialMessage,
  requestSocialMessage,
  type SocialMessageRuntimeOverrides,
} from "./governed-messaging"
import type {
  SocialContactRecord,
  SocialMessageRepository,
} from "./message-repository"

class MemoryMessageRepository implements SocialMessageRepository {
  readonly contacts = new Map<string, SocialContactRecord>()
  readonly proposals = new Map<string, SocialMessageProposal>()
  readonly outbox = new Map<string, SocialMessageOutboxJob>()
  private counter = 0

  constructor() {
    this.contacts.set("tiktok:creator-provider-1", {
      recipientRef: "creator-1",
      provider: "tiktok",
      platform: "tiktok",
      providerRecipientId: "creator-provider-1",
      state: "eligible",
      evidenceRefs: ["eligibility:creator-1"],
      observedAt: new Date().toISOString(),
    })
  }

  async upsertContactState(input: {
    userId: string
    recipientRef: string
    provider: SocialProviderName
    platform: SocialPlatform
    providerRecipientId: string
    state: SocialContactState
    evidenceRefs: readonly string[]
    observedAt: string
  }) {
    void input.userId
    const record: SocialContactRecord = {
      recipientRef: input.recipientRef,
      provider: input.provider,
      platform: input.platform,
      providerRecipientId: input.providerRecipientId,
      state: input.state,
      evidenceRefs: [...input.evidenceRefs],
      observedAt: input.observedAt,
    }
    this.contacts.set(`${input.provider}:${input.providerRecipientId}`, record)
    return record
  }

  async getContactState(input: {
    userId: string
    provider: SocialProviderName
    providerRecipientId: string
  }) {
    if (input.userId !== "user-1") return null
    return this.contacts.get(`${input.provider}:${input.providerRecipientId}`) ?? null
  }

  async createProposal(input: {
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
  }) {
    if (input.userId !== "user-1") throw new Error("SOCIAL_MESSAGE_OWNER_MISMATCH")
    if (input.senderAccountId !== "account-1" || input.brand !== "pupsonstuff") {
      throw new Error("SOCIAL_MESSAGE_SENDER_OWNERSHIP_OR_BRAND_MISMATCH")
    }
    const existing = [...this.proposals.values()].find(
      (proposal) => proposal.userId === input.userId && proposal.idempotencyKey === input.idempotencyKey,
    )
    if (existing) {
      if (existing.requestFingerprint !== input.requestFingerprint) {
        throw new Error("SOCIAL_MESSAGE_IDEMPOTENCY_CONFLICT")
      }
      return existing
    }

    const now = new Date().toISOString()
    const proposal: SocialMessageProposal = {
      id: `message-proposal-${++this.counter}`,
      userId: input.userId,
      actionId: input.actionId,
      brand: input.brand,
      senderAccountId: input.senderAccountId,
      provider: "tiktok",
      platform: "tiktok",
      providerProfileId: "sender-profile-1",
      recipientRef: input.recipientRef,
      providerRecipientId: input.providerRecipientId,
      conversationRef: input.conversationRef,
      text: input.text,
      offerRef: input.offerRef,
      outreachPlanRef: input.outreachPlanRef,
      touchId: input.touchId,
      brandVoiceProfileRef: input.brandVoiceProfileRef,
      channelVoiceProfileRef: input.channelVoiceProfileRef,
      eligibilityEvidenceRefs: [...input.eligibilityEvidenceRefs],
      eligibilityObservedAt: input.eligibilityObservedAt,
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
    if (!proposal || proposal.userId !== userId) throw new Error("SOCIAL_MESSAGE_PROPOSAL_NOT_FOUND")
    return proposal
  }

  async enqueueOutbox(userId: string, proposalId: string) {
    const proposal = await this.getProposal(userId, proposalId)
    const existing = [...this.outbox.values()].find((job) => job.proposalId === proposalId)
    if (existing) return existing
    const now = new Date().toISOString()
    const job: SocialMessageOutboxJob = {
      id: `message-outbox:${proposalId}`,
      proposalId,
      userId,
      actionId: proposal.actionId,
      senderAccountId: proposal.senderAccountId,
      provider: proposal.provider,
      providerProfileId: proposal.providerProfileId,
      platform: proposal.platform,
      providerRecipientId: proposal.providerRecipientId,
      conversationRef: proposal.conversationRef,
      text: proposal.text,
      status: "pending",
      idempotencyKey: `${proposal.id}:${proposal.providerRecipientId}`,
      attemptCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    this.outbox.set(job.id, job)
    this.proposals.set(proposal.id, { ...proposal, status: "queued", updatedAt: now })
    return job
  }

  async getOutbox(userId: string, proposalId: string) {
    return [...this.outbox.values()].find(
      (job) => job.userId === userId && job.proposalId === proposalId,
    ) ?? null
  }

  async beginOutboxAttempt(userId: string, outboxId: string) {
    const job = this.outbox.get(outboxId)
    if (!job || job.userId !== userId || !["pending", "failed"].includes(job.status)) {
      throw new Error("social message outbox cannot be attempted")
    }
    const updated: SocialMessageOutboxJob = {
      ...job,
      status: "attempting",
      attemptCount: job.attemptCount + 1,
      updatedAt: new Date().toISOString(),
    }
    this.outbox.set(outboxId, updated)
    return updated
  }

  async completeOutbox(userId: string, outboxId: string, providerMessageId: string) {
    const job = this.outbox.get(outboxId)
    if (!job || job.userId !== userId) throw new Error("SOCIAL_MESSAGE_OUTBOX_OWNER_MISMATCH")
    const now = new Date().toISOString()
    const updated: SocialMessageOutboxJob = {
      ...job,
      status: "delivered",
      providerMessageId,
      updatedAt: now,
    }
    this.outbox.set(outboxId, updated)
    const proposal = await this.getProposal(userId, job.proposalId)
    this.proposals.set(proposal.id, {
      ...proposal,
      status: "delivered",
      providerMessageId,
      updatedAt: now,
    })
    return updated
  }

  async failOutbox(
    userId: string,
    outboxId: string,
    error: string,
    ambiguous = false,
    providerMessageId?: string,
  ) {
    const job = this.outbox.get(outboxId)
    if (!job || job.userId !== userId) throw new Error("SOCIAL_MESSAGE_OUTBOX_OWNER_MISMATCH")
    const now = new Date().toISOString()
    const updated: SocialMessageOutboxJob = {
      ...job,
      status: ambiguous ? "ambiguous" : "failed",
      providerMessageId: providerMessageId ?? job.providerMessageId,
      lastError: error,
      updatedAt: now,
    }
    this.outbox.set(outboxId, updated)
    const proposal = await this.getProposal(userId, job.proposalId)
    this.proposals.set(proposal.id, {
      ...proposal,
      status: ambiguous ? "ambiguous" : "failed",
      providerMessageId: providerMessageId ?? proposal.providerMessageId,
      lastError: error,
      updatedAt: now,
    })
    return updated
  }
}

function identity(userId: string): JhadinaIdentityVerifier {
  return { verify: async () => ({ userId, sessionId: `session-${userId}` }) }
}

function harness() {
  const repository = new MemoryMessageRepository()
  const approvalStore = new InMemoryApprovalReceiptStore()
  const ledger = new InMemoryActionLedger()
  let sendCalls = 0
  let providerState: "sent" | "delivered" | "failed" | "unknown" = "sent"
  const byIdempotency = new Map<string, ReturnType<typeof receipt>>()

  function receipt(idempotencyKey: string) {
    return {
      provider: "tiktok",
      platform: "tiktok" as const,
      senderProviderProfileId: "sender-profile-1",
      providerRecipientId: "creator-provider-1",
      providerMessageId: `provider-message:${idempotencyKey}`,
      state: providerState,
      observedAt: new Date().toISOString(),
    }
  }

  const provider: SocialMessageProvider = {
    name: "tiktok",
    async sendMessage(input) {
      sendCalls += 1
      const result = receipt(input.idempotencyKey)
      byIdempotency.set(input.idempotencyKey, result)
      return result
    },
    async findMessageByIdempotencyKey(idempotencyKey) {
      const existing = byIdempotency.get(idempotencyKey)
      if (!existing) return null
      return { ...existing, state: providerState, observedAt: new Date().toISOString() }
    },
  }

  const overrides: SocialMessageRuntimeOverrides = {
    identityVerifier: identity("user-1"),
    repository,
    approvalStore,
    ledger,
    policy: createBaseSecurityCoreActionPolicy<SocialMessageAction>("social"),
    providerFactory: () => provider,
  }

  function input() {
    const contact = repository.contacts.get("tiktok:creator-provider-1")!
    return {
      brand: "pupsonstuff" as const,
      senderAccountId: "account-1",
      recipient: {
        recipientRef: "creator-1",
        providerRecipientId: "creator-provider-1",
        provider: "tiktok",
        platform: "tiktok" as const,
      },
      text: "Loved your recent pet content. Open to a product collaboration?",
      offerRef: "offer-1",
      outreachPlanRef: "plan-1",
      touchId: "touch-1",
      brandVoiceProfileRef: "voice:pupsonstuff:v1",
      channelVoiceProfileRef: "voice:tiktok:v1",
      eligibility: {
        state: contact.state,
        evidenceRefs: [...contact.evidenceRefs],
        observedAt: contact.observedAt,
      },
    }
  }

  return {
    repository,
    overrides,
    input,
    setProviderState(value: typeof providerState) { providerState = value },
    get sendCalls() { return sendCalls },
  }
}

describe("governed social messaging", () => {
  it("requires approval before any provider message side effect", async () => {
    const test = harness()
    const requested = await requestSocialMessage(test.input(), test.overrides)
    expect(requested.proposal.status).toBe("pending_approval")
    expect(requested.approvalReceiptId).toBeTruthy()
    expect(test.sendCalls).toBe(0)
  })

  it("uses the existing approval-gated consequential.outreach capability", async () => {
    const policy = createBaseSecurityCoreActionPolicy<SocialMessageAction>("social")
    const decision = await policy.evaluate({
      id: "policy-message-1",
      userId: "user-1",
      type: "consequential.outreach",
      action: { proposalId: "proposal-1", requestFingerprint: "fingerprint-1" },
      requestedAt: new Date().toISOString(),
    })
    expect(decision).toBe("approval_required")
  })

  it("sends exactly once and blocks approval replay", async () => {
    const test = harness()
    const requested = await requestSocialMessage(test.input(), test.overrides)
    const sent = await approveAndSendSocialMessage(
      requested.proposal.id,
      requested.approvalReceiptId,
      test.overrides,
    )
    expect(sent.proposal.status).toBe("delivered")
    expect(test.sendCalls).toBe(1)

    await expect(
      approveAndSendSocialMessage(
        requested.proposal.id,
        requested.approvalReceiptId,
        test.overrides,
      ),
    ).rejects.toThrow(/NOT_AWAITING_APPROVAL/)
    expect(test.sendCalls).toBe(1)
  })

  it("rechecks suppression after approval request and refuses to send", async () => {
    const test = harness()
    const requested = await requestSocialMessage(test.input(), test.overrides)
    const existing = test.repository.contacts.get("tiktok:creator-provider-1")!
    await test.repository.upsertContactState({
      userId: "user-1",
      ...existing,
      state: "stop_contact",
      evidenceRefs: ["inbound:stop-request"],
      observedAt: new Date().toISOString(),
    })

    await expect(
      approveAndSendSocialMessage(
        requested.proposal.id,
        requested.approvalReceiptId,
        test.overrides,
      ),
    ).rejects.toThrow(/ELIGIBILITY_REQUIRED/)
    expect(test.sendCalls).toBe(0)
  })

  it("reconciles an ambiguous provider send without sending twice", async () => {
    const test = harness()
    test.setProviderState("unknown")
    const requested = await requestSocialMessage(test.input(), test.overrides)

    await expect(
      approveAndSendSocialMessage(
        requested.proposal.id,
        requested.approvalReceiptId,
        test.overrides,
      ),
    ).rejects.toThrow(/REQUIRES_RECONCILIATION/)
    expect(test.sendCalls).toBe(1)

    test.setProviderState("delivered")
    const reconciled = await reconcileSocialMessage(
      requested.proposal.id,
      test.overrides,
    )
    expect(reconciled.status).toBe("delivered")
    expect(test.sendCalls).toBe(1)
  })

  it("fails closed for a different authenticated user", async () => {
    const test = harness()
    const requested = await requestSocialMessage(test.input(), test.overrides)
    await expect(
      approveAndSendSocialMessage(
        requested.proposal.id,
        requested.approvalReceiptId,
        { ...test.overrides, identityVerifier: identity("user-2") },
      ),
    ).rejects.toThrow(/PROPOSAL_NOT_FOUND/)
    expect(test.sendCalls).toBe(0)
  })
})
