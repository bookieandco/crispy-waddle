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
 * Supabase client is bound to the current request's session cookies.
 */
export type CommerceProposalRuntimeOverrides = {
  /** Test-only identity verifier. Production always verifies the current request session. */
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

async function resolveBaseDeps(overrides: CommerceProposalRuntimeOverrides) {
  return {
    identityVerifier: overrides.identityVerifier ?? (await createRequestIdentityVerifier()),
    ledger: overrides.ledger ?? (await createCommerceAuditLedger()),
    proposalStore: overrides.proposalStore ?? createSupabaseCommerceProposalStore(),
    approvalStore: overrides.approvalStore ?? createSupabaseCommerceApprovalReceiptStore(),
  }
}

/**
 * Identity is deliberately not accepted from the HTTP caller. The lifecycle
 * receives undefined so its verifier must derive the actor from the verified
 * request session. Keeping this contract here prevents future route code from
 * accidentally reintroducing caller-controlled identity.
 */
export async function runProposeCommerceAction(
  _claimedUserId: undefined,
  payload: CommerceProposalPayload,
  overrides: CommerceProposalRuntimeOverrides = {},
): Promise<CommerceProposalResult> {
  const deps = await resolveBaseDeps(overrides)
  return proposeCommerceAction(deps, undefined, payload)
}

export async function runApproveCommerceProposal(
  _claimedUserId: undefined,
  proposalId: string,
  overrides: CommerceProposalRuntimeOverrides = {},
): Promise<CommerceProposalApprovalResult> {
  const deps = await resolveBaseDeps(overrides)
  return approveCommerceProposal(deps, undefined, proposalId)
}

export async function runExecuteCommerceProposal(
  _claimedUserId: undefined,
  proposalId: string,
  overrides: CommerceProposalRuntimeOverrides = {},
): Promise<CommerceProposalExecutionResult> {
  const deps = await resolveBaseDeps(overrides)
  const paymentProvider = overrides.paymentProvider ?? (await createStripeSandboxProductionProvider())
  return executeCommerceProposal({ ...deps, paymentProvider }, undefined, proposalId)
}
