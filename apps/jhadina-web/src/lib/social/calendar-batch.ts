import {
  assertSocialCalendarBatchCurrent,
  buildSocialCalendarBatch,
  type SocialCalendarBatch,
  type SocialPublicationProposal,
} from "@jhadina/social-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import {
  approveAndPublishSocialProposal,
  type SocialPublicationRuntimeOverrides,
} from "./governed-publication"
import { createSocialRepository, type SocialRepository } from "./repository"

export interface SocialCalendarBatchApprovalInput {
  batchId: string
  proposalIds: readonly string[]
}

export interface SocialCalendarBatchOutcome {
  proposalId: string
  status: "completed" | "failed"
  proposal?: SocialPublicationProposal
  error?: string
}

export interface SocialCalendarBatchApprovalResult {
  batch: SocialCalendarBatch
  status: "completed" | "partial" | "failed"
  outcomes: readonly SocialCalendarBatchOutcome[]
  verifiedUserId: string
}

export interface SocialCalendarBatchRuntimeOverrides extends SocialPublicationRuntimeOverrides {
  identityVerifier?: JhadinaIdentityVerifier
  repository?: SocialRepository
}

export async function approveSocialCalendarBatch(
  input: SocialCalendarBatchApprovalInput,
  overrides: SocialCalendarBatchRuntimeOverrides = {},
): Promise<SocialCalendarBatchApprovalResult> {
  if (!input.batchId.trim()) throw new Error("SOCIAL_CALENDAR_BATCH_ID_REQUIRED")
  if (!input.proposalIds.length) throw new Error("SOCIAL_CALENDAR_BATCH_EMPTY")
  if (new Set(input.proposalIds).size !== input.proposalIds.length) {
    throw new Error("SOCIAL_CALENDAR_DUPLICATE_PROPOSAL")
  }

  const identityVerifier = overrides.identityVerifier ?? await createRequestIdentityVerifier()
  const repository = overrides.repository ?? createSocialRepository()
  const identity = await identityVerifier.verify({})

  const proposals = await Promise.all(
    input.proposalIds.map((proposalId) => repository.getProposal(identity.userId, proposalId)),
  )
  const batch = buildSocialCalendarBatch(input.batchId, proposals)

  const current = await Promise.all(
    batch.entries.map((entry) => repository.getProposal(identity.userId, entry.proposalId)),
  )
  assertSocialCalendarBatchCurrent(batch, current)

  const outcomes: SocialCalendarBatchOutcome[] = []
  for (const entry of batch.entries) {
    try {
      const approved = await approveAndPublishSocialProposal(
        entry.proposalId,
        entry.approvalReceiptId,
        {
          ...overrides,
          identityVerifier,
          repository,
        },
      )
      outcomes.push({
        proposalId: entry.proposalId,
        status: "completed",
        proposal: approved.proposal,
      })
    } catch (error) {
      outcomes.push({
        proposalId: entry.proposalId,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  const completed = outcomes.filter((outcome) => outcome.status === "completed").length
  const status: SocialCalendarBatchApprovalResult["status"] =
    completed === outcomes.length ? "completed"
      : completed === 0 ? "failed"
      : "partial"

  return {
    batch,
    status,
    outcomes: Object.freeze(outcomes),
    verifiedUserId: identity.userId,
  }
}
