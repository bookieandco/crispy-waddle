import { describe, expect, it } from "vitest"
import {
  InMemoryActionLedger,
  InMemoryApprovalReceiptStore,
} from "@jhadina/action-core"
import {
  type SupplierProcurementAdapter,
  type SupplierProcurementPrepareRequest,
  type SupplierProcurementPreview,
  type SupplierProcurementResult,
  type SupplierRoutingDecision,
} from "@jhadina/commerce-adapters"
import type { OpportunityActionIntent } from "@jhadina/opportunity-core"
import type {
  ActionRequestIdentity,
  JhadinaActionRequest,
  JhadinaIdentityVerifier,
} from "../auth/supabase-identity-verifier"
import { approveCommerceProposal } from "./commerce-proposal-lifecycle"
import {
  createInMemoryCommerceProposalStore,
  type CommerceProposalStore,
} from "./commerce-proposal-store"
import {
  executeSupplierProcurement,
  proposeSupplierProcurement,
  reconcileSupplierProcurement,
} from "./governed-supplier-procurement"
import { COMMERCE_SUPPLIER_PROCURE_CAPABILITY } from "./commerce-security-policy"

class StaticVerifier implements JhadinaIdentityVerifier {
  constructor(private readonly identity: ActionRequestIdentity) {}
  async verify(request: JhadinaActionRequest = {}): Promise<ActionRequestIdentity> {
    if (request.userId && request.userId !== this.identity.userId) {
      throw new Error("Action identity mismatch")
    }
    return this.identity
  }
}

class InMemorySupplierAdapter implements SupplierProcurementAdapter {
  readonly name = "fixture-supplier"
  readonly submitted: SupplierProcurementPreview[] = []
  private readonly results = new Map<string, SupplierProcurementResult>()

  async prepare(request: SupplierProcurementPrepareRequest): Promise<SupplierProcurementPreview> {
    const now = new Date()
    return {
      previewId: `preview:${request.internalOrderId}:${request.internalOrderItemId}`,
      provider: request.offer.provider,
      connectionId: request.offer.connectionId,
      supplierId: request.offer.supplierId,
      productId: request.offer.productId,
      inventoryId: request.offer.inventoryId,
      externalProduct: request.offer.externalProduct,
      opportunityId: request.opportunityId,
      researchCaseId: request.researchCaseId,
      evidenceRefs: [...request.evidenceRefs],
      internalOrderId: request.internalOrderId,
      internalOrderItemId: request.internalOrderItemId,
      quantity: request.quantity,
      unitAmountMinor: request.offer.unitAmountMinor,
      shippingAmountMinor: request.offer.shippingAmountMinor,
      totalAmountMinor: request.offer.unitAmountMinor * request.quantity + request.offer.shippingAmountMinor,
      currency: request.offer.currency,
      destinationCountry: request.destinationCountry.trim().toUpperCase(),
      estimatedDeliveryDays: request.offer.estimatedDeliveryDays,
      idempotencyKey: request.idempotencyKey,
      preparedAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 60_000).toISOString(),
    }
  }

  async submit(preview: SupplierProcurementPreview): Promise<SupplierProcurementResult> {
    const existing = this.results.get(preview.idempotencyKey)
    if (existing) return existing
    this.submitted.push(preview)
    const result: SupplierProcurementResult = {
      procurementId: `procurement:${preview.idempotencyKey}`,
      status: "confirmed",
      supplierId: preview.supplierId,
      connectionId: preview.connectionId,
      productId: preview.productId,
      inventoryId: preview.inventoryId,
      quantity: preview.quantity,
      internalOrderId: preview.internalOrderId,
      internalOrderItemId: preview.internalOrderItemId,
      idempotencyKey: preview.idempotencyKey,
      externalOrder: { provider: preview.provider, externalId: "external-order-1" },
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    this.results.set(preview.idempotencyKey, result)
    return result
  }

  async getByIdempotencyKey(idempotencyKey: string): Promise<SupplierProcurementResult | null> {
    return this.results.get(idempotencyKey) ?? null
  }
}

function handoff(): OpportunityActionIntent {
  const now = Date.now()
  return {
    id: "opportunity-action:drop-1:commerce.supplier.procure",
    opportunityId: "commercial:drop-1",
    researchCaseId: "research:drop-1",
    executionOwner: "commerce",
    capability: COMMERCE_SUPPLIER_PROCURE_CAPABILITY,
    evidenceRefs: ["evidence:supplier", "evidence:economics"],
    requiresPolicy: true,
    requiresApproval: true,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60_000).toISOString(),
  }
}

