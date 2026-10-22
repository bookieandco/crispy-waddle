import { describe, expect, it } from "vitest"
import {
  createSupabaseActionApprovalReceiptStore,
  type SharedApprovalReceiptRpc,
  type SharedApprovalReceiptRpcName,
} from "./supabase-action-approval-receipt-store"

type Row = {
  id: string
  action_id: string
  user_id: string
  type: string
  fingerprint: string
  status: "pending" | "approved" | "consumed" | "expired"
  requested_at: string
  approved_at: string | null
  expires_at: string
  consumed_at: string | null
}

/** Models the conditional update of the SQL migration on one shared database.
 * The two clients are intentionally separate invokers sharing only rows. */
function durableFixture() {
  const rows = new Map<string, Row>()
  const calls: Array<{ name: SharedApprovalReceiptRpcName; params: Record<string, unknown>; caller: string }> = []
  let nextId = 1
  const rpcFor = (caller: string): SharedApprovalReceiptRpc => async (name, params) => {
    calls.push({ name, params, caller })
    const claimed = params.p_user_id as string
    if (claimed !== caller) return { data: null, error: { message: "session subject mismatch" } }

    if (name === "jhadina_action_create_approval_receipt") {
      const expires = params.p_expires_at as string
      if (Date.parse(expires) <= Date.now()) return { data: null, error: { message: "expired" } }
      const row: Row = {
        id: `receipt-${nextId++}`,
        action_id: params.p_action_id as string,
        user_id: claimed,
        type: params.p_type as string,
        fingerprint: params.p_fingerprint as string,
        status: "pending",
        requested_at: new Date().toISOString(),
        approved_at: null,
        expires_at: expires,
        consumed_at: null,
      }
      rows.set(row.id, row)
      return { data: { ...row }, error: null }
    }

    const row = rows.get(params.p_receipt_id as string)
    if (!row || row.user_id !== caller) {
      return name === "jhadina_action_consume_receipt"
        ? { data: false, error: null }
        : { data: null, error: { message: "not found" } }
    }
    if (name === "jhadina_action_approve_receipt") {
      if (row.status !== "pending" || Date.parse(row.expires_at) <= Date.now()) {
        return { data: null, error: { message: "cannot approve" } }
      }
      row.status = "approved"
      row.approved_at = new Date().toISOString()
      return { data: { ...row }, error: null }
    }
    if (
      row.status !== "approved" ||
      row.action_id !== params.p_action_id ||
      row.type !== params.p_type ||
      row.fingerprint !== params.p_fingerprint ||
      Date.parse(row.expires_at) <= Date.now()
    ) return { data: false, error: null }

    // Atomic compare-and-set, analogous to the SQL UPDATE ... WHERE
    // status='approved' AND fingerprint=... AND expires_at>now().
    row.status = "consumed"
    row.consumed_at = new Date().toISOString()
    return { data: true, error: null }
  }
  return { rpcFor, calls }
}

const approval = {
  actionId: "growth-approve-123",
  userId: "session-owner",
  type: "growth.draft.approve",
  fingerprint: "growth-draft-approve:123",
  expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
}

