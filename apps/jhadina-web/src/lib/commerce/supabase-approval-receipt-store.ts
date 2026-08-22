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

/**
 * Request-scoped production ApprovalReceiptStore.
 *
 * All mutations are performed by database functions so approval/consume
 * transitions are atomic and tied to auth.uid(). This deliberately does not
 * expose an auto-approve operation.
 */
export function createSupabaseCommerceApprovalReceiptStore(): ApprovalReceiptStore {
  return {
    async createPending(input) {
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_commerce_create_approval_receipt", {
          p_action_id: input.actionId,
          p_type: input.type,
          p_fingerprint: input.fingerprint,
          p_expires_at: input.expiresAt,
        })
        .single<ReceiptRow>()

      if (error || !data) throw new Error(`Unable to create approval receipt: ${error?.message ?? "no receipt returned"}`)
      return toReceipt(data)
    },

    async approve(receiptId, userId) {
      // The caller's verified identity is carried into this API for parity
      // with ApprovalReceiptStore; the database independently binds approval
      // to auth.uid(), so a mismatched caller cannot approve another user's receipt.
      void userId
      const supabase = await createClient()
      const { data, error } = await supabase
        .rpc("jhadina_commerce_approve_receipt", { p_receipt_id: receiptId })
        .single<ReceiptRow>()

      if (error || !data) throw new Error(`Approval receipt cannot be approved: ${error?.message ?? "receipt unavailable"}`)
      return toReceipt(data)
    },

    async consume(receiptId, expected) {
      const supabase = await createClient()
      const { data, error } = await supabase.rpc("jhadina_commerce_consume_approval_receipt", {
        p_receipt_id: receiptId,
        p_action_id: expected.actionId,
        p_type: expected.type,
        p_fingerprint: expected.fingerprint,
      })

      if (error) throw new Error(`Unable to consume approval receipt: ${error.message}`)
      return data === true
    },
  }
}
