import { describe, it, expect, vi } from "vitest"
import { InMemoryActionLedger, InMemoryApprovalReceiptStore, type ActionPolicy, type ActionPolicyDecision, type ActionRequest } from "@jhadina/action-core"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createInMemoryCommerceProposalStore, type CommerceProposalPayload } from "./commerce-proposal-store"
import { InMemoryPaymentProvider } from "./reference-adapters"
import type { PaymentIntentRequest } from "@jhadina/payment-core"
import {
  approveCommerceProposal,
  executeCommerceProposal,
  proposeCommerceAction,
  type CommerceProposalExecutionDeps,
  type CommerceProposalLifecycleDeps,
} from "./commerce-proposal-lifecycle"
import { COMMERCE_PAYMENT_CHARGE_CAPABILITY } from "./commerce-security-policy"
import { InMemoryCommerceEventBus } from "./commerce-event-bus"

/**
 * Phase 4.6: the full three-step production approval boundary — propose
 * -> explicit human approval -> execute — proven end to end with no live
 * money, mirroring governed-commerce-intent.test.ts's and
 * commerce-approval-lifecycle.test.ts's own conventions (a static
 * identity verifier, in-memory ledger/receipt store, an in-memory
 * PaymentProvider standing in for the real Stripe sandbox provider).
 */

const USER_ID = "user-1"
const OTHER_USER_ID = "user-2"

function staticIdentityVerifier(identity: ActionRequestIdentity = { userId: USER_ID, sessionId: "session-1" }): JhadinaIdentityVerifier {
  return {
    async verify(request: JhadinaActionRequest) {
      if (request.userId !== identity.userId) throw new Error("Action identity mismatch")
      return identity
    },
  }
}

type CommerceCapabilityAction = { capability: string }

function alwaysApprovalRequiredPolicy(): ActionPolicy<CommerceCapabilityAction> {
  return {
    async evaluate(): Promise<ActionPolicyDecision> {
      return "approval_required"
    },
  }
}

function alwaysDenyPolicy(): ActionPolicy<CommerceCapabilityAction> {
  return {
    async evaluate(_request: ActionRequest<CommerceCapabilityAction>): Promise<ActionPolicyDecision> {
      return "deny"
    },
  }
}

function payload(overrides: Partial<CommerceProposalPayload> = {}): CommerceProposalPayload {
  return {
    amountMinor: 1500,
    currency: "usd",
    description: "Test sandbox charge",
    testPaymentMethod: "pm_card_visa",
    ...overrides,
  }
}

function baseDeps(): CommerceProposalLifecycleDeps {
  return {
    identityVerifier: staticIdentityVerifier(),
    proposalStore: createInMemoryCommerceProposalStore(),
    approvalStore: new InMemoryApprovalReceiptStore(),
    ledger: new InMemoryActionLedger(),
    eventBus: new InMemoryCommerceEventBus(),
    policy: alwaysApprovalRequiredPolicy(),
  }
}

/** Always throws — proves executeCommerceProposal's execution_failed event and error propagation without a real network dependency. */
function alwaysFailingPaymentProvider(): CommerceProposalExecutionDeps["paymentProvider"] {
  return {
    name: "always-failing",
    async createPaymentIntent(_request: PaymentIntentRequest) {
      throw new Error("simulated provider failure")
    },
    async capture() {
      throw new Error("not used in this test")
    },
    async refund() {
      throw new Error("not used in this test")
    },
    async getPayment() {
      throw new Error("not used in this test")
    },
    async createPayout() {
      throw new Error("not used in this test")
    },
    async reconcile() {
      throw new Error("not used in this test")
    },
  }
}

function executionDeps(base: CommerceProposalLifecycleDeps): CommerceProposalExecutionDeps {
  return { ...base, paymentProvider: new InMemoryPaymentProvider() }
}