describe("shared Supabase approval receipt adapter", () => {
  it("creates, approves and atomically consumes across separate client instances", async () => {
    const fixture = durableFixture()
    const creator = createSupabaseActionApprovalReceiptStore(fixture.rpcFor("session-owner"))
    const executor = createSupabaseActionApprovalReceiptStore(fixture.rpcFor("session-owner"))
    const receipt = await creator.createPending(approval)
    expect(receipt.status).toBe("pending")
    const approved = await creator.approve(receipt.id, approval.userId)
    expect(approved.status).toBe("approved")
    expect(await executor.consume(receipt.id, {
      actionId: approval.actionId,
      userId: approval.userId,
      type: approval.type,
      fingerprint: approval.fingerprint,
    })).toBe(true)
    expect(await creator.consume(receipt.id, {
      actionId: approval.actionId,
      userId: approval.userId,
      type: approval.type,
      fingerprint: approval.fingerprint,
    })).toBe(false)
    expect(fixture.calls.map((c) => c.name)).toEqual([
      "jhadina_action_create_approval_receipt",
      "jhadina_action_approve_receipt",
      "jhadina_action_consume_receipt",
      "jhadina_action_consume_receipt",
    ])
  })

  it("rejects user substitution and different session ownership", async () => {
    const fixture = durableFixture()
    const owner = createSupabaseActionApprovalReceiptStore(fixture.rpcFor("session-owner"))
    const stranger = createSupabaseActionApprovalReceiptStore(fixture.rpcFor("session-stranger"))
    const receipt = await owner.createPending(approval)
    await expect(stranger.approve(receipt.id, approval.userId)).rejects.toThrow("session subject mismatch")
    await expect(stranger.approve(receipt.id, "session-stranger")).rejects.toThrow("not found")
    await owner.approve(receipt.id, approval.userId)
    expect(await stranger.consume(receipt.id, {
      actionId: approval.actionId,
      userId: "session-stranger",
      type: approval.type,
      fingerprint: approval.fingerprint,
    })).toBe(false)
  })

  it("refuses any action, type, user or fingerprint substitution", async () => {
    const fixture = durableFixture()
    const store = createSupabaseActionApprovalReceiptStore(fixture.rpcFor("session-owner"))
    const receipt = await store.createPending(approval)
    await store.approve(receipt.id, approval.userId)
    const expected = {
      actionId: approval.actionId, userId: approval.userId,
      type: approval.type, fingerprint: approval.fingerprint,
    }
    for (const variant of [
      { ...expected, actionId: "other" },
      { ...expected, type: "money.transfer" },
      { ...expected, fingerprint: "other-payload" },
    ]) expect(await store.consume(receipt.id, variant)).toBe(false)
    expect(await store.consume(receipt.id, expected)).toBe(true)
  })

  it("permits exactly one consumption with competing instances", async () => {
    const fixture = durableFixture()
    const a = createSupabaseActionApprovalReceiptStore(fixture.rpcFor("session-owner"))
    const b = createSupabaseActionApprovalReceiptStore(fixture.rpcFor("session-owner"))
    const receipt = await a.createPending(approval)
    await b.approve(receipt.id, approval.userId)
    const expected = {
      actionId: approval.actionId, userId: approval.userId,
      type: approval.type, fingerprint: approval.fingerprint,
    }
    const outcomes = await Promise.all(Array.from({ length: 12 }, (_, i) =>
      (i % 2 ? a : b).consume(receipt.id, expected)))
    expect(outcomes.filter(Boolean)).toHaveLength(1)
  })

  it("fails closed on malformed RPC results, missing migration or database errors", async () => {
    const badReceipt: SharedApprovalReceiptRpc = async () => ({ data: { id: "only-id" }, error: null })
    await expect(createSupabaseActionApprovalReceiptStore(badReceipt).createPending(approval))
      .rejects.toThrow("ACTION_APPROVAL_RPC_RECEIPT_INVALID")
    const missingRpc: SharedApprovalReceiptRpc = async () => ({ data: null, error: { message: "function not found" } })
    await expect(createSupabaseActionApprovalReceiptStore(missingRpc).createPending(approval))
      .rejects.toThrow("ACTION_APPROVAL_CREATE_FAILED")
    const invalidConsume: SharedApprovalReceiptRpc = async () => ({ data: "true", error: null })
    await expect(createSupabaseActionApprovalReceiptStore(invalidConsume).consume("r", {
      actionId: "a", userId: "u", type: "t", fingerprint: "f",
    })).rejects.toThrow("ACTION_APPROVAL_CONSUME_RESULT_INVALID")
  })

  it("keeps a pending receipt blocked until explicit approval occurs", async () => {
    const fixture = durableFixture()
    const store = createSupabaseActionApprovalReceiptStore(fixture.rpcFor("session-owner"))
    const receipt = await store.createPending(approval)
    const expected = {
      actionId: approval.actionId, userId: approval.userId,
      type: approval.type, fingerprint: approval.fingerprint,
    }
    expect(await store.consume(receipt.id, expected)).toBe(false)
    await store.approve(receipt.id, approval.userId)
    expect(await store.consume(receipt.id, expected)).toBe(true)
  })
})
