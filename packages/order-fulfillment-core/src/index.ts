export type OrderStatus =
  | "created"
  | "authorized"
  | "accepted"
  | "picking"
  | "ready_for_handoff"
  | "handed_to_courier"
  | "in_transit"
  | "delivered"
  | "failed"
  | "cancelled";

export type CustodyStatus = "merchant_control" | "handoff_pending" | "courier_control" | "delivered" | "exception";

export interface FulfillmentItem {
  orderItemId: string;
  productId: string;
  quantity: number;
  merchantId: string;
  locationId: string;
  reservationId: string;
  externalProductId?: string;
}

export interface Order {
  orderId: string;
  checkoutId: string;
  customerId: string;
  merchantId: string;
  locationId: string;
  status: OrderStatus;
  items: FulfillmentItem[];
  paymentId: string;
  policyVersion: string;
  jurisdictionId: string;
  custodyStatus: CustodyStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MerchantOrderAdapter {
  createOrder(input: {
    orderId: string;
    merchantId: string;
    locationId: string;
    items: FulfillmentItem[];
    idempotencyKey: string;
  }): Promise<{ externalOrderId?: string }>;
  acceptOrder(orderId: string): Promise<void>;
  markPicking(orderId: string): Promise<void>;
  markReady(orderId: string): Promise<void>;
  cancelOrder(orderId: string, reason: string): Promise<void>;
}

export interface Manifest {
  manifestId: string;
  orderId: string;
  merchantId: string;
  locationId: string;
  courierId?: string;
  status: "created" | "sealed" | "handoff_ready" | "handed_over" | "voided";
  policyVersion: string;
  createdAt: string;
  sealedAt?: string;
}

export interface ManifestAdapter {
  create(input: {
    manifestId: string;
    orderId: string;
    merchantId: string;
    locationId: string;
    policyVersion: string;
  }): Promise<Manifest>;
  seal(manifestId: string): Promise<Manifest>;
  assignCourier(manifestId: string, courierId: string): Promise<Manifest>;
  handoff(manifestId: string, input: { courierId: string; verifiedAt: string }): Promise<Manifest>;
  void(manifestId: string, reason: string): Promise<Manifest>;
}

export interface CustodyEvent {
  eventId: string;
  orderId: string;
  manifestId: string;
  from: CustodyStatus;
  to: CustodyStatus;
  actorType: "merchant" | "courier" | "system";
  actorId?: string;
  occurredAt: string;
  policyVersion: string;
  evidence?: string[];
}

export interface CustodyLedger {
  append(event: CustodyEvent): Promise<void>;
  list(orderId: string): Promise<CustodyEvent[]>;
}

export interface FulfillmentPolicy {
  jurisdictionId: string;
  policyVersion: string;
  merchantMayFulfill: boolean;
  courierHandoffAllowed: boolean;
  deliveryAllowed: boolean;
  requiredHandoffEvidence: string[];
}

export interface PolicyGate {
  evaluate(input: {
    action: "accept" | "pick" | "handoff" | "deliver" | "cancel";
    order: Order;
    policy: FulfillmentPolicy;
  }): Promise<{ allowed: boolean; reason?: string }>;
}

export interface FulfillmentOrchestratorDeps {
  merchant: MerchantOrderAdapter;
  manifests: ManifestAdapter;
  custody: CustodyLedger;
  policy: PolicyGate;
  now?: () => Date;
}

export class FulfillmentOrchestrator {
  constructor(private readonly deps: FulfillmentOrchestratorDeps) {}

  async create(order: Order, policy: FulfillmentPolicy): Promise<Manifest> {
    const gate = await this.deps.policy.evaluate({ action: "accept", order, policy });
    if (!gate.allowed) throw new Error(gate.reason ?? "Fulfillment not authorized");

    await this.deps.merchant.createOrder({
      orderId: order.orderId,
      merchantId: order.merchantId,
      locationId: order.locationId,
      items: order.items,
      idempotencyKey: `order:${order.orderId}`,
    });
    await this.deps.merchant.acceptOrder(order.orderId);

    const manifest = await this.deps.manifests.create({
      manifestId: `mf_${order.orderId}`,
      orderId: order.orderId,
      merchantId: order.merchantId,
      locationId: order.locationId,
      policyVersion: policy.policyVersion,
    });

    await this.deps.custody.append({
      eventId: `custody:${order.orderId}:merchant`,
      orderId: order.orderId,
      manifestId: manifest.manifestId,
      from: "merchant_control",
      to: "merchant_control",
      actorType: "system",
      occurredAt: this.timestamp(),
      policyVersion: policy.policyVersion,
    });

    return manifest;
  }

  async markReady(order: Order, manifestId: string, policy: FulfillmentPolicy): Promise<Manifest> {
    const gate = await this.deps.policy.evaluate({ action: "handoff", order, policy });
    if (!gate.allowed) throw new Error(gate.reason ?? "Handoff not authorized");
    await this.deps.merchant.markPicking(order.orderId);
    await this.deps.merchant.markReady(order.orderId);
    const manifest = await this.deps.manifests.seal(manifestId);
    return this.deps.manifests.assignCourier(manifest.manifestId, "pending");
  }

  async handoff(order: Order, manifestId: string, courierId: string, policy: FulfillmentPolicy): Promise<Manifest> {
    const gate = await this.deps.policy.evaluate({ action: "handoff", order, policy });
    if (!gate.allowed) throw new Error(gate.reason ?? "Handoff not authorized");
    const manifest = await this.deps.manifests.handoff(manifestId, {
      courierId,
      verifiedAt: this.timestamp(),
    });
    await this.deps.custody.append({
      eventId: `custody:${order.orderId}:handoff:${courierId}`,
      orderId: order.orderId,
      manifestId,
      from: "merchant_control",
      to: "courier_control",
      actorType: "courier",
      actorId: courierId,
      occurredAt: this.timestamp(),
      policyVersion: policy.policyVersion,
      evidence: policy.requiredHandoffEvidence,
    });
    return manifest;
  }

  async cancel(order: Order, reason: string, policy: FulfillmentPolicy): Promise<void> {
    const gate = await this.deps.policy.evaluate({ action: "cancel", order, policy });
    if (!gate.allowed) throw new Error(gate.reason ?? "Cancellation not authorized");
    await this.deps.merchant.cancelOrder(order.orderId, reason);
  }

  private timestamp(): string {
    return (this.deps.now ?? (() => new Date()))().toISOString();
  }
}

export const ORDER_FULFILLMENT_CORE_VERSION = "0.1.0" as const;
