import { describe, it, expect } from "vitest"
import { SupabaseAuditLedger, type AuditRpcClient } from "@jhadina/action-core"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createGrowthDraft, listGrowthDrafts } from "./engine"
import {
  runGovernedGrowthDraftApproval,
  listGovernedGrowthActivity,
  type GovernedGrowthRuntimeOverrides,
} from "./governed-approval-runtime"

/**
 * Jhadina OS Integration Phase 2 — Real Product Loop, durability
 * milestone.
 *
 * These tests exercise the real production composition root
 * (runGovernedGrowthDraftApproval / listGovernedGrowthActivity) against
 * a fake RPC client that models the actual Postgres migration's
 * behavior (sequential per-domain inserts, actor/domain-scoped reads)
 * closely enough to give genuine confidence — not just a client that
 * always returns success. createRequestIdentityVerifier() and the real
 * Supabase client have no meaning in a test process, so both are
 * overridden; production always uses the real ones.
 */
function staticIdentityVerifier(identity: ActionRequestIdentity): JhadinaIdentityVerifier {
  return {
    async verify(request: JhadinaActionRequest) {
      if (request.userId !== identity.userId) {
        throw new Error("Action identity mismatch")
      }
      return identity
    },
  }
}

type FakeRow = {
  domain: string
  sequence: number
  event_id: string
  request_id: string
  actor_id: string
  capability: string
  status: string
  occurred_at: string
  metadata: Record<string, unknown>
}

/** Models append_jhadina_audit_event / list_jhadina_audit_events closely enough to be a real integration double, not a stub that always succeeds. */
class FakeAuditRpcClient implements AuditRpcClient {
  private readonly rows: FakeRow[] = []
  private readonly sequenceByDomain = new Map<string, number>()

  async rpc<T = unknown>(fn: string, args: Record<string, unknown>) {
    if (fn === "append_jhadina_audit_event") {
      const domain = args.p_domain as string
      const sequence = (this.sequenceByDomain.get(domain) ?? 0) + 1
      this.sequenceByDomain.set(domain, sequence)
      this.rows.push({
        domain,
        sequence,
        event_id: args.p_event_id as string,
        request_id: args.p_request_id as string,
        actor_id: args.p_actor_id as string,
        capability: args.p_capability as string,
        status: args.p_status as string,
        occurred_at: args.p_occurred_at as string,
        metadata: (args.p_metadata as Record<string, unknown>) ?? {},
      })
      return { data: null as T | null, error: null }
    }
    if (fn === "list_jhadina_audit_events") {
      const domain = args.p_domain as string
      const actorId = args.p_actor_id as string
      const rows = this.rows.filter((r) => r.domain === domain && r.actor_id === actorId)
      return { data: rows as T, error: null }
    }
    return { data: null as T | null, error: { message: `Unknown RPC: ${fn}` } }
  }
}

function freshOverrides(identity: ActionRequestIdentity): Required<Pick<GovernedGrowthRuntimeOverrides, "identityVerifier" | "ledger">> & { rpc: FakeAuditRpcClient } {
  const rpc = new FakeAuditRpcClient()
  return {
    rpc,
    identityVerifier: staticIdentityVerifier(identity),
    ledger: new SupabaseAuditLedger({ client: rpc, domain: "growth" }),
  }
}

function draftFor(userId: string, title = "Spine proof draft") {
  return createGrowthDraft({
    userId,
    brand: "JHADINA",
    platforms: ["INSTAGRAM"],
    kind: "POST",
    title,
    body: "Integration Phase 2 test draft.",
    rationale: "Testing the real product loop.",
  })
}

