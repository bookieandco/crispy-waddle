import { describe, it, expect } from "vitest"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createGrowthDraft, listGrowthDrafts } from "./engine"
import {
  getGovernedGrowthApprovalLedger,
  runGovernedGrowthDraftApproval,
  listGovernedGrowthActivity,
} from "./governed-approval-runtime"

/**
 * Jhadina OS Integration Phase 2 — Real Product Loop.
 *
 * SP-1's own test suite (governed-approval.test.ts) proved
 * approveGrowthDraftGoverned — the composable governance function.
 * This file proves the layer above it: runGovernedGrowthDraftApproval
 * and listGovernedGrowthActivity, the actual composition-root functions
 * the real API routes (/api/growth/drafts/approve,
 * /api/growth/activity) call in production. That layer was previously
 * untested — createRequestIdentityVerifier() makes a real Supabase
 * call with no meaning in a test process, so
 * identityVerifierOverride exists specifically to let these tests
 * exercise the real production entry points with a deterministic
 * identity double instead of a live session.
 *
 * Covers all ten lifecycle points end to end through the shared,
 * module-level ledger singleton — proving the write side (approval)
 * and the read side (activity) actually observe the same events, not
 * two independently-plausible mocks.
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

  it("2, 3, 5, 6, 7. an authorized approval runs identity->policy->approval->execute and is recorded in the shared ledger", async () => {
    const identity: ActionRequestIdentity = { userId: "user-loop-2", sessionId: "session-loop-2" }
    const draft = draftFor(identity.userId)

    const result = await runGovernedGrowthDraftApproval(identity.userId, draft.id, staticIdentityVerifier(identity))

    // 5/6: authorized approval succeeded and the engine's real state changed.
    expect(result.draft.status).toBe("APPROVED")
    expect(result.verifiedUserId).toBe(identity.userId)
    const [stored] = listGrowthDrafts(identity.userId)
    expect(stored.status).toBe("APPROVED")

    // 3/7: policy was evaluated and the shared ledger recorded the full trail.
    const trail = getGovernedGrowthApprovalLedger()
      .list()
      .filter((e) => e.actionId.startsWith(`growth-draft-approve:${draft.id}:`))
    const statuses = trail.map((e) => e.status)
    expect(statuses).toContain("started")
    expect(statuses).toContain("completed")
    expect(statuses).not.toContain("denied")
    expect(statuses).not.toContain("failed")
  })

  it("4. an unauthorized (identity-mismatched) approval fails closed and does not touch the draft", async () => {
    const identity: ActionRequestIdentity = { userId: "user-loop-3", sessionId: "session-loop-3" }
    const draft = draftFor(identity.userId)

    await expect(
      runGovernedGrowthDraftApproval("someone-else", draft.id, staticIdentityVerifier(identity)),
    ).rejects.toThrow("Action identity mismatch")

    const [stored] = listGrowthDrafts(identity.userId)
    expect(stored.status).toBe("PENDING_APPROVAL")

    const trail = getGovernedGrowthApprovalLedger()
      .list()
      .filter((e) => e.actionId.startsWith(`growth-draft-approve:${draft.id}:`))
    expect(trail).toHaveLength(1)
    expect(trail[0].status).toBe("denied")
    expect(trail[0].metadata?.stage).toBe("identity")
  })

  it("8. the Activity Timeline boundary reads back exactly what approval wrote, scoped to the requesting user only", async () => {
    const alice: ActionRequestIdentity = { userId: "user-loop-4a", sessionId: "session-4a" }
    const bob: ActionRequestIdentity = { userId: "user-loop-4b", sessionId: "session-4b" }
    const aliceDraft = draftFor(alice.userId, "Alice's draft")
    const bobDraft = draftFor(bob.userId, "Bob's draft")

    await runGovernedGrowthDraftApproval(alice.userId, aliceDraft.id, staticIdentityVerifier(alice))
    await runGovernedGrowthDraftApproval(bob.userId, bobDraft.id, staticIdentityVerifier(bob))

    const aliceActivity = await listGovernedGrowthActivity(alice.userId, staticIdentityVerifier(alice))
    expect(aliceActivity.verifiedUserId).toBe(alice.userId)
    expect(aliceActivity.events.every((e) => e.userId === alice.userId)).toBe(true)
    expect(aliceActivity.events.some((e) => e.actionId.startsWith(`growth-draft-approve:${aliceDraft.id}:`))).toBe(true)
    // Bob's approval never leaks into Alice's activity read.
    expect(aliceActivity.events.some((e) => e.actionId.startsWith(`growth-draft-approve:${bobDraft.id}:`))).toBe(false)

    // The read boundary itself fails closed on an unverifiable claim, same as the write side.
    await expect(listGovernedGrowthActivity("someone-else", staticIdentityVerifier(alice))).rejects.toThrow(
      "Action identity mismatch",
    )
  })

  it("9. a failed execution is recorded as failed and is visible through the Activity boundary, not hidden", async () => {
    const identity: ActionRequestIdentity = { userId: "user-loop-5", sessionId: "session-loop-5" }
    // No draft created — a verified, policy-allowed, but nonexistent target.
    await expect(
      runGovernedGrowthDraftApproval(identity.userId, "growth_does_not_exist", staticIdentityVerifier(identity)),
    ).rejects.toThrow("Draft not found")

    const activity = await listGovernedGrowthActivity(identity.userId, staticIdentityVerifier(identity))
    expect(activity.events.some((e) => e.status === "failed")).toBe(true)
  })

  it("10. a second approval on an already-approved draft cannot execute twice", async () => {
    const identity: ActionRequestIdentity = { userId: "user-loop-6", sessionId: "session-loop-6" }
    const draft = draftFor(identity.userId)

    const first = await runGovernedGrowthDraftApproval(identity.userId, draft.id, staticIdentityVerifier(identity))
    expect(first.draft.status).toBe("APPROVED")

    await expect(
      runGovernedGrowthDraftApproval(identity.userId, draft.id, staticIdentityVerifier(identity)),
    ).rejects.toThrow("not awaiting approval")

    // Still exactly one APPROVED draft — the second attempt did not re-execute or duplicate state.
    const [stored] = listGrowthDrafts(identity.userId)
    expect(stored.status).toBe("APPROVED")
    expect(stored.approvedAt).toBe(first.draft.approvedAt)
  })
})
