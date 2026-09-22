import { describe, expect, it } from "vitest"
import type { SocialPublicationProposal } from "@jhadina/social-core"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { approveSocialCalendarBatch } from "./calendar-batch"
import type { SocialRepository } from "./repository"

function identity(): JhadinaIdentityVerifier {
  return { verify: async () => ({ userId: "user-1", sessionId: "session-1" }) }
}

function proposal(id: string, scheduledAt: string): SocialPublicationProposal {
  return {
    id,
    userId: "user-1",
    actionId: `action-${id}`,
    brand: "jhadina",
    text: `Post ${id}`,
    mediaUrls: [],
    scheduledAt,
    targets: [{
      accountId: `account-${id}`,
      brand: "jhadina",
      provider: "hootsuite",
      providerProfileId: `profile-${id}`,
      platform: "linkedin",
    }],
    status: "pending_approval",
    requestFingerprint: `fingerprint-${id}`,
    idempotencyKey: `idem-${id}`,
    approvalReceiptId: `receipt-${id}`,
    createdAt: "2026-09-22T12:00:00.000Z",
    updatedAt: "2026-09-22T12:00:00.000Z",
  }
}

function repository(proposals: SocialPublicationProposal[]): SocialRepository {
  const byId = new Map(proposals.map((row) => [row.id, row] as const))
  return {
    getProposal: async (userId: string, proposalId: string) => {
      const row = byId.get(proposalId)
      if (!row || row.userId !== userId) throw new Error("SOCIAL_PROPOSAL_NOT_FOUND")
      return row
    },
  } as unknown as SocialRepository
}

describe("calendar batch approval", () => {
  it("preflights every exact proposal before executing the batch", async () => {
    const proposals = [
      proposal("a", "2099-09-23T12:00:00.000Z"),
      proposal("b", "2099-09-24T12:00:00.000Z"),
    ]
    const calls: string[] = []

    const result = await approveSocialCalendarBatch({
      batchId: "batch-1",
      proposalIds: ["b", "a"],
    }, {
      identityVerifier: identity(),
      repository: repository(proposals),
      approveProposal: async (proposalId, receiptId) => {
        calls.push(`${proposalId}:${receiptId}`)
        const current = proposals.find((row) => row.id === proposalId)!
        return {
          proposal: { ...current, status: "queued" },
          verifiedUserId: "user-1",
          approvalReceiptId: receiptId,
        }
      },
    })

    expect(result.status).toBe("completed")
    expect(result.batch.entries.map((entry) => entry.proposalId)).toEqual(["a", "b"])
    expect(calls).toEqual(["a:receipt-a", "b:receipt-b"])
  })

  it("reports partial completion instead of pretending provider side effects are atomic", async () => {
    const proposals = [
      proposal("a", "2099-09-23T12:00:00.000Z"),
      proposal("b", "2099-09-24T12:00:00.000Z"),
    ]

    const result = await approveSocialCalendarBatch({
      batchId: "batch-1",
      proposalIds: ["a", "b"],
    }, {
      identityVerifier: identity(),
      repository: repository(proposals),
      approveProposal: async (proposalId, receiptId) => {
        if (proposalId === "b") throw new Error("provider unavailable")
        const current = proposals.find((row) => row.id === proposalId)!
        return {
          proposal: { ...current, status: "queued" },
          verifiedUserId: "user-1",
          approvalReceiptId: receiptId,
        }
      },
    })

    expect(result.status).toBe("partial")
    expect(result.outcomes[0]).toMatchObject({ proposalId: "a", status: "completed" })
    expect(result.outcomes[1]).toMatchObject({
      proposalId: "b",
      status: "failed",
      error: "provider unavailable",
    })
  })

  it("does not execute any approval when preflight detects a changed proposal", async () => {
    const proposals = [
      proposal("a", "2099-09-23T12:00:00.000Z"),
      { ...proposal("b", "2099-09-24T12:00:00.000Z"), approvalReceiptId: undefined },
    ]
    let calls = 0

    await expect(approveSocialCalendarBatch({
      batchId: "batch-1",
      proposalIds: ["a", "b"],
    }, {
      identityVerifier: identity(),
      repository: repository(proposals),
      approveProposal: async () => {
        calls += 1
        throw new Error("should not run")
      },
    })).rejects.toThrow("SOCIAL_CALENDAR_APPROVAL_RECEIPT_REQUIRED")

    expect(calls).toBe(0)
  })
})
