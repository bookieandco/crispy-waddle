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
  PUBLIC_PUBLISH_CAPABILITY,
  fingerprintSocialPublication,
  fingerprintSocialPublishAction,
  publicationActionFromProposal,
  type JhadinaBrand,
  type SocialOutboxJob,
  type SocialProvider,
  type SocialPublicationProposal,
  type SocialPublishAction,
} from "@jhadina/social-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createSocialAuditLedger } from "./durable-audit-ledger"
import { createSocialProviderForUser } from "./hootsuite-runtime"
import { createSocialRepository, type SocialRepository } from "./repository"
import { createSupabaseSocialApprovalReceiptStore } from "./supabase-approval-receipt-store"

export interface CreateSocialPublicationInput {
  brand: JhadinaBrand
  text: string
  mediaUrls?: string[]
  scheduledAt?: string
  targetAccountIds: string[]
  idempotencyKey?: string
}

export interface RequestedSocialPublication {
  proposal: SocialPublicationProposal
  approvalReceiptId: string
  verifiedUserId: string
}

export interface ApprovedSocialPublication {
  proposal: SocialPublicationProposal
  verifiedUserId: string
  approvalReceiptId: string
}

type SocialProviderFactory = (userId: string, provider: string) => SocialProvider

export interface SocialPublicationRuntimeOverrides {
  identityVerifier?: JhadinaIdentityVerifier
  ledger?: ActionLedger
  approvalStore?: ApprovalReceiptStore
  repository?: SocialRepository
  policy?: ActionPolicy<SocialPublishAction>
  providerFactory?: SocialProviderFactory
}

function buildActionRequest(proposal: SocialPublicationProposal): ActionRequest<SocialPublishAction> {
  return {
    id: proposal.actionId,
    userId: proposal.userId,
    type: PUBLIC_PUBLISH_CAPABILITY,
    action: publicationActionFromProposal(proposal),
    requestedAt: proposal.createdAt,
  }
}

async function runtime(overrides: SocialPublicationRuntimeOverrides) {
  return {
    identityVerifier: overrides.identityVerifier ?? await createRequestIdentityVerifier(),
    ledger: overrides.ledger ?? await createSocialAuditLedger(),
    approvalStore: overrides.approvalStore ?? createSupabaseSocialApprovalReceiptStore(),
    repository: overrides.repository ?? createSocialRepository(),
    policy: overrides.policy ?? createBaseSecurityCoreActionPolicy<SocialPublishAction>("social"),
    providerFactory: overrides.providerFactory ?? createSocialProviderForUser,
  }
}

export async function requestSocialPublication(
  input: CreateSocialPublicationInput,
  overrides: SocialPublicationRuntimeOverrides = {},
): Promise<RequestedSocialPublication> {
  const deps = await runtime(overrides)
  const identity = await deps.identityVerifier.verify({})
  const cleanText = input.text.trim()
  if (!cleanText) throw new Error("SOCIAL_TEXT_REQUIRED")
  if (!input.targetAccountIds.length) throw new Error("SOCIAL_TARGETS_REQUIRED")

  const targets = await deps.repository.resolveTargets(identity.userId, input.brand, input.targetAccountIds)
  const requestFingerprint = fingerprintSocialPublication({
    brand: input.brand,
    text: cleanText,
    mediaUrls: input.mediaUrls ?? [],
    scheduledAt: input.scheduledAt,
    targets,
  })

  const proposal = await deps.repository.createProposal({
    userId: identity.userId,
    actionId: `social-public-publish:${crypto.randomUUID()}`,
    brand: input.brand,
    text: cleanText,
    mediaUrls: input.mediaUrls ?? [],
    scheduledAt: input.scheduledAt,
    targetAccountIds: input.targetAccountIds,
    requestFingerprint,
    idempotencyKey: input.idempotencyKey?.trim() || crypto.randomUUID(),
  })

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
    type: PUBLIC_PUBLISH_CAPABILITY,
    status: decision === "deny" ? "denied" : "started",
    timestamp: new Date().toISOString(),
    metadata: { decision },
  })

  if (decision === "deny") throw new Error("SOCIAL_PUBLIC_PUBLISH_DENIED")
  if (decision !== "approval_required") {
    throw new Error("SOCIAL_PUBLIC_PUBLISH_MUST_REQUIRE_APPROVAL")
  }

  const approvalService = createApprovalRequestService(
    deps.approvalStore,
    (approvalRequest) => fingerprintSocialPublishAction(approvalRequest.action as SocialPublishAction),
  )
  const pending = await approvalService.requestApproval(request)
  const attached = await deps.repository.attachApprovalReceipt(identity.userId, proposal.id, pending.id)

  await deps.ledger.append({
    id: `${proposal.actionId}:approval-required`,
    actionId: proposal.actionId,
    userId: identity.userId,
    type: PUBLIC_PUBLISH_CAPABILITY,
    status: "approval_required",
    timestamp: new Date().toISOString(),
    metadata: { approvalReceiptId: pending.id },
  })

  return {
    proposal: attached,
    approvalReceiptId: pending.id,
    verifiedUserId: identity.userId,
  }
}

