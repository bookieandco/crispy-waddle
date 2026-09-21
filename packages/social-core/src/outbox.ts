import type {
  SocialOutboxJob,
  SocialPublicationProposal,
  SocialProviderDeliveryReceipt,
} from "./types.js";
import { assertExplicitPublishTargets } from "./publication.js";

export function createOutboxJobs(
  proposal: SocialPublicationProposal,
  now = new Date().toISOString(),
): SocialOutboxJob[] {
  assertExplicitPublishTargets(proposal.brand, proposal.targets);

  return proposal.targets.map((target) => ({
    id: `social-outbox:${proposal.id}:${target.accountId}`,
    proposalId: proposal.id,
    userId: proposal.userId,
    actionId: proposal.actionId,
    target,
    text: proposal.text,
    mediaUrls: [...proposal.mediaUrls],
    scheduledAt: proposal.scheduledAt,
    status: "pending",
    idempotencyKey: `${proposal.id}:${target.accountId}`,
    attemptCount: 0,
    createdAt: now,
    updatedAt: now,
  }));
}

export function beginOutboxAttempt(
  job: SocialOutboxJob,
  now = new Date().toISOString(),
): SocialOutboxJob {
  if (job.status === "delivered" || job.status === "cancelled") {
    throw new Error("SOCIAL_OUTBOX_TERMINAL");
  }
  if (job.status === "ambiguous") throw new Error("SOCIAL_OUTBOX_RECONCILIATION_REQUIRED");
  return {
    ...job,
    status: "attempting",
    attemptCount: job.attemptCount + 1,
    lastError: undefined,
    updatedAt: now,
  };
}

export function deliverOutboxJob(
  job: SocialOutboxJob,
  receipt: SocialProviderDeliveryReceipt,
  now = new Date().toISOString(),
): SocialOutboxJob {
  if (
    receipt.provider !== job.target.provider ||
    receipt.providerProfileId !== job.target.providerProfileId ||
    receipt.platform !== job.target.platform
  ) {
    throw new Error("SOCIAL_PROVIDER_RECEIPT_TARGET_MISMATCH");
  }

  return {
    ...job,
    status: receipt.state === "failed" ? "failed" : "delivered",
    providerPostId: receipt.providerPostId,
    lastError: receipt.state === "failed" ? "provider_reported_failed" : undefined,
    updatedAt: now,
  };
}

export function failOutboxJob(
  job: SocialOutboxJob,
  error: string,
  ambiguous = false,
  now = new Date().toISOString(),
): SocialOutboxJob {
  return {
    ...job,
    status: ambiguous ? "ambiguous" : "failed",
    lastError: error,
    updatedAt: now,
  };
}