describe("Growth product loop — UI-facing composition root (Jhadina OS Integration Phase 2)", () => {
  it("1. a created draft is visible as a real pending proposal (what the UI shows)", () => {
    const userId = "user-loop-1"
    const draft = draftFor(userId)
    const [stored] = listGrowthDrafts(userId)
    expect(stored.id).toBe(draft.id)
    expect(stored.status).toBe("PENDING_APPROVAL")
  })

  it("2, 3, 5, 6, 7. an authorized approval runs identity->policy->approval->execute and is recorded in the durable ledger", async () => {
    const identity: ActionRequestIdentity = { userId: "user-loop-2", sessionId: "session-loop-2" }
    const draft = draftFor(identity.userId)
    const overrides = freshOverrides(identity)

    const result = await runGovernedGrowthDraftApproval(identity.userId, draft.id, overrides)

    // 5/6: authorized approval succeeded and the engine's real state changed.
    expect(result.draft.status).toBe("APPROVED")
    expect(result.verifiedUserId).toBe(identity.userId)
    const [stored] = listGrowthDrafts(identity.userId)
    expect(stored.status).toBe("APPROVED")

    // 3/7: policy was evaluated and the durable ledger recorded the full trail.
    const activity = await listGovernedGrowthActivity(identity.userId, overrides)
    const trail = activity.events.filter((e) => e.actionId.startsWith(`growth-draft-approve:${draft.id}:`))
    const statuses = trail.map((e) => e.status)
    expect(statuses).toContain("started")
    expect(statuses).toContain("completed")
    expect(statuses).not.toContain("denied")
    expect(statuses).not.toContain("failed")
  })

  it("4. an unauthorized (identity-mismatched) approval fails closed and does not touch the draft", async () => {
    const identity: ActionRequestIdentity = { userId: "user-loop-3", sessionId: "session-loop-3" }
    const draft = draftFor(identity.userId)
    const overrides = freshOverrides(identity)

    await expect(
      runGovernedGrowthDraftApproval("someone-else", draft.id, overrides),
    ).rejects.toThrow("Action identity mismatch")

    const [stored] = listGrowthDrafts(identity.userId)
    expect(stored.status).toBe("PENDING_APPROVAL")

    // The denied event is recorded under the *claimed* (unverified,
    // never-real) actor — "someone-else" — not the real user-loop-3.
    // Inspecting the ledger directly (the write-side concern under
    // test here) rather than through listGovernedGrowthActivity: a
    // claim that failed identity verification correctly does NOT
    // appear in the real user's own Activity read (test 8 covers that
    // read-side isolation for the authorized case).
    const trail = await overrides.ledger.list({ domain: "growth", actorId: "someone-else" })
    const denied = trail.filter((e) => e.actionId.startsWith(`growth-draft-approve:${draft.id}:`))
    expect(denied).toHaveLength(1)
    expect(denied[0].status).toBe("denied")
    expect(denied[0].metadata?.stage).toBe("identity")

    // And it's real proof the mismatched claim never leaks into the
    // verified user's own activity view.
    const ownActivity = await listGovernedGrowthActivity(identity.userId, overrides)
    expect(ownActivity.events.some((e) => e.actionId.startsWith(`growth-draft-approve:${draft.id}:`))).toBe(false)
  })

  it("8. the Activity Timeline boundary reads back exactly what approval wrote, scoped to the requesting user only", async () => {
    const alice: ActionRequestIdentity = { userId: "user-loop-4a", sessionId: "session-4a" }
    const bob: ActionRequestIdentity = { userId: "user-loop-4b", sessionId: "session-4b" }
    const aliceDraft = draftFor(alice.userId, "Alice's draft")
    const bobDraft = draftFor(bob.userId, "Bob's draft")

    // Same underlying RPC store for both — proving the domain/actor
    // scoping in the fake (and, by construction, the real RPC it
    // mirrors) actually isolates users sharing one durable table.
    const rpc = new FakeAuditRpcClient()
    const aliceOverrides: GovernedGrowthRuntimeOverrides = {
      identityVerifier: staticIdentityVerifier(alice),
      ledger: new SupabaseAuditLedger({ client: rpc, domain: "growth" }),
    }
    const bobOverrides: GovernedGrowthRuntimeOverrides = {
      identityVerifier: staticIdentityVerifier(bob),
      ledger: new SupabaseAuditLedger({ client: rpc, domain: "growth" }),
    }

    await runGovernedGrowthDraftApproval(alice.userId, aliceDraft.id, aliceOverrides)
    await runGovernedGrowthDraftApproval(bob.userId, bobDraft.id, bobOverrides)

    const aliceActivity = await listGovernedGrowthActivity(alice.userId, aliceOverrides)
    expect(aliceActivity.verifiedUserId).toBe(alice.userId)
    expect(aliceActivity.events.every((e) => e.userId === alice.userId)).toBe(true)
    expect(aliceActivity.events.some((e) => e.actionId.startsWith(`growth-draft-approve:${aliceDraft.id}:`))).toBe(true)
    // Bob's approval never leaks into Alice's activity read.
    expect(aliceActivity.events.some((e) => e.actionId.startsWith(`growth-draft-approve:${bobDraft.id}:`))).toBe(false)

    // The read boundary itself fails closed on an unverifiable claim, same as the write side.
    await expect(
      listGovernedGrowthActivity("someone-else", aliceOverrides),
    ).rejects.toThrow("Action identity mismatch")
  })

  it("9. a failed execution is recorded as failed and is visible through the Activity boundary, not hidden", async () => {
    const identity: ActionRequestIdentity = { userId: "user-loop-5", sessionId: "session-loop-5" }
    const overrides = freshOverrides(identity)

    // No draft created — a verified, policy-allowed, but nonexistent target.
    await expect(
      runGovernedGrowthDraftApproval(identity.userId, "growth_does_not_exist", overrides),
    ).rejects.toThrow("Draft not found")

    const activity = await listGovernedGrowthActivity(identity.userId, overrides)
    expect(activity.events.some((e) => e.status === "failed")).toBe(true)
  })

  it("10. a second approval on an already-approved draft cannot execute twice", async () => {
    const identity: ActionRequestIdentity = { userId: "user-loop-6", sessionId: "session-loop-6" }
    const draft = draftFor(identity.userId)
    const overrides = freshOverrides(identity)

    const first = await runGovernedGrowthDraftApproval(identity.userId, draft.id, overrides)
    expect(first.draft.status).toBe("APPROVED")

    await expect(
      runGovernedGrowthDraftApproval(identity.userId, draft.id, overrides),
    ).rejects.toThrow("not awaiting approval")

    // Still exactly one APPROVED draft — the second attempt did not re-execute or duplicate state.
    const [stored] = listGrowthDrafts(identity.userId)
    expect(stored.status).toBe("APPROVED")
    expect(stored.approvedAt).toBe(first.draft.approvedAt)
  })
})
