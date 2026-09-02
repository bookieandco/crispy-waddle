import type { CommerceIntent } from "@jhadina/opportunity-contracts";
import type { SupplierRoutingDecision } from "@jhadina/opportunity-contracts";

export interface SupplierProcurementIntentInput {
  actorId: string;
  intentId: string;
  opportunityId?: string;
  orderId: string;
  orderItemId: string;
  productId: string;
  destinationCountry: string;
  currency: string;
  landedCostMinor: number;
  supplier: SupplierRoutingDecision;
  requestedAt: string;
  reason?: string;
}

/** Converts a routing decision into an authorization-bound commerce intent.
 * This function is deliberately side-effect free: it does not reserve inventory,
 * contact suppliers, or execute a purchase.
 */
export function buildSupplierProcurementIntent(
  input: SupplierProcurementIntentInput,
): CommerceIntent {
  if (!input.actorId.trim()) throw new Error("actorId is required");
  if (!input.intentId.trim()) throw new Error("intentId is required");
  if (!input.orderId.trim()) throw new Error("orderId is required");
  if (!input.orderItemId.trim()) throw new Error("orderItemId is required");
  if (!input.productId.trim()) throw new Error("productId is required");
  if (!input.supplier.supplierId.trim()) throw new Error("supplierId is required");
  if (!input.supplier.connectionId.trim()) throw new Error("connectionId is required");
  if (!input.supplier.inventoryId.trim()) throw new Error("inventoryId is required");
  if (!Number.isInteger(input.supplier.quantity) || input.supplier.quantity <= 0) {
    throw new Error("supplier quantity must be a positive integer");
  }
  if (!Number.isFinite(input.landedCostMinor) || input.landedCostMinor < 0) {
    throw new Error("landedCostMinor must be non-negative");
  }
  const destinationCountry = input.destinationCountry.trim().toUpperCase();
  if (!destinationCountry) throw new Error("destinationCountry is required");
  if (!input.currency.trim()) throw new Error("currency is required");
  if (Number.isNaN(Date.parse(input.requestedAt))) throw new Error("requestedAt must be a valid timestamp");

  return {
    intentId: input.intentId,
    kind: "financial_commitment",
    actorId: input.actorId,
    resourceType: "supplier_procurement",
    resourceId: `${input.orderId}:${input.orderItemId}`,
    opportunityId: input.opportunityId,
    requestedAt: new Date(input.requestedAt).toISOString(),
    risk: "financial",
    idempotencyKey: `supplier-procurement:${input.orderId}:${input.orderItemId}`,
    reason: input.reason ?? "procure routed supplier inventory",
    metadata: {
      orderId: input.orderId,
      orderItemId: input.orderItemId,
      productId: input.productId,
      supplierId: input.supplier.supplierId,
      connectionId: input.supplier.connectionId,
      inventoryId: input.supplier.inventoryId,
      quantity: String(input.supplier.quantity),
      destinationCountry,
      currency: input.currency.trim(),
      landedCostMinor: String(input.landedCostMinor),
      routingRationale: input.supplier.rationale.join(" | "),
    },
  };
}
