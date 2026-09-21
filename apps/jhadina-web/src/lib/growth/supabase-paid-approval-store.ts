import type { ApprovalReceipt, ApprovalReceiptStore } from "@jhadina/action-core"
import type { GrowthProductionRepository } from "./production-repository"

function asReceipt(row: {
  id: string; action_id: string; user_id: string; type: string; fingerprint: string
  status: ApprovalReceipt["status"]; requested_at: string; approved_at: string | null
  expires_at: string; consumed_at: string | null
}): ApprovalReceipt {
  return {
    id: row.id, actionId: row.action_id, userId: row.user_id, type: row.type,
    fingerprint: row.fingerprint, status: row.status, requestedAt: row.requested_at,
    approvedAt: row.approved_at ?? undefined, expiresAt: row.expires_at,
    consumedAt: row.consumed_at ?? undefined,
  }
}

export function createGrowthPaidApprovalStore(repository: GrowthProductionRepository, campaignId: string): ApprovalReceiptStore {
  return {
    async createPending(input) {
      return asReceipt(await repository.requestApproval(campaignId, input.actionId, input.fingerprint, input.expiresAt))
    },
    async approve(receiptId, _userId) {
      return asReceipt(await repository.approveReceipt(receiptId))
    },
    consume(receiptId, expected) {
      return repository.consumeReceipt(receiptId, expected.actionId, expected.fingerprint)
    },
  }
}
