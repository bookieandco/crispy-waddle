export type AdapterStatus = "pending" | "active" | "degraded" | "revoked";
export type ProductStatus = "active" | "inactive" | "restricted";
export type InventoryAvailability = "available" | "reserved" | "unavailable";

export interface MerchantConnection {
  connectionId: string;
  merchantId: string;
  provider: string;
  providerAccountId: string;
  status: AdapterStatus;
  capabilities: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ExternalReference {
  provider: string;
  externalId: string;
  externalVersion?: string;
}

export interface NormalizedProduct {
  productId: string;
  merchantId: string;
  name: string;
  brand?: string;
  category: string;
  description?: string;
  sku?: string;
  unitOfMeasure?: string;
  status: ProductStatus;
  external: ExternalReference;
  metadata?: Record<string, string>;
}

export interface InventoryItem {
  inventoryId: string;
  merchantId: string;
  productId: string;
  locationId: string;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  unitPrice?: { amountMinor: number; currency: string };
  availability: InventoryAvailability;
  batchId?: string;
  packageId?: string;
  expiresAt?: string;
  external: ExternalReference;
  observedAt: string;
}

export interface InventoryReservation {
  reservationId: string;
  merchantId: string;
  productId: string;
  locationId: string;
  quantity: number;
  status: "requested" | "reserved" | "released" | "expired" | "failed";
  orderId: string;
  external?: ExternalReference;
  expiresAt?: string;
}

export interface NormalizedOrderLine {
  productId: string;
  quantity: number;
  unitPrice: { amountMinor: number; currency: string };
  externalProductId?: string;
}

export interface NormalizedOrder {
  orderId: string;
  merchantId: string;
  locationId: string;
  lines: NormalizedOrderLine[];
  total: { amountMinor: number; currency: string };
  status: "draft" | "confirmed" | "fulfilled" | "cancelled";
  external?: ExternalReference;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryAdapter {
  readonly name: string;
  connect(connection: MerchantConnection): Promise<void>;
  getProducts(merchantId: string, cursor?: string): Promise<{ items: NormalizedProduct[]; nextCursor?: string }>;
  getInventory(merchantId: string, locationId?: string, cursor?: string): Promise<{ items: InventoryItem[]; nextCursor?: string }>;
  reserveInventory(request: {
    merchantId: string;
    orderId: string;
    locationId: string;
    lines: Array<{ productId: string; quantity: number }>;
    expiresAt?: string;
    idempotencyKey: string;
  }): Promise<InventoryReservation[]>;
  releaseReservation(reservationId: string, idempotencyKey: string): Promise<InventoryReservation>;
  getReservation(reservationId: string): Promise<InventoryReservation>;
}

export interface POSAdapter {
  readonly name: string;
  connect(connection: MerchantConnection): Promise<void>;
  getCatalog(merchantId: string, cursor?: string): Promise<{ items: NormalizedProduct[]; nextCursor?: string }>;
  getOrder(orderId: string): Promise<NormalizedOrder>;
  createOrder(request: {
    merchantId: string;
    locationId: string;
    lines: NormalizedOrderLine[];
    externalCustomerId?: string;
    idempotencyKey: string;
  }): Promise<NormalizedOrder>;
  cancelOrder(orderId: string, idempotencyKey: string): Promise<NormalizedOrder>;
  confirmFulfillment(orderId: string, idempotencyKey: string): Promise<NormalizedOrder>;
}

export interface AdapterFactory {
  createPOS(connection: MerchantConnection): POSAdapter;
  createInventory(connection: MerchantConnection): InventoryAdapter;
}

export interface AdapterWebhookEvent {
  provider: string;
  connectionId: string;
  eventId: string;
  eventType: string;
  occurredAt: string;
  externalAggregateId: string;
  payload: unknown;
  signature?: string;
}

export function availableQuantity(item: Pick<InventoryItem, "quantity" | "reservedQuantity">): number {
  return Math.max(0, item.quantity - item.reservedQuantity);
}

export function assertPositiveQuantity(quantity: number): void {
  if (!Number.isFinite(quantity) || quantity <= 0) {
    throw new Error("Quantity must be greater than zero");
  }
}

export const COMMERCE_ADAPTER_CONTRACT_VERSION = "0.1.0" as const;

export * from "./supplier-procurement";
