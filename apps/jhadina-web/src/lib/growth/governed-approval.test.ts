import { describe, it, expect } from "vitest"
import { InMemoryActionLedger, InMemoryApprovalReceiptStore, type ActionPolicy, type ActionPolicyDecision, type ActionRequest } from "@jhadina/action-core"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createGrowthDraft, listGrowthDrafts } from "./engine"
import {
  GROWTH_DRAFT_APPROVE_CAPABILITY,
  approveGrowthDraftGoverned,
  type GrowthDraftApproveAction,
  type GovernedGrowthApprovalDeps,
} from "./governed-approval"

/** A verifier that trusts its configured identity exactly (a deterministic reference stand-in for a real Supabase session — no network, no credentials). */
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

function alwaysDenyPolicy(): ActionPolicy<GrowthDraftApproveAction> {
  return { async evaluate(): Promise<ActionPolicyDecision> { return "deny" } }
}

function freshDeps(identity: ActionRequestIdentity): GovernedGrowthApprovalDeps & { ledger: InMemoryActionLedger } {
  return {
    identityVerifier: staticIdentityVerifier(identity),
    ledger: new InMemoryActionLedger(),
    approvalStore: new InMemoryApprovalReceiptStore(),
  }
}

function draftFor(userId: string) {
  return createGrowthDraft({
    userId,
    brand: "JHADINA",
    platforms: ["INSTAGRAM"],
    kind: "POST",
    body: "Spine proof test draft.",
    rationale: "Testing the governed lifecycle.",
  })
}

describe("Growth draft approval — governed lifecycle (Jhadina OS Integration Phase 1, Proof #1)", () => {
  it("completes the full lifecycle: identity -> policy -> approval -> execution -> audit", async () => {
    const identity: ActionRequestIdentity = { userId: "user-spine-1", sessionId: "session-1" }
    const deps = freshDeps(identity)
    const draft = draftFor(identity.userId)

    const result = await approveGrowthDraftGoverned(deps, identity.userId, draft.id)

    expect(result.draft.status).toBe("APPROVED")
    expect(result.draft.id).toBe(draft.id)
    expect(result.verifiedUserId).toBe(identity.userId)
    expect(result.approvalReceiptId).toBeDefined()

    // The engine's own state actually transitioned, not just the return value.
    const [stored] = listGrowthDrafts(identity.userId)
    expect(stored.status).toBe("APPROVED")

    // Immutable, ordered audit trail covering every governed stage.
    const trail = deps.ledger.list()
    const statuses = trail.map((event) => event.status)
    expect(statuses).toContain("started") // policy-evaluated marker (and executor's internal started)
    expect(statuses).toContain("completed")
    expect(statuses).not.toContain("denied")
    expect(statuses).not.toContain("failed")
    expect(trail.every((event) => event.type === GROWTH_DRAFT_APPROVE_CAPABILITY)).toBe(true)
  })

  it("fails closed on identity mismatch before anything else runs", async () => {
    const identity: ActionRequestIdentity = { userId: "user-spine-2", sessionId: "session-2" }
    const deps = freshDeps(identity)
    const draft = draftFor(identity.userId)

    await expect(approveGrowthDraftGoverned(deps, "someone-else", draft.id)).rejects.toThrow("Action identity mismatch")

    // Nothing downstream happened: draft untouched, only a denied identity event recorded.
    const [stored] = listGrowthDrafts(identity.userId)
    expect(stored.status).toBe("PENDING_APPROVAL")
    const trail = deps.ledger.list()
    expect(trail).toHaveLength(1)
    expect(trail[0].status).toBe("denied")
    expect(trail[0].metadata?.stage).toBe("identity")
  })

  it("fails closed when policy denies the capability, before approval or execution", async () => {
    const identity: ActionRequestIdentity = { userId: "user-spine-3", sessionId: "session-3" }
    const deps = { ...freshDeps(identity), policy: alwaysDenyPolicy() }
    const draft = draftFor(identity.userId)

    await expect(approveGrowthDraftGoverned(deps, identity.userId, draft.id)).rejects.toThrow("Action denied by policy")

    const [stored] = listGrowthDrafts(identity.userId)
    expect(stored.status).toBe("PENDING_APPROVAL")
    const trail = deps.ledger.list()
    expect(trail.some((event) => event.status === "denied")).toBe(true)
    expect(trail.some((event) => event.status === "completed")).toBe(false)
  })

  it("still enforces draft ownership at the handler even after identity/policy/approval all pass", async () => {
    const identity: ActionRequestIdentity = { userId: "user-spine-4", sessionId: "session-4" }
    const deps = freshDeps(identity)
    // No draft created for this user — a verified, approved, but nonexistent target.
    await expect(approveGrowthDraftGoverned(deps, identity.userId, "growth_does_not_exist")).rejects.toThrow(
      "Draft not found",
    )
    const trail = deps.ledger.list()
    expect(trail.some((event) => event.status === "failed")).toBe(true)
  })

  it("a second approval attempt on an already-approved draft fails at the handler, not silently", async () => {
    const identity: ActionRequestIdentity = { userId: "user-spine-5", sessionId: "session-5" }
    const deps = freshDeps(identity)
    const draft = draftFor(identity.userId)

    await approveGrowthDraftGoverned(deps, identity.userId, draft.id)
    await expect(approveGrowthDraftGoverned(deps, identity.userId, draft.id)).rejects.toThrow("not awaiting approval")
  })

  it("recognizes growth.draft.approve as an approval-gated capability under the base Security Core policy", async () => {
    const { createBaseSecurityCoreActionPolicy } = await import("@jhadina/action-core")
    const policy = createBaseSecurityCoreActionPolicy<GrowthDraftApproveAction>()
    const request: ActionRequest<GrowthDraftApproveAction> = {
      id: "policy-check-1",
      userId: "user-x",
      type: GROWTH_DRAFT_APPROVE_CAPABILITY,
      action: { draftId: "growth_1" },
      requestedAt: new Date().toISOString(),
    }
    await expect(policy.evaluate(request)).resolves.toBe("approval_required")
  })
})
