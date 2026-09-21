import {
  SecurityCoreActionPolicy,
  VerifiedActionExecutor,
  createApprovalReceiptVerifier,
  type ActionHandler,
  type ActionIdentityVerifier,
  type ActionLedger,
  type ActionPolicy,
  type ApprovalReceiptStore,
} from "@jhadina/action-core"
import {
  assertSupplierProcurementPreview,
  supplierProcurementIdempotencyKey,
  type SupplierProcurementAdapter,
  type SupplierProcurementPreview,
  type SupplierProcurementResult,
  type SupplierRoutingDecision,
} from "@jhadina/commerce-adapters"
import type { OpportunityActionIntent } from "@jhadina/opportunity-core"
import { JhadinaSecurityCore } from "@jhadina/security-core"
import type { JhadinaIdentityVerifier } from "../auth/supabase-identity-verifier"
import {
  computeProposalFingerprint,
} from "./commerce-proposal-lifecycle"
import {
  isSupplierProcurementProposalPayload,
  type CommerceProposal,
  type CommerceProposalStore,
  type SupplierProcurementCommerceProposalPayload,
} from "./commerce-proposal-store"
import {
  COMMERCE_SECURITY_POLICY,
  COMMERCE_SUPPLIER_PROCURE_CAPABILITY,
} from "./commerce-security-policy"

export interface SupplierProcurementLifecycleDeps {
  identityVerifier: JhadinaIdentityVerifier
  proposalStore: CommerceProposalStore
  approvalStore: ApprovalReceiptStore
  ledger: ActionLedger
  adapter: SupplierProcurementAdapter
  policy?: ActionPolicy<SupplierProcurementAction>
}

export interface SupplierProcurementProposalInput {
  handoff: OpportunityActionIntent
  routing: SupplierRoutingDecision
  internalOrderId: string
  internalOrderItemId: string
  destinationCountry: string
}

export interface SupplierProcurementAction {
  capability: typeof COMMERCE_SUPPLIER_PROCURE_CAPABILITY
  actorId: string
  proposalId: string
  opportunityActionId: string
  opportunityId: string
  researchCaseId: string
  handoffExpiresAt: string
  preview: SupplierProcurementPreview
}

export interface SupplierProcurementProposalResult {
  proposal: CommerceProposal
  verifiedUserId: string
}

export interface SupplierProcurementExecutionResult {
  proposal: CommerceProposal
  procurement: SupplierProcurementResult
  verifiedUserId: string
}

export type SupplierProcurementReconciliation =
  | { status: "already_recorded"; proposal: CommerceProposal }
  | { status: "external_missing"; proposal: CommerceProposal }
  | { status: "recovered"; proposal: CommerceProposal; procurement: SupplierProcurementResult }

