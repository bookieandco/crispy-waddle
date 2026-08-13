export type DeliveryStatus =
  | "dispatch_pending"
  | "assigned"
  | "en_route_to_merchant"
  | "arrived_at_merchant"
  | "handoff_pending"
  | "in_transit"
  | "arrived_at_customer"
  | "delivered"
  | "failed"
  | "cancelled";

export interface Courier {
  courierId: string;
  provider: string;
  status: "available" | "busy" | "offline" | "suspended";
  capabilities: string[];
  serviceAreaIds: string[];
}

export interface DeliveryJob {
  deliveryId: string;
  orderId: string;
  manifestId: string;
  merchantLocationId: string;
  customerDeliveryZoneId: string;
  courierId?: string;
  provider?: string;
  status: DeliveryStatus;
  estimatedPickupAt?: string;
  estimatedDeliveryAt?: string;
  assignedAt?: string;
  deliveredAt?: string;
  policyVersion: string;
}

export interface DispatchRequest {
  deliveryId: string;
  orderId: string;
  manifestId: string;
  pickupLocationId: string;
  deliveryZoneId: string;
  requiredCapabilities: string[];
  idempotencyKey: string;
}

export interface DispatchResult {
  deliveryId: string;
  provider: string;
  providerReference?: string;
  courierId: string;
  estimatedPickupAt?: string;
  estimatedDeliveryAt?: string;
}

export interface CourierFleetAdapter {
  readonly provider: string;
  dispatch(request: DispatchRequest): Promise<DispatchResult>;
  cancel(deliveryId: string, reason: string): Promise<void>;
  getStatus(deliveryId: string): Promise<DeliveryJob>;
  acknowledgeMerchantArrival(deliveryId: string): Promise<void>;
  confirmHandoff(input: {
    deliveryId: string;
    manifestId: string;
    courierId: string;
    evidenceIds: string[];
    idempotencyKey: string;
  }): Promise<{ deliveryId: string; status: "in_transit" }>;
  confirmDelivery(input: {
    deliveryId: string;
    evidenceIds: string[];
    deliveredAt: string;
    idempotencyKey: string;
  }): Promise<{ deliveryId: string; status: "delivered" }>;
}

export interface RouteEstimate {
  distanceMeters: number;
  durationSeconds: number;
  estimatedArrivalAt?: string;
}

export interface RoutingAdapter {
  estimate(input: {
    pickupLocationId: string;
    deliveryZoneId: string;
  }): Promise<RouteEstimate>;
}

export interface DeliveryEvent {
  eventId: string;
  deliveryId: string;
  orderId: string;
  type:
    | "DISPATCHED"
    | "COURIER_ASSIGNED"
    | "MERCHANT_ARRIVAL"
    | "CUSTODY_TRANSFERRED"
    | "DELIVERY_STARTED"
    | "CUSTOMER_ARRIVAL"
    | "DELIVERY_COMPLETED"
    | "DELIVERY_FAILED"
    | "DELIVERY_CANCELLED";
  occurredAt: string;
  actorId?: string;
  provider?: string;
  evidenceIds: string[];
  metadata?: Record<string, string>;
}

export interface DeliveryEventStore {
  append(event: DeliveryEvent): Promise<void>;
}

export interface FleetPolicy {
  jurisdictionId: string;
  policyVersion: string;
  allowedProviders: string[];
  requiredCourierCapabilities: string[];
  deliveryAllowed: boolean;
}

export class CourierDispatchService {
  constructor(
    private readonly adapter: CourierFleetAdapter,
    private readonly events: DeliveryEventStore,
    private readonly policy: FleetPolicy,
  ) {}

  async dispatch(request: DispatchRequest): Promise<DispatchResult> {
    if (!this.policy.deliveryAllowed) {
      throw new Error("Delivery is not allowed by the active jurisdiction policy");
    }
    if (!this.policy.allowedProviders.includes(this.adapter.provider)) {
      throw new Error("Courier provider is not allowed by the active policy");
    }

    const required = new Set(this.policy.requiredCourierCapabilities);
    const requested = new Set(request.requiredCapabilities);
    for (const capability of required) {
      if (!requested.has(capability)) {
        throw new Error(`Missing required courier capability: ${capability}`);
      }
    }

    const result = await this.adapter.dispatch(request);
    await this.events.append({
      eventId: crypto.randomUUID(),
      deliveryId: result.deliveryId,
      orderId: request.orderId,
      type: "DISPATCHED",
      occurredAt: new Date().toISOString(),
      actorId: result.courierId,
      provider: result.provider,
      evidenceIds: [],
      metadata: { policyVersion: this.policy.policyVersion },
    });
    return result;
  }
}

export const COURIER_FLEET_CORE_VERSION = "0.1.0" as const;
