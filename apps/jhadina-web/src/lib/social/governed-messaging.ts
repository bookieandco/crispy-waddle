import {
  ActionExecutor,
  createApprovalReceiptVerifier,
  createApprovalRequestService,
  createBaseSecurityCoreActionPolicy,
  type ActionHandler,
  type ActionLedger,
  type ActionPolicy,
  type ActionRequest,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import {
  DIRECT_MESSAGE_CAPABILITY,
  assertSendableMessageEligibility,
  fingerprintSocialMessage,
  fingerprintSocialMessageAction,
  messageActionFromProposal,
  type JhadinaBrand,
  type SocialMessageAction,
  type SocialMessageEligibility,
  type SocialMessageProvider,
  type SocialMessageProposal,
  type SocialMessageRecipient,
  type SocialProviderMessageReceipt,
} from "@jhadina/social-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createSocialAuditLedger } from "./durable-audit-ledger"
import {
  createSocialMessageRepository,
  type SocialMessageRepository,
} from "./message-repository"
import { createSupabaseSocialApprovalReceiptStore } from "./supabase-approval-receipt-store"

export interface CreateSocialMessageInput {
  brand: JhadinaBrand
  senderAccountId: string
  recipient: SocialMessageRecipient
  text: string
  conversationRef?: string
  offerRef?: string
  outreachPlanRef?: string
  touchId?: string
  brandVoiceProfileRef: string
  channelVoiceProfileRef: string
  eligibility: SocialMessageEligibility
  idempotencyKey?: string
}

export interface RequestedSocialMessage {
  proposal: SocialMessageProposal
  approvalReceiptId: string
  verifiedUserId: string
}

export interface SentSocialMessage {
  proposal: SocialMessageProposal
  verifiedUserId: string
  approvalReceiptId: string
}

type SocialMessageProviderFactory = (
  userId: string,
  provider: string,
) => SocialMessageProvider

export interface SocialMessageRuntimeOverrides {
  identityVerifier?: JhadinaIdentityVerifier
  ledger?: ActionLedger
  approvalStore?: ApprovalReceiptStore
  repository?: SocialMessageRepository
  policy?: ActionPolicy<SocialMessageAction>
  providerFactory?: SocialMessageProviderFactory
}

function buildActionRequest(
  proposal: SocialMessageProposal,
): ActionRequest<SocialMessageAction> {
  return {
    id: proposal.actionId,
    userId: proposal.userId,
    type: DIRECT_MESSAGE_CAPABILITY,
    action: messageActionFromProposal(proposal),
    requestedAt: proposal.createdAt,
  }
}

function unconfiguredProviderFactory(): SocialMessageProvider {
  throw new Error("SOCIAL_MESSAGE_PROVIDER_NOT_CONFIGURED")
}

async function runtime(overrides: SocialMessageRuntimeOverrides) {
  return {
    identityVerifier:
      overrides.identityVerifier ?? (await createRequestIdentityVerifier()),
    ledger: overrides.ledger ?? (await createSocialAuditLedger()),
    approvalStore:
      overrides.approvalStore ?? createSupabaseSocialApprovalReceiptStore(),
    repository: overrides.repository ?? createSocialMessageRepository(),
    policy:
      overrides.policy ??
      createBaseSecurityCoreActionPolicy<SocialMessageAction>("social"),
    providerFactory: overrides.providerFactory ?? unconfiguredProviderFactory,
  }
}

function evidenceContains(
  current: readonly string[],
  required: readonly string[],
): boolean {
  const set = new Set(current)
  return required.every((item) => set.has(item))
}

async function assertFreshStoredEligibility(
  repository: SocialMessageRepository,
  proposal: Pick<
    SocialMessageProposal,
    | "userId"
    | "provider"
    | "platform"
    | "recipientRef"
    | "providerRecipientId"
    | "eligibilityEvidenceRefs"
    | "eligibilityObservedAt"
  >,
): Promise<void> {
  const contact = await repository.getContactState({
    userId: proposal.userId,
    provider: proposal.provider,
    providerRecipientId: proposal.providerRecipientId,
  })
  if (
    !contact ||
    contact.recipientRef !== proposal.recipientRef ||
    contact.platform !== proposal.platform
  ) {
    throw new Error("SOCIAL_MESSAGE_CONTACT_STATE_MISMATCH")
  }

  assertSendableMessageEligibility({
    state: contact.state,
    evidenceRefs: contact.evidenceRefs,
    observedAt: contact.observedAt,
  })

  if (Date.parse(contact.observedAt) < Date.parse(proposal.eligibilityObservedAt)) {
    throw new Error("SOCIAL_MESSAGE_ELIGIBILITY_REGRESSED")
  }
  if (!evidenceContains(contact.evidenceRefs, proposal.eligibilityEvidenceRefs)) {
    throw new Error("SOCIAL_MESSAGE_ELIGIBILITY_EVIDENCE_MISMATCH")
  }
}

export async function requestSocialMessage(
  input: CreateSocialMessageInput,
  overrides: SocialMessageRuntimeOverrides = {},
): Promise<RequestedSocialMessage> {
  const deps = await runtime(overrides)
  const identity = await deps.identityVerifier.verify({})
  const cleanText = input.text.trim()
  if (!cleanText) throw new Error("SOCIAL_MESSAGE_TEXT_REQUIRED")

  assertSendableMessageEligibility(input.eligibility)

  const contact = await deps.repository.getContactState({
    userId: identity.userId,
    provider: input.recipient.provider,
    providerRecipientId: input.recipient.providerRecipientId,
  })
  if (
    !contact ||
    contact.recipientRef !== input.recipient.recipientRef ||
    contact.platform !== input.recipient.platform ||
    contact.state !== "eligible" ||
    contact.observedAt !== input.eligibility.observedAt ||
    !evidenceContains(contact.evidenceRefs, input.eligibility.evidenceRefs)
  ) {
    throw new Error("SOCIAL_MESSAGE_ELIGIBILITY_MISMATCH")
  }

  const requestFingerprint = fingerprintSocialMessage({
    brand: input.brand,
    senderAccountId: input.senderAccountId,
    recipient: input.recipient,
    text: cleanText,
    conversationRef: input.conversationRef,
    offerRef: input.offerRef,
    outreachPlanRef: input.outreachPlanRef,
    touchId: input.touchId,
    brandVoiceProfileRef: input.brandVoiceProfileRef,
    channelVoiceProfileRef: input.channelVoiceProfileRef,
    eligibility: input.eligibility,
  })

  const proposal = await deps.repository.createProposal({
    userId: identity.userId,
    actionId: `social-consequential-outreach:${crypto.randomUUID()}`,
    brand: input.brand,
    senderAccountId: input.senderAccountId,
    recipientRef: input.recipient.recipientRef,
    providerRecipientId: input.recipient.providerRecipientId,
    conversationRef: input.conversationRef,
    text: cleanText,
    offerRef: input.offerRef,
    outreachPlanRef: input.outreachPlanRef,
    touchId: input.touchId,
    brandVoiceProfileRef: input.brandVoiceProfileRef,
    channelVoiceProfileRef: input.channelVoiceProfileRef,
    eligibilityEvidenceRefs: input.eligibility.evidenceRefs,
    eligibilityObservedAt: input.eligibility.observedAt,
    requestFingerprint,
    idempotencyKey:
      input.idempotencyKey?.trim() ||
      (input.touchId?.trim()
        ? `social-outreach-touch:${input.touchId.trim()}`
        : crypto.randomUUID()),
  })

  if (
    proposal.provider !== input.recipient.provider ||
    proposal.platform !== input.recipient.platform
  ) {
    throw new Error("SOCIAL_MESSAGE_SENDER_RECIPIENT_PLATFORM_MISMATCH")
  }

  if (proposal.approvalReceiptId) {
    return {
      proposal,
      approvalReceiptId: proposal.approvalReceiptId,
      verifiedUserId: identity.userId,
    }
  }

  const request = buildActionRequest(proposal)
  const decision = await deps.policy.evaluate(request)
  await deps.ledger.append({
    id: `${proposal.actionId}:policy-evaluated`,
    actionId: proposal.actionId,
    userId: identity.userId,
    type: DIRECT_MESSAGE_CAPABILITY,
    status: decision === "deny" ? "denied" : "started",
    timestamp: new Date().toISOString(),
    metadata: {
      decision,
      recipientRef: proposal.recipientRef,
      touchId: proposal.touchId,
    },
  })

  if (decision === "deny") throw new Error("SOCIAL_MESSAGE_SEND_DENIED")
  if (decision !== "approval_required") {
    throw new Error("SOCIAL_MESSAGE_SEND_MUST_REQUIRE_APPROVAL")
  }

  const approvalService = createApprovalRequestService(
    deps.approvalStore,
    (approvalRequest) =>
      fingerprintSocialMessageAction(
        approvalRequest.action as SocialMessageAction,
      ),
  )
  const pending = await approvalService.requestApproval(request)
  const attached = await deps.repository.attachApprovalReceipt(
    identity.userId,
    proposal.id,
    pending.id,
  )

  await deps.ledger.append({
    id: `${proposal.actionId}:approval-required`,
    actionId: proposal.actionId,
    userId: identity.userId,
    type: DIRECT_MESSAGE_CAPABILITY,
    status: "approval_required",
    timestamp: new Date().toISOString(),
    metadata: {
      approvalReceiptId: pending.id,
      recipientRef: proposal.recipientRef,
      exactMessageFingerprint: proposal.requestFingerprint,
    },
  })

  return {
    proposal: attached,
    approvalReceiptId: pending.id,
    verifiedUserId: identity.userId,
  }
}

function assertReceiptMatchesProposal(
  receipt: SocialProviderMessageReceipt,
  proposal: SocialMessageProposal,
): void {
  if (
    receipt.provider !== proposal.provider ||
    receipt.platform !== proposal.platform ||
    receipt.senderProviderProfileId !== proposal.providerProfileId ||
    receipt.providerRecipientId !== proposal.providerRecipientId
  ) {
    throw new Error("SOCIAL_MESSAGE_PROVIDER_RECEIPT_TARGET_MISMATCH")
  }
}

async function persistReceipt(
  repository: SocialMessageRepository,
  proposal: SocialMessageProposal,
  outboxId: string,
  receipt: SocialProviderMessageReceipt,
): Promise<"delivered" | "failed" | "ambiguous"> {
  assertReceiptMatchesProposal(receipt, proposal)

  if (receipt.state === "unknown") {
    await repository.failOutbox(
      proposal.userId,
      outboxId,
      "SOCIAL_MESSAGE_PROVIDER_STATE_UNKNOWN",
      true,
      receipt.providerMessageId,
    )
    return "ambiguous"
  }
  if (receipt.state === "failed") {
    await repository.failOutbox(
      proposal.userId,
      outboxId,
      "SOCIAL_MESSAGE_PROVIDER_REPORTED_FAILED",
      false,
      receipt.providerMessageId,
    )
    return "failed"
  }

  await repository.completeOutbox(
    proposal.userId,
    outboxId,
    receipt.providerMessageId,
  )
  return "delivered"
}

async function dispatchMessage(
  repository: SocialMessageRepository,
  providerFactory: SocialMessageProviderFactory,
  proposal: SocialMessageProposal,
): Promise<"delivered" | "failed" | "ambiguous"> {
  const outbox = await repository.enqueueOutbox(proposal.userId, proposal.id)
  if (outbox.status === "delivered") return "delivered"
  if (outbox.status === "ambiguous") return "ambiguous"

  const provider = providerFactory(proposal.userId, proposal.provider)
  const attempting = await repository.beginOutboxAttempt(
    proposal.userId,
    outbox.id,
  )

  try {
    const existing = await provider.findMessageByIdempotencyKey(
      attempting.idempotencyKey,
    )
    if (existing) {
      return persistReceipt(repository, proposal, attempting.id, existing)
    }

    const receipt = await provider.sendMessage({
      senderProviderProfileId: proposal.providerProfileId,
      platform: proposal.platform,
      providerRecipientId: proposal.providerRecipientId,
      conversationRef: proposal.conversationRef,
      text: proposal.text,
      idempotencyKey: attempting.idempotencyKey,
    })
    return persistReceipt(repository, proposal, attempting.id, receipt)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await repository.failOutbox(
      proposal.userId,
      attempting.id,
      message,
      true,
    )
    return "ambiguous"
  }
}

export async function approveAndSendSocialMessage(
  proposalId: string,
  approvalReceiptId: string,
  overrides: SocialMessageRuntimeOverrides = {},
): Promise<SentSocialMessage> {
  const deps = await runtime(overrides)
  const identity = await deps.identityVerifier.verify({})
  const proposal = await deps.repository.getProposal(identity.userId, proposalId)

  if (
    !proposal.approvalReceiptId ||
    proposal.approvalReceiptId !== approvalReceiptId
  ) {
    throw new Error("SOCIAL_MESSAGE_APPROVAL_RECEIPT_MISMATCH")
  }
  if (proposal.status !== "pending_approval") {
    throw new Error("SOCIAL_MESSAGE_PROPOSAL_NOT_AWAITING_APPROVAL")
  }

  await assertFreshStoredEligibility(deps.repository, proposal)
  await deps.approvalStore.approve(approvalReceiptId, identity.userId)

  const verifier = createApprovalReceiptVerifier(
    deps.approvalStore,
    (approvalRequest) =>
      fingerprintSocialMessageAction(
        approvalRequest.action as SocialMessageAction,
      ),
  )

  const handler: ActionHandler<SocialMessageAction, SocialMessageProposal> = {
    supports: (type) => type === DIRECT_MESSAGE_CAPABILITY,
    async execute(action, request) {
      const current = await deps.repository.getProposal(
        request.userId,
        action.proposalId,
      )
      if (
        current.actionId !== request.id ||
        current.requestFingerprint !== action.requestFingerprint
      ) {
        throw new Error("SOCIAL_MESSAGE_PROPOSAL_MUTATED_AFTER_APPROVAL")
      }

      await assertFreshStoredEligibility(deps.repository, current)
      const outcome = await dispatchMessage(
        deps.repository,
        deps.providerFactory,
        current,
      )

      if (outcome === "ambiguous") {
        throw new Error("SOCIAL_MESSAGE_SEND_REQUIRES_RECONCILIATION")
      }
      if (outcome === "failed") throw new Error("SOCIAL_MESSAGE_SEND_FAILED")
      return deps.repository.getProposal(request.userId, current.id)
    },
  }

  const executor = new ActionExecutor<SocialMessageAction, SocialMessageProposal>(
    deps.policy,
    deps.ledger,
    [handler],
    verifier,
  )

  const result = await executor.execute({
    ...buildActionRequest(proposal),
    approvalReceiptId,
  })

  return {
    proposal: result,
    verifiedUserId: identity.userId,
    approvalReceiptId,
  }
}

export async function reconcileSocialMessage(
  proposalId: string,
  overrides: SocialMessageRuntimeOverrides = {},
): Promise<SocialMessageProposal> {
  const deps = await runtime(overrides)
  const identity = await deps.identityVerifier.verify({})
  const proposal = await deps.repository.getProposal(identity.userId, proposalId)
  const outbox = await deps.repository.getOutbox(identity.userId, proposal.id)
  if (!outbox || outbox.status === "delivered") return proposal

  const provider = deps.providerFactory(identity.userId, proposal.provider)
  const receipt = await provider.findMessageByIdempotencyKey(outbox.idempotencyKey)
  if (!receipt) return proposal

  await persistReceipt(deps.repository, proposal, outbox.id, receipt)
  return deps.repository.getProposal(identity.userId, proposal.id)
}