export async function proposeSupplierProcurement(
  deps: SupplierProcurementLifecycleDeps,
  claimedUserId: string | undefined,
  input: SupplierProcurementProposalInput,
): Promise<SupplierProcurementProposalResult> {
  const identity = await verifyIdentity(deps.identityVerifier, claimedUserId)
  assertCommerceHandoff(input.handoff)

  const idempotencyKey = supplierProcurementIdempotencyKey(
    input.internalOrderId,
    input.internalOrderItemId,
  )

  const preview = await deps.adapter.prepare({
    actorId: identity.userId,
    opportunityId: input.handoff.opportunityId,
    researchCaseId: input.handoff.researchCaseId,
    evidenceRefs: [...input.handoff.evidenceRefs],
    internalOrderId: input.internalOrderId,
    internalOrderItemId: input.internalOrderItemId,
    quantity: input.routing.quantity,
    destinationCountry: input.destinationCountry,
    idempotencyKey,
    offer: input.routing.offer,
  })

  assertSupplierProcurementPreview(preview)
  assertPreviewMatchesRoute(preview, input)

  const provisionalId =
    `supplier-procurement:${input.handoff.opportunityId}:${input.internalOrderId}:${input.internalOrderItemId}`
  const action = actionFor(
    provisionalId,
    identity.userId,
    input.handoff,
    preview,
  )
  const policy = buildPolicy(deps.policy)
  const decision = await policy.evaluate({
    id: provisionalId,
    userId: identity.userId,
    type: COMMERCE_SUPPLIER_PROCURE_CAPABILITY,
    action,
    requestedAt: new Date().toISOString(),
  })

  if (decision !== "approval_required") {
    await deps.ledger.append({
      id: `${provisionalId}:policy-${decision}`,
      actionId: provisionalId,
      userId: identity.userId,
      type: COMMERCE_SUPPLIER_PROCURE_CAPABILITY,
      status: decision === "deny" ? "denied" : "failed",
      timestamp: new Date().toISOString(),
      metadata: {
        reason:
          decision === "deny"
            ? "supplier_procurement_denied"
            : "supplier_procurement_must_require_explicit_approval",
      },
    })
    throw new Error(
      decision === "deny"
        ? "Supplier procurement denied by policy"
        : "Supplier procurement policy must require explicit approval",
    )
  }

  const payload: SupplierProcurementCommerceProposalPayload = {
    kind: "supplier_procurement",
    opportunityActionId: input.handoff.id,
    opportunityId: input.handoff.opportunityId,
    researchCaseId: input.handoff.researchCaseId,
    handoffExpiresAt: input.handoff.expiresAt,
    preview,
  }
  const proposal = await deps.proposalStore.create({
    userId: identity.userId,
    capability: COMMERCE_SUPPLIER_PROCURE_CAPABILITY,
    payload,
  })
  const fingerprint = computeProposalFingerprint(
    proposal.id,
    proposal.capability,
    proposal.payload,
  )

  await deps.ledger.append({
    id: `${proposal.id}:proposed`,
    actionId: proposal.id,
    userId: identity.userId,
    type: COMMERCE_SUPPLIER_PROCURE_CAPABILITY,
    status: "approval_required",
    timestamp: new Date().toISOString(),
    metadata: {
      stage: "supplier_procurement_preview",
      fingerprint,
      opportunityId: input.handoff.opportunityId,
      supplierId: preview.supplierId,
      productId: preview.productId,
      quantity: preview.quantity,
      totalAmountMinor: preview.totalAmountMinor,
      currency: preview.currency,
      expiresAt: preview.expiresAt,
    },
  })

  return { proposal, verifiedUserId: identity.userId }
}

export async function executeSupplierProcurement(
  deps: SupplierProcurementLifecycleDeps,
  claimedUserId: string | undefined,
  proposalId: string,
): Promise<SupplierProcurementExecutionResult> {
  const identity = await verifyIdentity(deps.identityVerifier, claimedUserId)
  const proposal = await deps.proposalStore.get(proposalId, identity.userId)
  if (!proposal) throw new Error("Commerce proposal not found")
  if (
    proposal.capability !== COMMERCE_SUPPLIER_PROCURE_CAPABILITY ||
    !isSupplierProcurementProposalPayload(proposal.payload)
  ) {
    throw new Error("Commerce proposal is not a supplier procurement")
  }
  if (proposal.status !== "approved" || !proposal.receiptId) {
    throw new Error(
      `Supplier procurement proposal is not approved and ready to execute: ${proposal.status}`,
    )
  }

  assertExecutionFreshness(proposal.payload)
  const action = actionFor(
    proposal.id,
    identity.userId,
    {
      id: proposal.payload.opportunityActionId,
      opportunityId: proposal.payload.opportunityId,
      researchCaseId: proposal.payload.researchCaseId,
      executionOwner: "commerce",
      capability: COMMERCE_SUPPLIER_PROCURE_CAPABILITY,
      evidenceRefs: proposal.payload.preview.evidenceRefs,
      requiresPolicy: true,
      requiresApproval: true,
      createdAt: proposal.payload.preview.preparedAt,
      expiresAt: proposal.payload.handoffExpiresAt,
    },
    proposal.payload.preview,
  )

  const fingerprint = () =>
    computeProposalFingerprint(proposal.id, proposal.capability, proposal.payload)
  const actionIdentity: ActionIdentityVerifier = {
    verify: (request) => deps.identityVerifier.verify({ userId: request.userId }),
  }
  const handler = new SupplierProcurementActionHandler(deps.adapter)
  const executor = new VerifiedActionExecutor(
    actionIdentity,
    buildPolicy(deps.policy),
    deps.ledger,
    [handler],
    createApprovalReceiptVerifier(deps.approvalStore, fingerprint),
  )

  const procurement = await executor.execute({
    id: proposal.id,
    userId: identity.userId,
    type: COMMERCE_SUPPLIER_PROCURE_CAPABILITY,
    action,
    requestedAt: new Date().toISOString(),
    approvalReceiptId: proposal.receiptId,
  })

  const updated = await deps.proposalStore.markExecuted(
    proposal.id,
    identity.userId,
    procurementToRecord(procurement),
  )
  return { proposal: updated, procurement, verifiedUserId: identity.userId }
}