describe("Commerce proposal lifecycle — propose -> approve -> execute", () => {
  it("completes the full lifecycle and records the executed result", async () => {
    const deps = baseDeps()

    const proposed = await proposeCommerceAction(deps, USER_ID, payload())
    expect(proposed.proposal.status).toBe("pending")
    expect(proposed.proposal.capability).toBe(COMMERCE_PAYMENT_CHARGE_CAPABILITY)

    const approved = await approveCommerceProposal(deps, USER_ID, proposed.proposal.id)
    expect(approved.proposal.status).toBe("approved")
    expect(approved.approvalReceiptId).toBeTruthy()

    const executed = await executeCommerceProposal(executionDeps(deps), USER_ID, proposed.proposal.id)
    expect(executed.proposal.status).toBe("executed")
    expect(executed.status).toBe("captured")
    expect(executed.paymentId).toBe(proposed.proposal.id)

    const stored = await deps.proposalStore.get(proposed.proposal.id, USER_ID)
    expect(stored?.status).toBe("executed")
    expect(stored?.result?.status).toBe("captured")
  })

  it("records every stage to the audit ledger", async () => {
    const deps = baseDeps()
    const proposed = await proposeCommerceAction(deps, USER_ID, payload())
    await approveCommerceProposal(deps, USER_ID, proposed.proposal.id)
    await executeCommerceProposal(executionDeps(deps), USER_ID, proposed.proposal.id)

    const events = (deps.ledger as InMemoryActionLedger).list()
    const stages = events.map((event) => event.status)
    expect(stages).toContain("started") // proposed
    expect(stages).toContain("completed") // approved
    expect(stages.filter((s) => s === "completed").length).toBeGreaterThanOrEqual(2) // approved + executed payment
  })

  it("publishes proposal_created, approval_granted, execution_started, and execution_succeeded to the event bus, in order, for one proposal", async () => {
    const deps = baseDeps()
    const proposed = await proposeCommerceAction(deps, USER_ID, payload())
    await approveCommerceProposal(deps, USER_ID, proposed.proposal.id)
    await executeCommerceProposal(executionDeps(deps), USER_ID, proposed.proposal.id)

    const bus = deps.eventBus as InMemoryCommerceEventBus
    const published = bus.list().filter((e) => e.proposalId === proposed.proposal.id)
    expect(published.map((e) => e.type)).toEqual([
      "proposal_created",
      "approval_granted",
      "execution_started",
      "execution_succeeded",
    ])
    for (const event of published) {
      expect(event.actorId).toBe(USER_ID)
      expect(event.capability).toBe(COMMERCE_PAYMENT_CHARGE_CAPABILITY)
    }
  })

  it("denies proposal creation when policy denies", async () => {
    const deps = { ...baseDeps(), policy: alwaysDenyPolicy() }
    await expect(proposeCommerceAction(deps, USER_ID, payload())).rejects.toThrow("Action denied by policy")
  })

  it("rejects approval by an identity that does not match the claimed user", async () => {
    const deps = baseDeps()
    const proposed = await proposeCommerceAction(deps, USER_ID, payload())
    await expect(approveCommerceProposal(deps, OTHER_USER_ID, proposed.proposal.id)).rejects.toThrow("Action identity mismatch")
  })

  it("rejects approving a proposal owned by another user, even with a valid identity for that other user", async () => {
    const deps: CommerceProposalLifecycleDeps = {
      ...baseDeps(),
      identityVerifier: staticIdentityVerifier({ userId: OTHER_USER_ID, sessionId: "session-2" }),
    }
    const proposerDeps = { ...deps, identityVerifier: staticIdentityVerifier() }
    const proposed = await proposeCommerceAction(proposerDeps, USER_ID, payload())

    await expect(approveCommerceProposal(deps, OTHER_USER_ID, proposed.proposal.id)).rejects.toThrow("Commerce proposal not found")
  })

  it("rejects approving a non-existent proposal", async () => {
    const deps = baseDeps()
    await expect(approveCommerceProposal(deps, USER_ID, "does-not-exist")).rejects.toThrow("Commerce proposal not found")
  })

  it("rejects approving a proposal that is not pending (already approved)", async () => {
    const deps = baseDeps()
    const proposed = await proposeCommerceAction(deps, USER_ID, payload())
    await approveCommerceProposal(deps, USER_ID, proposed.proposal.id)
    await expect(approveCommerceProposal(deps, USER_ID, proposed.proposal.id)).rejects.toThrow("not pending approval")
  })

  it("rejects executing a proposal that was never approved", async () => {
    const deps = baseDeps()
    const proposed = await proposeCommerceAction(deps, USER_ID, payload())
    await expect(executeCommerceProposal(executionDeps(deps), USER_ID, proposed.proposal.id)).rejects.toThrow(
      "not approved and ready to execute",
    )
  })

  it("rejects executing with a non-existent proposal id", async () => {
    const deps = baseDeps()
    await expect(executeCommerceProposal(executionDeps(deps), USER_ID, "does-not-exist")).rejects.toThrow(
      "Commerce proposal not found",
    )
  })

  it("rejects replaying execute a second time (single-use receipt already consumed)", async () => {
    const deps = baseDeps()
    const proposed = await proposeCommerceAction(deps, USER_ID, payload())
    await approveCommerceProposal(deps, USER_ID, proposed.proposal.id)
    await executeCommerceProposal(executionDeps(deps), USER_ID, proposed.proposal.id)

    // Executed proposals are no longer "approved", so a second execute
    // attempt is rejected purely by proposal state — proving the lifecycle
    // itself, not just the receipt store, refuses replay.
    await expect(executeCommerceProposal(executionDeps(deps), USER_ID, proposed.proposal.id)).rejects.toThrow(
      "not approved and ready to execute",
    )
  })

  it("rejects execution when the approval receipt has expired", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"))
    try {
      const deps = baseDeps()
      const proposed = await proposeCommerceAction(deps, USER_ID, payload())
      await approveCommerceProposal(deps, USER_ID, proposed.proposal.id)

      // Approval receipts carry a fixed 5-minute TTL (createApprovalRequestService);
      // advancing well past it proves execute() honors the store's own
      // real expiry rather than a re-implemented check.
      vi.advanceTimersByTime(6 * 60_000)

      await expect(executeCommerceProposal(executionDeps(deps), USER_ID, proposed.proposal.id)).rejects.toThrow(
        "Invalid, expired, or already-consumed commerce approval receipt",
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it("rejects execution when the underlying fingerprint no longer matches (payload cannot be swapped post-approval)", async () => {
    const deps = baseDeps()
    const proposed = await proposeCommerceAction(deps, USER_ID, payload())
    await approveCommerceProposal(deps, USER_ID, proposed.proposal.id)

    // Simulate a forged/altered proposal payload after approval by
    // mutating the durable row directly (something no route exposes) —
    // execute() must recompute the fingerprint from current stored
    // content and refuse the now-mismatched receipt rather than trust it.
    const row = await deps.proposalStore.get(proposed.proposal.id, USER_ID)
    if (row) row.payload = { ...row.payload, amountMinor: 999_999 }

    await expect(executeCommerceProposal(executionDeps(deps), USER_ID, proposed.proposal.id)).rejects.toThrow(
      "Invalid, expired, or already-consumed commerce approval receipt",
    )
  })

  it("rejects capability mismatch: a receipt bound to one capability cannot authorize execution under a different one", async () => {
    const deps = baseDeps()
    const proposed = await proposeCommerceAction(deps, USER_ID, payload())
    await approveCommerceProposal(deps, USER_ID, proposed.proposal.id)

    // The approval receipt's fingerprint was bound to
    // COMMERCE_PAYMENT_CHARGE_CAPABILITY at approval time. Mutating the
    // durable row's capability afterward (something no route exposes)
    // changes the fingerprint execute() recomputes, so the
    // already-issued receipt no longer matches — proving a capability
    // substitution after approval is rejected exactly like a payload
    // substitution is.
    const row = await deps.proposalStore.get(proposed.proposal.id, USER_ID)
    if (row) row.capability = "commerce.payment.refund"

    await expect(executeCommerceProposal(executionDeps(deps), USER_ID, proposed.proposal.id)).rejects.toThrow(
      "Invalid, expired, or already-consumed commerce approval receipt",
    )
  })

  it("rejects unauthorized execution: an identity other than the proposal's owner cannot execute it", async () => {
    const deps = baseDeps()
    const proposed = await proposeCommerceAction(deps, USER_ID, payload())
    await approveCommerceProposal(deps, USER_ID, proposed.proposal.id)

    const otherUserDeps: CommerceProposalExecutionDeps = {
      ...executionDeps(deps),
      identityVerifier: staticIdentityVerifier({ userId: OTHER_USER_ID, sessionId: "session-2" }),
    }

    await expect(executeCommerceProposal(otherUserDeps, OTHER_USER_ID, proposed.proposal.id)).rejects.toThrow(
      "Commerce proposal not found",
    )
  })

  it("rejects receipt reuse and publishes replay_rejected when a receipt already consumed by one execution is presented again", async () => {
    const deps = baseDeps()
    const proposed = await proposeCommerceAction(deps, USER_ID, payload())
    await approveCommerceProposal(deps, USER_ID, proposed.proposal.id)
    await executeCommerceProposal(executionDeps(deps), USER_ID, proposed.proposal.id)

    // Force the durable row back to "approved" (something no route
    // exposes) so the second attempt reaches the actual receipt-consumption
    // check instead of being turned away earlier by the proposal's own
    // "executed" status — this isolates the specific guarantee that an
    // already-consumed single-use receipt is rejected on its own terms.
    const row = await deps.proposalStore.get(proposed.proposal.id, USER_ID)
    if (row) row.status = "approved"

    await expect(executeCommerceProposal(executionDeps(deps), USER_ID, proposed.proposal.id)).rejects.toThrow(
      "Invalid, expired, or already-consumed commerce approval receipt",
    )

    const bus = deps.eventBus as InMemoryCommerceEventBus
    const replayEvents = bus.list().filter((e) => e.proposalId === proposed.proposal.id && e.type === "replay_rejected")
    expect(replayEvents).toHaveLength(1)
  })

  it("publishes execution_failed and still propagates the error when the payment provider itself fails", async () => {
    const deps = baseDeps()
    const proposed = await proposeCommerceAction(deps, USER_ID, payload())
    await approveCommerceProposal(deps, USER_ID, proposed.proposal.id)

    const failingDeps: CommerceProposalExecutionDeps = { ...deps, paymentProvider: alwaysFailingPaymentProvider() }
    await expect(executeCommerceProposal(failingDeps, USER_ID, proposed.proposal.id)).rejects.toThrow("simulated provider failure")

    const bus = deps.eventBus as InMemoryCommerceEventBus
    const failedEvents = bus.list().filter((e) => e.proposalId === proposed.proposal.id && e.type === "execution_failed")
    expect(failedEvents).toHaveLength(1)
    expect(failedEvents[0]?.payload).toMatchObject({ reason: "simulated provider failure" })

    // The proposal is left "approved", not "executed" — a failed payment
    // call must not be mistaken for a completed one.
    const stored = await deps.proposalStore.get(proposed.proposal.id, USER_ID)
    expect(stored?.status).toBe("approved")
  })

  it("InMemoryCommerceEventBus.publish is idempotent: publishing the same event id twice records it only once (duplicate events)", async () => {
    const bus = new InMemoryCommerceEventBus()
    const event = {
      id: "commerce-event:proposal-x:proposal_created",
      type: "proposal_created" as const,
      proposalId: "proposal-x",
      capability: COMMERCE_PAYMENT_CHARGE_CAPABILITY,
      actorId: USER_ID,
      occurredAt: new Date().toISOString(),
      payload: { amountMinor: 1500, currency: "usd" },
    }

    await bus.publish(event)
    await bus.publish(event) // simulated retry of the same logical occurrence
    await bus.publish({ ...event, payload: { amountMinor: 999_999, currency: "usd" } }) // same id, different payload — still deduped by id

    expect(bus.list()).toHaveLength(1)
    expect(bus.list()[0]?.payload).toEqual({ amountMinor: 1500, currency: "usd" }) // first write wins, never overwritten by a later duplicate
  })
})
