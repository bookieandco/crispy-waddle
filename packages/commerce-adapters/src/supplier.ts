import type { ExternalReference } from "./shared";

export interface SupplierOfferSnapshot {
  provider: string;
  connectionId: string;
  supplierId: string;
  productId: string;
  inventoryId: string;
  title: string;
  externalProduct: ExternalReference;
  unitAmountMinor: number;
  shippingAmountMinor: number;
  currency: string;
  availableQuantity: number;
  estimatedDeliveryDays: number;
  supplierRiskScore: number;
  destinationCountries: string[];
  excludedDestinationCountries?: string[];
  observedAt: string;
}



export interface SupplierDiscoveryObservation {
  provider: string;
  sourceId: string;
  productId: string;
  title: string;
  supplierId?: string;
  supplierName?: string;
  supplierStoreUrl?: string;
  productUrl?: string;
  imageUrl?: string;
  minUnitAmountMinor?: number;
  maxUnitAmountMinor?: number;
  currency?: string;
  minimumOrderQuantity?: number;
  sellerFeedbackPercent?: number;
  reviewCount?: number;
  freeShipping?: boolean;
  sponsored?: boolean;
  destinationCountry?: string;
  observedAt: string;
  metadata?: Record<string, string>;
}

export interface SupplierDiscoveryQuery {
  query: string;
  destinationCountry?: string;
  currency?: string;
  limit?: number;
}

export interface SupplierDiscoveryAdapter {
  readonly name: string;
  search(query: SupplierDiscoveryQuery): Promise<SupplierDiscoveryObservation[]>;
}

export interface SupplierSourcingQuery {
  query: string;
  destinationCountry: string;
  currency: string;
  limit?: number;
}

export interface SupplierSourcingAdapter {
  readonly name: string;
  search(query: SupplierSourcingQuery): Promise<SupplierOfferSnapshot[]>;
}

export interface SupplierRoutingPolicy {
  maxRiskScore: number;
  maxDeliveryDays: number;
}

export interface SupplierRoutingRequest {
  quantity: number;
  destinationCountry: string;
  currency: string;
  candidates: SupplierOfferSnapshot[];
}

export interface SupplierRoutingDecision {
  offer: SupplierOfferSnapshot;
  quantity: number;
  landedCostMinor: number;
  rationale: string[];
}

export function routeSupplierOffers(
  request: SupplierRoutingRequest,
  policy: SupplierRoutingPolicy,
): SupplierRoutingDecision | null {
  if (!Number.isInteger(request.quantity) || request.quantity <= 0) return null;
  const destination = normalizeCountry(request.destinationCountry);
  const currency = request.currency.trim().toUpperCase();
  if (!destination || !currency) return null;

  const eligible = request.candidates.filter((candidate) => {
    const destinations = candidate.destinationCountries.map(normalizeCountry);
    const exclusions = (candidate.excludedDestinationCountries ?? []).map(normalizeCountry);
    const destinationAllowed = destinations.includes("*") || destinations.includes(destination);
    return (
      candidate.availableQuantity >= request.quantity &&
      candidate.currency.trim().toUpperCase() === currency &&
      Number.isFinite(candidate.unitAmountMinor) &&
      candidate.unitAmountMinor >= 0 &&
      Number.isFinite(candidate.shippingAmountMinor) &&
      candidate.shippingAmountMinor >= 0 &&
      Number.isFinite(candidate.supplierRiskScore) &&
      candidate.supplierRiskScore <= policy.maxRiskScore &&
      Number.isFinite(candidate.estimatedDeliveryDays) &&
      candidate.estimatedDeliveryDays >= 0 &&
      candidate.estimatedDeliveryDays <= policy.maxDeliveryDays &&
      destinationAllowed &&
      !exclusions.includes(destination)
    );
  });

  if (eligible.length === 0) return null;

  const ranked = eligible
    .map((offer) => ({
      offer,
      landedCostMinor: offer.unitAmountMinor * request.quantity + offer.shippingAmountMinor,
    }))
    .sort((a, b) =>
      a.landedCostMinor - b.landedCostMinor ||
      a.offer.estimatedDeliveryDays - b.offer.estimatedDeliveryDays ||
      a.offer.supplierRiskScore - b.offer.supplierRiskScore ||
      a.offer.supplierId.localeCompare(b.offer.supplierId) ||
      a.offer.connectionId.localeCompare(b.offer.connectionId) ||
      a.offer.productId.localeCompare(b.offer.productId),
    );

  const winner = ranked[0];
  return {
    offer: winner.offer,
    quantity: request.quantity,
    landedCostMinor: winner.landedCostMinor,
    rationale: [
      "eligible supplier inventory",
      `destination:${destination}`,
      `landed_cost_minor:${winner.landedCostMinor}`,
      `delivery_days:${winner.offer.estimatedDeliveryDays}`,
      `supplier_risk_score:${winner.offer.supplierRiskScore}`,
    ],
  };
}

