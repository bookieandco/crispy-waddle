import type { InventoryItem } from "@jhadina/commerce-adapters";

export interface SupplierFulfillmentEligibility {
  destinationCountries: readonly string[];
  excludedDestinationCountries?: readonly string[];
  maxDeliveryDays?: number;
}

export interface SupplierInventoryCandidate {
  supplierId: string;
  connectionId: string;
  inventory: InventoryItem;
  supplierRiskScore: number;
  estimatedLandedCostMinor: number;
  estimatedDeliveryDays: number;
  fulfillment: SupplierFulfillmentEligibility;
}

export interface SupplierRoutingRequest {
  productId: string;
  quantity: number;
  currency: string;
  destinationCountry: string;
  candidates: SupplierInventoryCandidate[];
}

export interface SupplierRoutingDecision {
  supplierId: string;
  connectionId: string;
  inventoryId: string;
  quantity: number;
  rationale: readonly string[];
}

export interface SupplierRoutingEngine {
  route(request: SupplierRoutingRequest): SupplierRoutingDecision | null;
}
