import type { ActionLedger, ApprovalReceiptStore } from "@jhadina/action-core"
import type { SupplierProcurementAdapter } from "@jhadina/commerce-adapters"
import { createRequestIdentityVerifier } from "../auth/request-identity"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import { approveCommerceProposal, type CommerceProposalApprovalResult } from "./commerce-proposal-lifecycle"
import type { CommerceProposalStore } from "./commerce-proposal-store"
import { createCommerceAuditLedger } from "./durable-audit-ledger"
import {
  executeSupplierProcurement,
  proposeSupplierProcurement,
  reconcileSupplierProcurement,
  type SupplierProcurementExecutionResult,
  type SupplierProcurementProposalInput,
  type SupplierProcurementProposalResult,
  type SupplierProcurementReconciliation,
} from "./governed-supplier-procurement"
import { createSupabaseCommerceApprovalReceiptStore } from "./supabase-approval-receipt-store"
import { createSupabaseCommerceProposalStore } from "./supabase-commerce-proposal-store"

export type SupplierProcurementRuntimeOverrides = {
  identityVerifier?: JhadinaIdentityVerifier
  ledger?: ActionLedger
  proposalStore?: CommerceProposalStore
  approvalStore?: ApprovalReceiptStore
}

/**
 * Production composition root for supplier procurement.
 *
 * The provider adapter is intentionally required. Jhadina has no default live
 * supplier purchase transport and must fail closed rather than silently
 * selecting one. Identity, durable proposal state, single-use approval
 * receipts, and audit all reuse the existing Commerce/Supabase boundaries.
 */
async function resolveSupplierProcurementDeps(
  adapter: SupplierProcurementAdapter,
  overrides: SupplierProcurementRuntimeOverrides,
) {
  return {
    identityVerifier:
      overrides.identityVerifier ?? (await createRequestIdentityVerifier()),
    ledger: overrides.ledger ?? (await createCommerceAuditLedger()),
    proposalStore:
      overrides.proposalStore ?? createSupabaseCommerceProposalStore(),
    approvalStore:
      overrides.approvalStore ?? createSupabaseCommerceApprovalReceiptStore(),
    adapter,
  }
}

export async function runProposeSupplierProcurement(
  adapter: SupplierProcurementAdapter,
  claimedUserId: string | undefined,
  input: SupplierProcurementProposalInput,
  overrides: SupplierProcurementRuntimeOverrides = {},
): Promise<SupplierProcurementProposalResult> {
  const deps = await resolveSupplierProcurementDeps(adapter, overrides)
  return proposeSupplierProcurement(deps, claimedUserId, input)
}

export async function runApproveSupplierProcurement(
  adapter: SupplierProcurementAdapter,
  claimedUserId: string | undefined,
  proposalId: string,
  overrides: SupplierProcurementRuntimeOverrides = {},
): Promise<CommerceProposalApprovalResult> {
  const deps = await resolveSupplierProcurementDeps(adapter, overrides)
  return approveCommerceProposal(deps, claimedUserId, proposalId)
}

export async function runExecuteSupplierProcurement(
  adapter: SupplierProcurementAdapter,
  claimedUserId: string | undefined,
  proposalId: string,
  overrides: SupplierProcurementRuntimeOverrides = {},
): Promise<SupplierProcurementExecutionResult> {
  const deps = await resolveSupplierProcurementDeps(adapter, overrides)
  return executeSupplierProcurement(deps, claimedUserId, proposalId)
}

export async function runReconcileSupplierProcurement(
  adapter: SupplierProcurementAdapter,
  claimedUserId: string | undefined,
  proposalId: string,
  overrides: SupplierProcurementRuntimeOverrides = {},
): Promise<SupplierProcurementReconciliation> {
  const deps = await resolveSupplierProcurementDeps(adapter, overrides)
  return reconcileSupplierProcurement(deps, claimedUserId, proposalId)
}