async function dispatchJob(
  repository: SocialRepository,
  providerFactory: SocialProviderFactory,
  job: SocialOutboxJob,
): Promise<"delivered" | "failed" | "ambiguous" | "skipped"> {
  if (job.status === "delivered" || job.status === "cancelled") return "skipped"
  if (job.status === "ambiguous") return "ambiguous"

  let provider: SocialProvider
  try {
    provider = providerFactory(job.userId, job.target.provider)
  } catch (error) {
    await repository.failOutbox(
      job.userId,
      job.id,
      error instanceof Error ? error.message : String(error),
      false,
    )
    return "failed"
  }

  let attempting: SocialOutboxJob
  try {
    attempting = await repository.beginOutboxAttempt(job.userId, job.id)
  } catch {
    return "skipped"
  }

  try {
    const receipts = await provider.publish({
      text: attempting.text,
      mediaUrls: attempting.mediaUrls,
      scheduledAt: attempting.scheduledAt,
      targets: [attempting.target],
      idempotencyKey: attempting.idempotencyKey,
    })
    if (receipts.length !== 1 || receipts[0].providerProfileId !== attempting.target.providerProfileId) {
      await repository.failOutbox(attempting.userId, attempting.id, "SOCIAL_PROVIDER_RECEIPT_AMBIGUOUS", true)
      return "ambiguous"
    }

    const receipt = receipts[0]
    if (receipt.state === "unknown") {
      await repository.failOutbox(attempting.userId, attempting.id, "SOCIAL_PROVIDER_STATE_UNKNOWN", true)
      return "ambiguous"
    }
    if (receipt.state === "failed") {
      await repository.failOutbox(attempting.userId, attempting.id, "SOCIAL_PROVIDER_REPORTED_FAILED", false)
      return "failed"
    }

    await repository.completeOutbox(attempting.userId, attempting.id, receipt.providerPostId)
    try {
      await repository.recordObservation({
        userId: attempting.userId,
        proposalId: attempting.proposalId,
        outboxId: attempting.id,
        observation: {
          kind: "delivery",
          source: `provider:${receipt.provider}`,
          provider: receipt.provider,
          platform: receipt.platform,
          accountId: attempting.target.accountId,
          providerProfileId: receipt.providerProfileId,
          contentId: receipt.providerPostId,
          observedAt: receipt.observedAt,
          evidence: [`providerPostId:${receipt.providerPostId}`, `state:${receipt.state}`],
          attributes: { state: receipt.state },
        },
      })
    } catch {
      // The provider receipt is already durably recorded on the outbox row.
      // Observation projection failure must not misreport a successful side effect.
    }
    return "delivered"
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await repository.failOutbox(attempting.userId, attempting.id, message, true)
    return "ambiguous"
  }
}

