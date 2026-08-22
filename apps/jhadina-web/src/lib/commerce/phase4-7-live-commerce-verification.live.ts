import { describe, it, expect } from "vitest"
import {
  InMemoryActionLedger,
  InMemoryApprovalReceiptStore,
  SecurityCoreActionPolicy,
} from "@jhadina/action-core"
import { JhadinaSecurityCore } from "@jhadina/security-core"
import type { ActionRequestIdentity, JhadinaActionRequest, JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createInMemoryCommerceProposalStore, type CommerceProposalPayload } from "./commerce-proposal-store"
import {
  approveCommerceProposal,
  executeCommerceProposal,
  proposeCommerceAction,
  type CommerceProposalExecutionDeps,
  type CommerceProposalLifecycleDeps,
} from "./commerce-proposal-lifecycle"
import { COMMERCE_SECURITY_POLICY } from "./commerce-security-policy"
import { EnvironmentSandboxCredentialResolver } from "./sandbox-credential"
import { STRIPE_SANDBOX_CREDENTIAL_REF } from "./production-payment-provider"
import { StripeSandboxPaymentProvider, type StripeSandboxTestPaymentMethod } from "./stripe-sandbox-provider"

/**
 * Phase 4.7: the live-run evidence suite for the Phase 4.6 proposal
 * lifecycle (propose -> approve -> execute) against Stripe's real test
 * API.
 *
 * NEVER picked up by the default vitest.config.ts / `pnpm test` — that
 * config's include glob only matches `*.test.ts`/`*.spec.ts`, and this
 * file deliberately ends in `.live.ts`. The only way this file runs is
 * `pnpm exec vitest run --config vitest.phase4-7-live.config.ts`, which
 * only the dedicated workflow_dispatch job
 * (.github/workflows/phase4-7-live-commerce-verification.yml) invokes —
 * a job that only ever runs when a human explicitly dispatches it, and
 * only for the specific stage requested (see PHASE47_STAGE below).
 * Mirrors pl7-live-stripe-verification.live.ts's own conventions and
 * honesty boundary exactly.
 *
 * What is genuinely live here: credential resolution and the Stripe
 * PaymentIntents API call inside executeCommerceProposal. What is NOT:
 * identity (a static verifier — no real Supabase auth session exists in
 * a workflow_dispatch job), the proposal store, and the approval receipt
 * store (both in-memory — no live Supabase project/migration has been
 * applied in this environment; see docs/JHADINA_WORK_QUEUE.md). This
 * does not weaken what's being proven: proposeCommerceAction,
 * approveCommerceProposal, and executeCommerceProposal are the real,
 * unmodified production code — only their durability backing differs
 * from the Supabase-backed composition commerce-proposal-runtime.ts
 * uses. Every governance step (identity check, policy evaluation,
 * approval-receipt issuance/consumption, fingerprint recomputation)
 * still runs for real.
 *
 * Two stages, controlled by the PHASE47_STAGE env var (set by the
 * workflow's `stage` input, never by a default that could silently run
 * both):
 *
 *   PHASE47_STAGE=propose         — resolves the credential (fail-closed
 *                                    checks only, never touches Stripe),
 *                                    creates exactly one proposal, logs
 *                                    its full content, and stops. No
 *                                    approval, no execution.
 *   PHASE47_STAGE=approve-execute — reconstructs the identical proposal
 *                                    content, then approves, executes
 *                                    against real Stripe once, and
 *                                    immediately attempts a second
 *                                    execute on the same (now-consumed)
 *                                    receipt in the same process to
 *                                    prove replay is rejected.
 *
 * Dispatching PHASE47_STAGE=approve-execute is a distinct, separate
 * authorization from dispatching PHASE47_STAGE=propose — exactly the
 * "no automatic/self-approval" requirement this milestone specifies.
 * Nothing in this file or in production code advances a proposal from
 * PENDING to APPROVED except an explicit approveCommerceProposal call,
 * and nothing here calls it automatically after propose.
 *
 * Secret hygiene: the resolved credential is read once (the preflight
 * check) and is NEVER printed, logged, interpolated into a string, or
 * included in any evidence record. The leak check is a boolean-only
 * comparison (`.includes(...)` assigned to a variable, then asserted)
 * specifically so a failing assertion's own error message cannot print
 * the secret — the same pattern pl7-live-stripe-verification.live.ts
 * already established.
 */

