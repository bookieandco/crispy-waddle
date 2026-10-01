import type {
  SupplierRoutingDecision,
  SupplierRoutingEngine,
  SupplierRoutingRequest,
} from "@jhadina/opportunity-contracts";

export interface SupplierRoutingPolicy {
  maxRiskScore: number;
  maxDeliveryDays: number;
}

export class DeterministicSupplierRoutingEngine implements SupplierRoutingEngine {
  constructor(private readonly policy: SupplierRoutingPolicy) {}

  route(request: SupplierRoutingRequest): SupplierRoutingDecision | null {
    if (!Number.isInteger(request.quantity) || request.quantity <= 0) return null;

    const destination = request.destinationCountry.trim().toUpperCase();
    if (!destination) return null;

    const eligible = request.candidates.filter((candidate) => {
      const available = candidate.inventory.availableQuantity;
      const eligibleDestinations = candidate.fulfillment.destinationCountries.map((c) => c.trim().toUpperCase());
      const excludedDestinations = (candidate.fulfillment.excludedDestinationCountries ?? []).map((c) => c.trim().toUpperCase());
      const destinationAllowed =
        eligibleDestinations.includes("*") || eligibleDestinations.includes(destination);
      const fulfillmentDeliveryAllowed =
        candidate.fulfillment.maxDeliveryDays === undefined ||
        candidate.estimatedDeliveryDays <= candidate.fulfillment.maxDeliveryDays;

      return (
        available >= request.quantity &&
        candidate.inventory.availability === "available" &&
        candidate.inventory.unitPrice?.currency === request.currency &&
        candidate.supplierRiskScore <= this.policy.maxRiskScore &&
        candidate.estimatedDeliveryDays <= this.policy.maxDeliveryDays &&
        fulfillmentDeliveryAllowed &&
        destinationAllowed &&
        !excludedDestinations.includes(destination)
      );
    });

    if (eligible.length === 0) return null;

    const sorted = [...eligible].sort((a, b) =>
      a.estimatedLandedCostMinor - b.estimatedLandedCostMinor ||
      a.estimatedDeliveryDays - b.estimatedDeliveryDays ||
      a.supplierRiskScore - b.supplierRiskScore ||
      a.supplierId.localeCompare(b.supplierId) ||
      a.connectionId.localeCompare(b.connectionId),
    );

    const winner = sorted[0];
    return {
      supplierId: winner.supplierId,
      connectionId: winner.connectionId,
      inventoryId: winner.inventory.inventoryId,
      quantity: request.quantity,
      rationale: [
        "eligible inventory available",
        `destination: ${request.destinationCountry}`,
        `landed cost: ${winner.estimatedLandedCostMinor}`,
        `delivery days: ${winner.estimatedDeliveryDays}`,
        `risk score: ${winner.supplierRiskScore}`,
      ],
    };
  }
}

export type { SupplierRoutingDecision, SupplierRoutingEngine, SupplierRoutingRequest };
