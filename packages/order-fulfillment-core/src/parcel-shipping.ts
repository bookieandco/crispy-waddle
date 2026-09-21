export type ParcelWeightUnit = "ounce" | "pound" | "gram" | "kilogram";
export type ParcelDimensionUnit = "inch" | "centimeter";
export type ParcelLabelFormat = "pdf" | "png" | "zpl";

export interface ParcelAddress {
  name: string;
  company?: string;
  phone?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  stateProvince?: string;
  postalCode: string;
  countryCode: string;
  residential?: boolean;
}

export interface ParcelPackage {
  packageId?: string;
  weight: { value: number; unit: ParcelWeightUnit };
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: ParcelDimensionUnit;
  };
}

export interface ParcelRateRequest {
  orderId: string;
  shipmentId: string;
  shipFrom: ParcelAddress;
  shipTo: ParcelAddress;
  packages: ParcelPackage[];
  carrierIds?: string[];
  serviceCodes?: string[];
  currency?: string;
}

export interface ParcelRateQuote {
  rateId: string;
  carrierId: string;
  carrierCode?: string;
  serviceCode: string;
  serviceName?: string;
  amountMinor: number;
  currency: string;
  deliveryDays?: number;
  estimatedDeliveryAt?: string;
  observedAt: string;
}

export interface ParcelLabelPurchaseRequest {
  orderId: string;
  shipmentId: string;
  rateId: string;
  idempotencyKey: string;
  labelFormat: ParcelLabelFormat;
}

export interface ParcelLabel {
  labelId: string;
  shipmentId: string;
  orderId: string;
  carrierId: string;
  carrierCode?: string;
  serviceCode: string;
  trackingNumber?: string;
  amountMinor: number;
  insuranceAmountMinor?: number;
  currency: string;
  labelFormat: ParcelLabelFormat;
  downloadUrl?: string;
  status: "processing" | "completed" | "error" | "voided";
  createdAt: string;
  voidedAt?: string;
  idempotencyKey: string;
}

export interface ParcelLabelVoidResult {
  labelId: string;
  status: "voided" | "rejected";
  voidedAt?: string;
  reason?: string;
}

export type ParcelTrackingStatus =
  | "unknown"
  | "pre_transit"
  | "in_transit"
  | "out_for_delivery"
  | "available_for_pickup"
  | "delivered"
  | "exception"
  | "cancelled";

export interface ParcelTrackingEvent {
  status: ParcelTrackingStatus;
  description?: string;
  occurredAt: string;
  location?: string;
}

export interface ParcelTrackingSnapshot {
  trackingNumber: string;
  carrierCode?: string;
  status: ParcelTrackingStatus;
  estimatedDeliveryAt?: string;
  deliveredAt?: string;
  events: ParcelTrackingEvent[];
  observedAt: string;
}

export interface ParcelWebhookVerification {
  provider: string;
  verified: boolean;
  verifiedAt: string;
  keyId?: string;
}

export interface ParcelTrackingWebhook {
  provider: string;
  eventId: string;
  trackingNumber: string;
  carrierCode?: string;
  snapshot: ParcelTrackingSnapshot;
  occurredAt: string;
}

/**
 * Provider-neutral parcel shipping boundary.
 *
 * Reading rates/tracking is non-mutating. Purchasing or voiding labels is
 * consequential and must be called only from the owning Commerce/Action Core
 * governed path. Implementations do not grant themselves authorization.
 */
export interface ParcelShippingAdapter {
  readonly provider: string;
  getRates(request: ParcelRateRequest): Promise<ParcelRateQuote[]>;
  purchaseLabel(request: ParcelLabelPurchaseRequest): Promise<ParcelLabel>;
  voidLabel(labelId: string, idempotencyKey: string): Promise<ParcelLabelVoidResult>;
  getTracking(trackingNumber: string, carrierCode?: string): Promise<ParcelTrackingSnapshot>;
  normalizeTrackingWebhook(
    payload: unknown,
    verification: ParcelWebhookVerification,
  ): ParcelTrackingWebhook;
}

export function assertParcelRateRequest(request: ParcelRateRequest): void {
  if (!request.orderId.trim()) throw new Error("orderId is required");
  if (!request.shipmentId.trim()) throw new Error("shipmentId is required");
  assertAddress(request.shipFrom, "shipFrom");
  assertAddress(request.shipTo, "shipTo");
  if (request.packages.length === 0) throw new Error("At least one parcel package is required");
  for (const item of request.packages) assertPackage(item);
}

export function assertParcelLabelPurchaseRequest(request: ParcelLabelPurchaseRequest): void {
  if (!request.orderId.trim()) throw new Error("orderId is required");
  if (!request.shipmentId.trim()) throw new Error("shipmentId is required");
  if (!request.rateId.trim()) throw new Error("rateId is required");
  if (!request.idempotencyKey.trim()) throw new Error("idempotencyKey is required");
}

export function parcelLabelIdempotencyKey(orderId: string, shipmentId: string): string {
  const order = orderId.trim();
  const shipment = shipmentId.trim();
  if (!order || !shipment) throw new Error("orderId and shipmentId are required");
  return `parcel-label:${order}:${shipment}`;
}

function assertAddress(address: ParcelAddress, field: string): void {
  if (!address.name.trim()) throw new Error(`${field}.name is required`);
  if (!address.addressLine1.trim()) throw new Error(`${field}.addressLine1 is required`);
  if (!address.city.trim()) throw new Error(`${field}.city is required`);
  if (!address.postalCode.trim()) throw new Error(`${field}.postalCode is required`);
  if (!/^[A-Za-z]{2}$/.test(address.countryCode.trim())) {
    throw new Error(`${field}.countryCode must be a 2-letter country code`);
  }
}

function assertPackage(item: ParcelPackage): void {
  if (!Number.isFinite(item.weight.value) || item.weight.value <= 0) {
    throw new Error("Parcel weight must be greater than zero");
  }
  if (item.dimensions) {
    const { length, width, height } = item.dimensions;
    if (![length, width, height].every((value) => Number.isFinite(value) && value > 0)) {
      throw new Error("Parcel dimensions must be greater than zero");
    }
  }
}