const LIVE_ACTOR_ID = "phase4-7-live-verification-actor"
const stage = process.env.PHASE47_STAGE

function staticIdentityVerifier(): JhadinaIdentityVerifier {
  return {
    async verify(request: JhadinaActionRequest): Promise<ActionRequestIdentity> {
      if (request.userId !== LIVE_ACTOR_ID) throw new Error("Action identity mismatch")
      return { userId: LIVE_ACTOR_ID, sessionId: "phase4-7-live-verification-session" }
    },
  }
}

function payload(): CommerceProposalPayload {
  return {
    amountMinor: 1500,
    currency: "usd",
    description: "Phase 4.7 controlled Stripe sandbox verification",
    testPaymentMethod: "pm_card_visa" satisfies StripeSandboxTestPaymentMethod,
  }
}

function baseDeps(): CommerceProposalLifecycleDeps {
  return {
    identityVerifier: staticIdentityVerifier(),
    proposalStore: createInMemoryCommerceProposalStore(),
    approvalStore: new InMemoryApprovalReceiptStore(),
    ledger: new InMemoryActionLedger(),
    policy: new SecurityCoreActionPolicy(new JhadinaSecurityCore(COMMERCE_SECURITY_POLICY), "commerce"),
  }
}

/** Resolves the real server-side credential and constructs a live StripeSandboxPaymentProvider. Never returns or logs the secret itself. */
async function createLiveProvider(): Promise<StripeSandboxPaymentProvider> {
  const resolver = new EnvironmentSandboxCredentialResolver()
  const credential = await resolver.resolve(STRIPE_SANDBOX_CREDENTIAL_REF)
  return new StripeSandboxPaymentProvider({ secret: credential.secret, defaultTestPaymentMethod: "pm_card_visa" })
}