/**
 * Read-only repair for the narrow failure window where a provider accepted an
 * idempotent procurement but durable proposal completion failed afterward.
 * This never submits an order; it only queries the provider by idempotency key.
 */
export async function reconcileSupplierProcurement(
  deps: SupplierProcurementLifecycleDeps,
  claimedUserId: string | undefined,
  proposalId: string,
): Promise<SupplierProcurementReconciliation> {
  const identity = await verifyIdentity(deps.identityVerifier, claimedUserId)
  const proposal = await deps.proposalStore.get(proposalId, identity.userId)
  if (!proposal) throw new Error("Commerce proposal not found")
  if (
    proposal.capability !== COMMERCE_SUPPLIER_PROCURE_CAPABILITY ||
    !isSupplierProcurementProposalPayload(proposal.payload)
  ) {
    throw new Error("Commerce proposal is not a supplier procurement")
  }
  if (proposal.status === "executed") return { status: "already_recorded", proposal }

  const procurement = await deps.adapter.getByIdempotencyKey(
    proposal.payload.preview.idempotencyKey,
  )
  if (!procurement) return { status: "external_missing", proposal }
  assertResultMatchesPreview(procurement, proposal.payload.preview)

  const updated = await deps.proposalStore.markExecuted(
    proposal.id,
    identity.userId,
    procurementToRecord(procurement),
  )
  await deps.ledger.append({
    id: `${proposal.id}:reconciled`,
    actionId: proposal.id,
    userId: identity.userId,
    type: COMMERCE_SUPPLIER_PROCURE_CAPABILITY,
    status: "completed",
    timestamp: new Date().toISOString(),
    metadata: {
      stage: "supplier_procurement_reconciliation",
      procurementId: procurement.procurementId,
      idempotencyKey: procurement.idempotencyKey,
    },
  })
  return { status: "recovered", proposal: updated, procurement }
}

export class SupplierProcurementActionHandler
  implements ActionHandler<SupplierProcurementAction, SupplierProcurementResult>
{
  constructor(private readonly adapter: SupplierProcurementAdapter) {}

  supports(type: string): boolean {
    return type === COMMERCE_SUPPLIER_PROCURE_CAPABILITY
  }

  async execute(
    action: SupplierProcurementAction,
    request: { userId: string; type: string },
  ): Promise<SupplierProcurementResult> {
    if (request.type !== COMMERCE_SUPPLIER_PROCURE_CAPABILITY) {
      throw new Error("Supplier procurement handler received the wrong capability")
    }
    if (request.userId !== action.actorId) {
      throw new Error("Supplier procurement actor mismatch")
    }
    assertSupplierProcurementPreview(action.preview)
    if (Date.parse(action.preview.expiresAt) <= Date.now()) {
      throw new Error("Supplier procurement preview expired")
    }
    if (Date.parse(action.handoffExpiresAt) <= Date.now()) {
      throw new Error("Opportunity execution handoff expired")
    }

    const existing = await this.adapter.getByIdempotencyKey(
      action.preview.idempotencyKey,
    )
    if (existing) {
      assertResultMatchesPreview(existing, action.preview)
      return existing
    }

    const result = await this.adapter.submit(action.preview)
    assertResultMatchesPreview(result, action.preview)
    return result
  }
}

function buildPolicy(
  policy?: ActionPolicy<SupplierProcurementAction>,
): ActionPolicy<SupplierProcurementAction> {
  return (
    policy ??
    new SecurityCoreActionPolicy<SupplierProcurementAction>(
      new JhadinaSecurityCore(COMMERCE_SECURITY_POLICY),
      "commerce",
    )
  )
}

function actionFor(
  proposalId: string,
  actorId: string,
  handoff: OpportunityActionIntent,
  preview: SupplierProcurementPreview,
): SupplierProcurementAction {
  return {
    capability: COMMERCE_SUPPLIER_PROCURE_CAPABILITY,
    actorId,
    proposalId,
    opportunityActionId: handoff.id,
    opportunityId: handoff.opportunityId,
    researchCaseId: handoff.researchCaseId,
    handoffExpiresAt: handoff.expiresAt,
    preview,
  }
}

