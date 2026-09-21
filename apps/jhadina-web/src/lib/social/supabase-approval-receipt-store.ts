import type { ApprovalReceipt, ApprovalReceiptStore } from "@jhadina/action-core"
import { createClient } from "../supabase/server"

type ReceiptRow = {
  id: string
  action_id: string
  user_id: string
  type: string
  fingerprint: string
  status: ApprovalReceipt["status"]
  requested_at: string
  approved_at: string | null
  expires_at: string
  consumed_at: string | null
}

function toReceipt(row: ReceiptRow): ApprovalReceipt {
  return {
    id: row.id,
    actionId: row.action_id,
    userId: row.user_id,
    type: row.type,
    fingerprint: row.fingerprint,
    status: row.status,
    requestedAt: row.requested_at,
    approvedAt: row.approved_at ?? undefined,
    expiresAt: row.expires_at,
    consumedAt: row.consumed_at ?? undefined,
  }
}

export function createSupabaseSocialApprovalReceiptStore(): ApprovalReceiptStore {
  return {
    async createPending(input) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_create_approval_receipt", {
          p_action_id: input.actionId,
          p_type: input.type,
          p_fingerprint: input.fingerprint,
          p_expires_at: input.expiresAt,
        })
        .single<ReceiptRow>()

      if (error || !data) {
        throw new Error(`Unable to create social approval receipt: ${error?.message ?? "no receipt returned"}`)
      }
      return toReceipt(data)
    },

    async approve(receiptId, userId) {
      void userId
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_social_approve_receipt", { p_receipt_id: receiptId })
        .single<ReceiptRow>()

      if (error || !data) {
        throw new Error(`Social approval receipt cannot be approved: ${error?.message ?? "receipt unavailable"}`)
      }
      return toReceipt(data)
    },

    async consume(receiptId, expected) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_social_consume_approval_receipt", {
        p_receipt_id: receiptId,
        p_action_id: expected.actionId,
        p_type: expected.type,
        p_fingerprint: expected.fingerprint,
      })
      if (error) throw new Error(`Unable to consume social approval receipt: ${error.message}`)
      return data === true
    },
  }
}