describe("Phase 4.7 — live Commerce proposal lifecycle (workflow_dispatch only, never runs in normal CI)", () => {
  it.skipIf(stage !== "propose")(
    "propose stage: credential resolves and fails closed on non-sk_test_, then exactly one proposal is created and left PENDING",
    async () => {
      // 1. Credential presence + sk_test_ fail-closed boundary — no Stripe call yet.
      const resolver = new EnvironmentSandboxCredentialResolver()
      const credential = await resolver.resolve(STRIPE_SANDBOX_CREDENTIAL_REF)
      expect(credential.secret.startsWith("sk_test_")).toBe(true)

      // 2. Create exactly one proposal. Never approved, never executed here.
      const deps = baseDeps()
      const proposed = await proposeCommerceAction(deps, LIVE_ACTOR_ID, payload())

      expect(proposed.proposal.status).toBe("pending")
      expect(proposed.verifiedUserId).toBe(LIVE_ACTOR_ID)

      // Everything logged below is built from proposal/identity fields
      // only — the credential is never referenced here at all, so there
      // is nothing for a leak check to catch; the boolean-only pattern
      // (used in the approve-execute stage below, where the credential
      // genuinely is in scope) is unnecessary in this stage.
      const evidence = {
        proposalId: proposed.proposal.id,
        capability: proposed.proposal.capability,
        status: proposed.proposal.status,
        payload: proposed.proposal.payload,
        requestedAt: proposed.proposal.requestedAt,
        verifiedUserId: proposed.verifiedUserId,
      }
      console.log(
        `\n=== PHASE 4.7 — PROPOSAL CREATED (PENDING, awaiting explicit human approval) ===\n${JSON.stringify(evidence, null, 2)}\n=== Nothing further happens automatically. Re-dispatch with stage=approve-execute only after explicit human approval. ===\n`,
      )
    },
  )

  it.skipIf(stage !== "approve-execute")(
    "approve+execute stage: explicit approval issues a single-use receipt, execute succeeds once against real Stripe, and replay is rejected",
    async () => {
      const deps = baseDeps()

      // Reconstructs the identical, already-approved-by-the-human proposal
      // content (see the propose stage above) — proposeCommerceAction is
      // called again here only because this workflow_dispatch job is a
      // fresh process with no access to the prior stage's in-memory
      // store; it is not a way to bypass approval. approveCommerceProposal
      // below is the one and only call in this entire file that can move
      // a proposal to APPROVED, and it only runs because this stage was
      // dispatched separately, after real human approval was obtained.
      const proposed = await proposeCommerceAction(deps, LIVE_ACTOR_ID, payload())
      expect(proposed.proposal.status).toBe("pending")

      // Explicit human approval -> durable APPROVED state + a bound, single-use receipt.
      const approved = await approveCommerceProposal(deps, LIVE_ACTOR_ID, proposed.proposal.id)
      expect(approved.proposal.status).toBe("approved")
      expect(approved.approvalReceiptId).toBeTruthy()

      // Resolved once, directly, purely so the leak check below has
      // something concrete to compare against — createLiveProvider()
      // performs its own independent resolve() for the provider itself;
      // both reads are the same cheap, no-network env lookup.
      const credential = await new EnvironmentSandboxCredentialResolver().resolve(STRIPE_SANDBOX_CREDENTIAL_REF)
      const executionDeps: CommerceProposalExecutionDeps = { ...deps, paymentProvider: await createLiveProvider() }

      // Real Stripe test-mode PaymentIntent call.
      const executed = await executeCommerceProposal(executionDeps, LIVE_ACTOR_ID, proposed.proposal.id)
      expect(executed.status).toBe("captured")
      expect(executed.proposal.status).toBe("executed")
      expect(executed.paymentId).toBe(proposed.proposal.id)
      expect(executed.providerReference).toBeTruthy()

      // ActionLedger evidence: started/completed events exist for both
      // the proposal lifecycle (proposed/approved) and the payment call
      // itself (GovernedPaymentProvider's own commerce.payment.charge
      // started/completed pair).
      const events = (deps.ledger as InMemoryActionLedger).list()
      const statuses = events.map((e) => e.status)
      expect(statuses).toContain("started")
      expect(statuses.filter((s) => s === "completed").length).toBeGreaterThanOrEqual(2)
      const chargeEvents = events.filter((e) => e.type === "commerce.payment.charge")
      expect(chargeEvents.some((e) => e.status === "started")).toBe(true)
      expect(chargeEvents.some((e) => e.status === "completed")).toBe(true)

      // Replay: the exact same receipt/proposal, executed a second time in
      // the same process. Must be rejected — the receipt is single-use and
      // the proposal is no longer in the "approved" state.
      await expect(executeCommerceProposal(executionDeps, LIVE_ACTOR_ID, proposed.proposal.id)).rejects.toThrow(
        "not approved and ready to execute",
      )

      // No live key was ever accepted (assertStripeSandboxKey's fail-closed
      // sk_test_ boundary is unit-tested in sandbox-credential.test.ts /
      // production-payment-provider.test.ts and is not re-proven here) or
      // exposed by this run. Boolean-only comparison, assigned to a
      // variable before asserting, so a failing assertion's own error
      // message cannot print the secret.
      expect(credential.secret.startsWith("sk_test_")).toBe(true)
      const evidenceBlob = JSON.stringify({
        proposalId: executed.proposal.id,
        status: executed.status,
        providerReference: executed.providerReference,
        approvalReceiptId: approved.approvalReceiptId,
        ledgerEventCount: events.length,
      })
      const leaked = evidenceBlob.includes(credential.secret)
      expect(leaked).toBe(false)

      console.log(
        `\n=== PHASE 4.7 — EXECUTED AGAINST REAL STRIPE TEST API ===\n${evidenceBlob}\n=== Replay of the same proposal/receipt was rejected, as required. ===\n`,
      )
    },
  )
})
