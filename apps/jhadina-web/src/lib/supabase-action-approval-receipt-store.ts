import type { ApprovalReceipt, ApprovalReceiptStore } from "@jhadina/action-core"
import { createClient } from "./supabase/server"

/**
 * Shared Growth/Intelligence receipt adapter. This is NOT a replacement for
 * the domain-specific Money, Commerce, or Social approval stores.
 *
 * All writes are performed by session-scoped Postgres RPCs. The database
 * checks auth.uid() and atomically performs pending→approved→consumed.
 * No service-role credential or direct table mutation is used.
 */
export type SharedApprovalReceiptRpcName =
  | "jhadina_action_create_approval_receipt"
  | "jhadina_action_approve_receipt"
  | "jhadina_action_consume_receipt"

export type SharedApprovalReceiptRpc = (
  name: SharedApprovalReceiptRpcName,
  params: Record<string, unknown>,
) => Promise<{ data: unknown; error: { message: string } | null }>

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

function parseReceipt(value: unknown): ApprovalReceipt {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("ACTION_APPROVAL_RPC_RECEIPT_INVALID")
  }
  const row = value as Record<string, unknown>
  const required = ["id", "action_id", "user_id", "type", "fingerprint", "requested_at", "expires_at"] as const
  if (required.some((field) => typeof row[field] !== "string" || !(row[field] as string).length)) {
    throw new Error("ACTION_APPROVAL_RPC_RECEIPT_INVALID")
  }
  if (!["pending", "approved", "consumed", "expired"].includes(String(row.status))) {
    throw new Error("ACTION_APPROVAL_RPC_RECEIPT_INVALID")
  }
  if (!Number.isFinite(Date.parse(String(row.expires_at)))) {
    throw new Error("ACTION_APPROVAL_RPC_RECEIPT_INVALID")
  }
  const receipt = row as unknown as ReceiptRow
  return {
    id: receipt.id,
    actionId: receipt.action_id,
    userId: receipt.user_id,
    type: receipt.type,
    fingerprint: receipt.fingerprint,
    status: receipt.status,
    requestedAt: receipt.requested_at,
    approvedAt: receipt.approved_at ?? undefined,
    expiresAt: receipt.expires_at,
    consumedAt: receipt.consumed_at ?? undefined,
  }
}

async function sessionRpc(
  name: SharedApprovalReceiptRpcName,
  params: Record<string, unknown>,
): ReturnType<SharedApprovalReceiptRpc> {
  const supabase = await createClient()
  if (name === "jhadina_action_consume_receipt") {
    const { data, error } = await supabase.rpc(name, params)
    return { data, error }
  }
  // A composite Postgres return is a row array by default; select exactly
  // one returned receipt to match the shared ApprovalReceiptStore interface.
  const { data, error } = await supabase.rpc(name, params).single<ReceiptRow>()
  return { data, error }
}

export function createSupabaseActionApprovalReceiptStore(
  rpc: SharedApprovalReceiptRpc = sessionRpc,
): ApprovalReceiptStore {
  return {
    async createPending(input) {
      const { data, error } = await rpc("jhadina_action_create_approval_receipt", {
        p_action_id: input.actionId,
        p_user_id: input.userId,
        p_type: input.type,
        p_fingerprint: input.fingerprint,
        p_expires_at: input.expiresAt,
      })
      if (error) throw new Error(`ACTION_APPROVAL_CREATE_FAILED:${error.message}`)
      const receipt = parseReceipt(data)
      if (
        receipt.userId !== input.userId ||
        receipt.actionId !== input.actionId ||
        receipt.type !== input.type ||
        receipt.fingerprint !== input.fingerprint ||
        receipt.status !== "pending"
      ) throw new Error("ACTION_APPROVAL_CREATE_BINDING_MISMATCH")
      return receipt
    },

    async approve(receiptId, userId) {
      const { data, error } = await rpc("jhadina_action_approve_receipt", {
        p_receipt_id: receiptId,
        p_user_id: userId,
      })
      if (error) throw new Error(`ACTION_APPROVAL_APPROVE_FAILED:${error.message}`)
      const receipt = parseReceipt(data)
      if (receipt.id !== receiptId || receipt.userId !== userId || receipt.status !== "approved") {
        throw new Error("ACTION_APPROVAL_APPROVE_BINDING_MISMATCH")
      }
      return receipt
    },

    async consume(receiptId, expected) {
      const { data, error } = await rpc("jhadina_action_consume_receipt", {
        p_receipt_id: receiptId,
        p_action_id: expected.actionId,
        p_user_id: expected.userId,
        p_type: expected.type,
        p_fingerprint: expected.fingerprint,
      })
      if (error) throw new Error(`ACTION_APPROVAL_CONSUME_FAILED:${error.message}`)
      if (typeof data !== "boolean") throw new Error("ACTION_APPROVAL_CONSUME_RESULT_INVALID")
      return data
    },
  }
}