export interface SupplierProcurementPrepareRequest {
  actorId: string;
  opportunityId: string;
  researchCaseId: string;
  evidenceRefs: string[];
  internalOrderId: string;
  internalOrderItemId: string;
  quantity: number;
  destinationCountry: string;
  idempotencyKey: string;
  offer: SupplierOfferSnapshot;
}

export interface SupplierProcurementPreview {
  previewId: string;
  provider: string;
  connectionId: string;
  supplierId: string;
  productId: string;
  inventoryId: string;
  externalProduct: ExternalReference;
  opportunityId: string;
  researchCaseId: string;
  evidenceRefs: string[];
  internalOrderId: string;
  internalOrderItemId: string;
  quantity: number;
  unitAmountMinor: number;
  shippingAmountMinor: number;
  totalAmountMinor: number;
  currency: string;
  destinationCountry: string;
  estimatedDeliveryDays: number;
  idempotencyKey: string;
  preparedAt: string;
  expiresAt: string;
}

export type SupplierProcurementStatus =
  | "submitted"
  | "confirmed"
  | "shipped"
  | "delivered"
  | "rejected"
  | "failed";

export interface SupplierProcurementResult {
  procurementId: string;
  status: SupplierProcurementStatus;
  supplierId: string;
  connectionId: string;
  productId: string;
  inventoryId: string;
  quantity: number;
  internalOrderId: string;
  internalOrderItemId: string;
  idempotencyKey: string;
  externalOrder?: ExternalReference;
  tracking?: ExternalReference;
  submittedAt?: string;
  updatedAt: string;
  errorCode?: string;
}

export interface SupplierProcurementAdapter {
  readonly name: string;
  prepare(request: SupplierProcurementPrepareRequest): Promise<SupplierProcurementPreview>;
  submit(preview: SupplierProcurementPreview): Promise<SupplierProcurementResult>;
  getByIdempotencyKey(idempotencyKey: string): Promise<SupplierProcurementResult | null>;
}

export function assertSupplierProcurementPreview(preview: SupplierProcurementPreview): void {
  if (!preview.previewId.trim()) throw new Error("previewId is required");
  if (!preview.provider.trim()) throw new Error("provider is required");
  if (!preview.connectionId.trim()) throw new Error("connectionId is required");
  if (!preview.supplierId.trim()) throw new Error("supplierId is required");
  if (!preview.productId.trim()) throw new Error("productId is required");
  if (!preview.inventoryId.trim()) throw new Error("inventoryId is required");
  if (!preview.internalOrderId.trim()) throw new Error("internalOrderId is required");
  if (!preview.internalOrderItemId.trim()) throw new Error("internalOrderItemId is required");
  if (!Number.isInteger(preview.quantity) || preview.quantity <= 0) throw new Error("quantity must be a positive integer");
  if (!Number.isFinite(preview.unitAmountMinor) || preview.unitAmountMinor < 0) throw new Error("unitAmountMinor is invalid");
  if (!Number.isFinite(preview.shippingAmountMinor) || preview.shippingAmountMinor < 0) throw new Error("shippingAmountMinor is invalid");
  if (preview.totalAmountMinor !== preview.unitAmountMinor * preview.quantity + preview.shippingAmountMinor) {
    throw new Error("supplier procurement total does not match unit cost, quantity, and shipping");
  }
  if (!preview.currency.trim()) throw new Error("currency is required");
  if (!normalizeCountry(preview.destinationCountry)) throw new Error("destinationCountry is required");
  if (preview.evidenceRefs.length === 0 || preview.evidenceRefs.some((ref) => !ref.trim())) {
    throw new Error("supplier procurement requires evidence references");
  }
  const prepared = Date.parse(preview.preparedAt);
  const expires = Date.parse(preview.expiresAt);
  if (!Number.isFinite(prepared) || !Number.isFinite(expires) || expires <= prepared) {
    throw new Error("supplier procurement preview expiry is invalid");
  }
  const expectedKey = supplierProcurementIdempotencyKey(preview.internalOrderId, preview.internalOrderItemId);
  if (preview.idempotencyKey !== expectedKey) throw new Error("supplier procurement idempotency key mismatch");
}

export function supplierProcurementIdempotencyKey(orderId: string, orderItemId: string): string {
  const normalizedOrder = orderId.trim();
  const normalizedItem = orderItemId.trim();
  if (!normalizedOrder || !normalizedItem) throw new Error("orderId and orderItemId are required");
  return `supplier-procurement:${normalizedOrder}:${normalizedItem}`;
}

export function normalizeCountry(country: string): string {
  return country.trim().toUpperCase();
}
