export interface ListingProvider {
  readonly providerId: string;
  createListing(input: CreateListingInput): Promise<ListingResult>;
  updateListing?(listingId: string, input: UpdateListingInput): Promise<ListingResult>;
  getListing?(listingId: string): Promise<ListingResult | null>;
}

export interface InventoryProvider {
  readonly providerId: string;
  getInventory(productId: string): Promise<InventorySnapshot>;
  reserve?(input: InventoryReservation): Promise<InventoryReservationResult>;
  release?(reservationId: string): Promise<InventoryReservationResult>;
}

export interface OrderProvider {
  readonly providerId: string;
  getOrder(orderId: string): Promise<OrderSnapshot | null>;
  createOrder?(input: CreateOrderInput): Promise<OrderSnapshot>;
  cancelOrder?(orderId: string): Promise<OrderSnapshot>;
}

export interface FulfillmentProvider {
  readonly providerId: string;
  fulfill(input: FulfillmentRequest): Promise<FulfillmentResult>;
  getFulfillment?(fulfillmentId: string): Promise<FulfillmentResult | null>;
}

export interface TrackingProvider {
  readonly providerId: string;
  track(input: TrackingRequest): Promise<TrackingSnapshot>;
}

export interface CreateListingInput {
  productId: string;
  title: string;
  description?: string;
  price: number;
  currency: string;
  quantity?: number;
  images?: string[];
}

export interface UpdateListingInput {
  title?: string;
  description?: string;
  price?: number;
  quantity?: number;
}

export interface ListingResult {
  listingId: string;
  providerId: string;
  status: "draft" | "active" | "paused" | "ended";
  url?: string;
}

export interface InventorySnapshot {
  productId: string;
  available: number;
  reserved?: number;
  observedAt: string;
}

export interface InventoryReservation {
  productId: string;
  quantity: number;
  idempotencyKey: string;
}

export interface InventoryReservationResult {
  reservationId: string;
  status: "reserved" | "released" | "failed";
}

export interface CreateOrderInput {
  opportunityId?: string;
  productId: string;
  quantity: number;
  idempotencyKey: string;
}

export interface OrderSnapshot {
  orderId: string;
  status: "pending" | "paid" | "processing" | "fulfilled" | "cancelled" | "refunded";
  updatedAt: string;
}

export interface FulfillmentRequest {
  orderId: string;
  idempotencyKey: string;
}

export interface FulfillmentResult {
  fulfillmentId: string;
  orderId: string;
  status: "pending" | "processing" | "fulfilled" | "failed";
  trackingNumber?: string;
  carrier?: string;
}

export interface TrackingRequest {
  trackingNumber: string;
  carrier?: string;
}

export interface TrackingSnapshot {
  trackingNumber: string;
  carrier?: string;
  status: "unknown" | "pre_transit" | "in_transit" | "out_for_delivery" | "delivered" | "exception";
  events: TrackingEvent[];
  observedAt: string;
}

export interface TrackingEvent {
  status: string;
  occurredAt: string;
  location?: string;
  description?: string;
}