function routing(): SupplierRoutingDecision {
  return {
    offer: {
      provider: "1688",
      connectionId: "conn-1688",
      supplierId: "supplier-1688",
      productId: "offer-1688",
      inventoryId: "inventory-1688",
      title: "Fixture product",
      externalProduct: { provider: "1688", externalId: "offer-1688" },
      unitAmountMinor: 500,
      shippingAmountMinor: 200,
      currency: "USD",
      availableQuantity: 25,
      estimatedDeliveryDays: 7,
      supplierRiskScore: 0.2,
      destinationCountries: ["US"],
      observedAt: new Date().toISOString(),
    },
    quantity: 2,
    landedCostMinor: 1200,
    rationale: ["eligible supplier inventory"],
  }
}

function deps(store: CommerceProposalStore = createInMemoryCommerceProposalStore()) {
  return {
    identityVerifier: new StaticVerifier({ userId: "user-1", sessionId: "session-1" }),
    proposalStore: store,
    approvalStore: new InMemoryApprovalReceiptStore(),
    ledger: new InMemoryActionLedger(),
    adapter: new InMemorySupplierAdapter(),
  }
}

describe("governed supplier procurement", () => {
  it("requires explicit approval before a supplier side effect", async () => {
    const d = deps()
    const proposed = await proposeSupplierProcurement(d, "user-1", {
      handoff: handoff(),
      routing: routing(),
      internalOrderId: "order-1",
      internalOrderItemId: "item-1",
      destinationCountry: "US",
    })

    expect(proposed.proposal.status).toBe("pending")
    expect(d.adapter.submitted).toHaveLength(0)

    await expect(
      executeSupplierProcurement(d, "user-1", proposed.proposal.id),
    ).rejects.toThrow(/not approved/)
    expect(d.adapter.submitted).toHaveLength(0)

    const approved = await approveCommerceProposal(d, "user-1", proposed.proposal.id)
    expect(approved.proposal.status).toBe("approved")

    const executed = await executeSupplierProcurement(d, "user-1", proposed.proposal.id)
    expect(executed.procurement.status).toBe("confirmed")
    expect(executed.procurement.externalOrder?.externalId).toBe("external-order-1")
    expect(d.adapter.submitted).toHaveLength(1)
    expect(executed.proposal.status).toBe("executed")
  })

  it("rejects the wrong actor before procurement", async () => {
    const d = deps()
    const proposed = await proposeSupplierProcurement(d, "user-1", {
      handoff: handoff(),
      routing: routing(),
      internalOrderId: "order-2",
      internalOrderItemId: "item-2",
      destinationCountry: "US",
    })
    await expect(
      approveCommerceProposal(d, "user-2", proposed.proposal.id),
    ).rejects.toThrow(/identity mismatch/i)
    expect(d.adapter.submitted).toHaveLength(0)
  })

  it("recovers an accepted idempotent provider order when durable completion fails", async () => {
    const backing = createInMemoryCommerceProposalStore()
    let failOnce = true
    const flakyStore: CommerceProposalStore = {
      ...backing,
      async markExecuted(proposalId, userId, result) {
        if (failOnce) {
          failOnce = false
          throw new Error("synthetic durable write failure")
        }
        return backing.markExecuted(proposalId, userId, result)
      },
    }
    const d = deps(flakyStore)
    const proposed = await proposeSupplierProcurement(d, "user-1", {
      handoff: handoff(),
      routing: routing(),
      internalOrderId: "order-3",
      internalOrderItemId: "item-3",
      destinationCountry: "US",
    })
    await approveCommerceProposal(d, "user-1", proposed.proposal.id)

    await expect(
      executeSupplierProcurement(d, "user-1", proposed.proposal.id),
    ).rejects.toThrow(/synthetic durable write failure/)
    expect(d.adapter.submitted).toHaveLength(1)

    const reconciled = await reconcileSupplierProcurement(d, "user-1", proposed.proposal.id)
    expect(reconciled.status).toBe("recovered")
    if (reconciled.status === "recovered") {
      expect(reconciled.proposal.status).toBe("executed")
      expect(reconciled.procurement.idempotencyKey).toBe(
        "supplier-procurement:order-3:item-3",
      )
    }
    expect(d.adapter.submitted).toHaveLength(1)
  })
})