function assertCommerceHandoff(handoff: OpportunityActionIntent): void {
  if (handoff.executionOwner !== "commerce") {
    throw new Error("Dropshipping procurement must be handed to Commerce")
  }
  if (handoff.capability !== COMMERCE_SUPPLIER_PROCURE_CAPABILITY) {
    throw new Error("Opportunity handoff does not authorize supplier procurement")
  }
  if (handoff.evidenceRefs.length === 0 || handoff.evidenceRefs.some((ref) => !ref.trim())) {
    throw new Error("Opportunity handoff requires evidence references")
  }
  if (Date.parse(handoff.expiresAt) <= Date.now()) {
    throw new Error("Opportunity execution handoff expired")
  }
}

function assertPreviewMatchesRoute(
  preview: SupplierProcurementPreview,
  input: SupplierProcurementProposalInput,
): void {
  const offer = input.routing.offer
  if (
    preview.provider !== offer.provider ||
    preview.connectionId !== offer.connectionId ||
    preview.supplierId !== offer.supplierId ||
    preview.productId !== offer.productId ||
    preview.inventoryId !== offer.inventoryId
  ) {
    throw new Error("Supplier preview does not match the selected routed offer")
  }
  if (preview.quantity !== input.routing.quantity) {
    throw new Error("Supplier preview quantity does not match routing decision")
  }
  if (
    preview.destinationCountry.trim().toUpperCase() !==
    input.destinationCountry.trim().toUpperCase()
  ) {
    throw new Error("Supplier preview destination does not match procurement request")
  }
  if (preview.currency.trim().toUpperCase() !== offer.currency.trim().toUpperCase()) {
    throw new Error("Supplier preview currency does not match routed offer")
  }
  if (preview.opportunityId !== input.handoff.opportunityId) {
    throw new Error("Supplier preview opportunity does not match handoff")
  }
  if (preview.researchCaseId !== input.handoff.researchCaseId) {
    throw new Error("Supplier preview research case does not match handoff")
  }
  if (Date.parse(preview.expiresAt) > Date.parse(input.handoff.expiresAt)) {
    throw new Error("Supplier preview cannot outlive the Opportunity execution handoff")
  }
}

function assertExecutionFreshness(
  payload: SupplierProcurementCommerceProposalPayload,
): void {
  assertSupplierProcurementPreview(payload.preview)
  if (Date.parse(payload.preview.expiresAt) <= Date.now()) {
    throw new Error("Supplier procurement preview expired")
  }
  if (Date.parse(payload.handoffExpiresAt) <= Date.now()) {
    throw new Error("Opportunity execution handoff expired")
  }
}

function assertResultMatchesPreview(
  result: SupplierProcurementResult,
  preview: SupplierProcurementPreview,
): void {
  if (
    result.supplierId !== preview.supplierId ||
    result.connectionId !== preview.connectionId ||
    result.productId !== preview.productId ||
    result.inventoryId !== preview.inventoryId ||
    result.quantity !== preview.quantity ||
    result.internalOrderId !== preview.internalOrderId ||
    result.internalOrderItemId !== preview.internalOrderItemId ||
    result.idempotencyKey !== preview.idempotencyKey
  ) {
    throw new Error("Supplier procurement result does not match the approved preview")
  }
}

function procurementToRecord(
  procurement: SupplierProcurementResult,
): Record<string, unknown> {
  return {
    procurementId: procurement.procurementId,
    status: procurement.status,
    supplierId: procurement.supplierId,
    connectionId: procurement.connectionId,
    productId: procurement.productId,
    inventoryId: procurement.inventoryId,
    quantity: procurement.quantity,
    internalOrderId: procurement.internalOrderId,
    internalOrderItemId: procurement.internalOrderItemId,
    idempotencyKey: procurement.idempotencyKey,
    externalOrder: procurement.externalOrder,
    tracking: procurement.tracking,
    submittedAt: procurement.submittedAt,
    updatedAt: procurement.updatedAt,
    errorCode: procurement.errorCode,
  }
}

function verifyIdentity(
  identityVerifier: JhadinaIdentityVerifier,
  claimedUserId: string | undefined,
) {
  return identityVerifier.verify(
    claimedUserId === undefined ? undefined : { userId: claimedUserId },
  )
}