export async function approveAndPublishSocialProposal(
  proposalId: string,
  approvalReceiptId: string,
  overrides: SocialPublicationRuntimeOverrides = {},
): Promise<ApprovedSocialPublication> {
  const deps = await runtime(overrides)
  const identity = await deps.identityVerifier.verify({})
  const proposal = await deps.repository.getProposal(identity.userId, proposalId)

  if (!proposal.approvalReceiptId || proposal.approvalReceiptId !== approvalReceiptId) {
    throw new Error("SOCIAL_APPROVAL_RECEIPT_MISMATCH")
  }
  if (proposal.status !== "pending_approval") throw new Error("SOCIAL_PROPOSAL_NOT_AWAITING_APPROVAL")

  await deps.approvalStore.approve(approvalReceiptId, identity.userId)

  const approvalVerifier = createApprovalReceiptVerifier(
    deps.approvalStore,
    (approvalRequest) => fingerprintSocialPublishAction(approvalRequest.action as SocialPublishAction),
  )

  const handler: ActionHandler<SocialPublishAction, SocialPublicationProposal> = {
    supports: (type) => type === PUBLIC_PUBLISH_CAPABILITY,
    async execute(action, request) {
      const current = await deps.repository.getProposal(request.userId, action.proposalId)
      if (current.actionId !== request.id || current.requestFingerprint !== action.requestFingerprint) {
        throw new Error("SOCIAL_PROPOSAL_MUTATED_AFTER_APPROVAL")
      }

      const jobs = await deps.repository.enqueueOutbox(request.userId, current.id)
      const outcomes = []
      for (const job of jobs) {
        outcomes.push(await dispatchJob(deps.repository, deps.providerFactory, job))
      }

      if (outcomes.some((outcome) => outcome === "ambiguous")) {
        throw new Error("SOCIAL_DISPATCH_REQUIRES_RECONCILIATION")
      }
      if (outcomes.some((outcome) => outcome === "failed")) {
        throw new Error("SOCIAL_DISPATCH_FAILED")
      }
      return deps.repository.getProposal(request.userId, current.id)
    },
  }

  const executor = new ActionExecutor<SocialPublishAction, SocialPublicationProposal>(
    deps.policy,
    deps.ledger,
    [handler],
    approvalVerifier,
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

export async function reconcileSocialProposal(
  proposalId: string,
  overrides: SocialPublicationRuntimeOverrides = {},
): Promise<SocialPublicationProposal> {
  const deps = await runtime(overrides)
  const identity = await deps.identityVerifier.verify({})
  const proposal = await deps.repository.getProposal(identity.userId, proposalId)
  const jobs = await deps.repository.listOutbox(identity.userId, proposal.id)

  const byProvider = new Map<string, SocialOutboxJob[]>()
  for (const job of jobs) {
    if (!job.providerPostId) continue
    const list = byProvider.get(job.target.provider) ?? []
    list.push(job)
    byProvider.set(job.target.provider, list)
  }

  for (const [providerName, providerJobs] of byProvider) {
    const provider = deps.providerFactory(identity.userId, providerName)
    const deliveries = await provider.listDeliveries({ since: proposal.createdAt })
    for (const job of providerJobs) {
      const delivery = deliveries.find((item) => item.providerPostId === job.providerPostId)
      if (!delivery) continue
      if (delivery.state === "failed") {
        await deps.repository.failOutbox(identity.userId, job.id, "SOCIAL_PROVIDER_RECONCILED_FAILED", false)
      } else if (delivery.state === "scheduled" || delivery.state === "published") {
        await deps.repository.completeOutbox(identity.userId, job.id, delivery.providerPostId)
      }
    }
  }

  return deps.repository.getProposal(identity.userId, proposal.id)
}
