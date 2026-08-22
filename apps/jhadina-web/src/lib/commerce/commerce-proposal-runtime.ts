import type { ActionLedger, ApprovalReceiptStore } from "@jhadina/action-core"
import type { PaymentProvider } from "@jhadina/payment-core"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { createCommerceAuditLedger } from "./durable-audit-ledger"
import { createSupabaseCommerceApprovalReceiptStore } from "./supabase-approval-receipt-store"
import { createSupabaseCommerceProposalStore } from "./supabase-commerce-proposal-store"
import { createStripeSandboxProductionProvider } from "./production-payment-provider"
import type { CommerceProposalPayload, CommerceProposalStore } from "./commerce-proposal-store"
import {
  approveCommerceProposal,
  executeCommerceProposal,
  proposeCommerceAction,
  type CommerceProposalApprovalResult,
  type CommerceProposalExecutionResult,
  type CommerceProposalResult,
} from "./commerce-proposal-lifecycle"

/**
 * Phase 4.6 production composition root. Every dependency here is the
 * same real, durable, request-scoped implementation the rest of Commerce
 * already uses — nothing module-level/singleton, since the underlying
 * Supabase client is bound to the current request's session cookies (see
 * durable-audit-ledger.ts's own note on why its ledger can't be a
 * singleton either).
 *
 * The payment provider is createStripeSandboxProductionProvider() with
 * no overrides: it resolves JHADINA_SECRET_STRIPE_SANDBOX (via
 * STRIPE_SANDBOX_CREDENTIAL_REF = "commerce/stripe/sandbox" and
 * sandboxCredentialRefToEnvKey — see sandbox-credential.ts) from
 * the real environment and fails closed (CREDENTIAL_NOT_CONFIGURED) if
 * that secret is unset, and independently refuses anything that is not a
 * real sk_test_ key (assertStripeSandboxKey). No live credential exists
 * in this environment as of this milestone — executeCommerceProposal
 * against a real proposal will fail closed here until a human configures
 * that secret. That is the intended human gate, not a bug to route
 * around.
 */
export type CommerceProposalRuntimeOverrides = {
  /** Test-only: createRequestIdentityVerifier() makes a real Supabase call with no meaning outside a real request. */
  identityVerifier?: JhadinaIdentityVerifier
  /** Test-only: substitutes a fake/in-memory ledger instead of a live database. */
  ledger?: ActionLedger
  /** Test-only: substitutes an in-memory CommerceProposalStore instead of a live database. */
  proposalStore?: CommerceProposalStore
  /** Test-only: substitutes an in-memory ApprovalReceiptStore instead of a live database. */
  approvalStore?: ApprovalReceiptStore
  /** Test-only: substitutes a fake PaymentProvider instead of a live (sandbox) Stripe call. */
  paymentProvider?: PaymentProvider
}

/**
 * Shared by all three stages. Deliberately does NOT construct the
 * payment provider — propose and approve never touch Stripe at all, and
 * must keep working in this environment even though no sandbox
 * credential is configured yet. Only executeCommerceProposal (below)
 * needs, and resolves, the payment provider — the one place a missing
 * credential is expected to fail closed.
 */
async function resolveBaseDeps(overrides: CommerceProposalRuntimeOverrides) {
  return {
    identityVerifier: overrides.identityVerifier ?? (await createRequestIdentityVerifier()),
    ledger: overrides.ledger ?? (await createCommerceAuditLedger()),
    proposalStore: overrides.proposalStore ?? createSupabaseCommerceProposalStore(),
    approvalStore: overrides.approvalStore ?? createSupabaseCommerceApprovalReceiptStore(),
  }
}

export async function runProposeCommerceAction(
  claimedUserId: string,
  payload: CommerceProposalPayload,
  overrides: CommerceProposalRuntimeOverrides = {},
): Promise<CommerceProposalResult> {
  const deps = await resolveBaseDeps(overrides)
  return proposeCommerceAction(deps, claimedUserId, payload)
}

export async function runApproveCommerceProposal(
  claimedUserId: string,
  proposalId: string,
  overrides: CommerceProposalRuntimeOverrides = {},
): Promise<CommerceProposalApprovalResult> {
  const deps = await resolveBaseDeps(overrides)
  return approveCommerceProposal(deps, claimedUserId, proposalId)
}

export async function runExecuteCommerceProposal(
  claimedUserId: string,
  proposalId: string,
  overrides: CommerceProposalRuntimeOverrides = {},
): Promise<CommerceProposalExecutionResult> {
  const deps = await resolveBaseDeps(overrides)
  const paymentProvider = overrides.paymentProvider ?? (await createStripeSandboxProductionProvider())
  return executeCommerceProposal({ ...deps, paymentProvider }, claimedUserId, proposalId)
}
