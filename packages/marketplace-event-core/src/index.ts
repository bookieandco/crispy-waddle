export type MarketplaceEventType =
  | "OFFER_CREATED"
  | "INVENTORY_RESERVED"
  | "INVENTORY_RELEASED"
  | "CHECKOUT_CREATED"
  | "PRICE_CONFIRMED"
  | "PAYMENT_AUTHORIZED"
  | "PAYMENT_CAPTURED"
  | "PAYMENT_REFUNDED"
  | "ORDER_CREATED"
  | "ORDER_CANCELLED"
  | "MANIFEST_CREATED"
  | "COURIER_DISPATCHED"
  | "COURIER_ASSIGNED"
  | "MERCHANT_ARRIVAL"
  | "CUSTODY_TRANSFERRED"
  | "DELIVERY_STARTED"
  | "DELIVERY_COMPLETED"
  | "DELIVERY_FAILED"
  | "COMPLIANCE_CHECKED"
  | "DELIVERY_ALLOWED"
  | "DELIVERY_DENIED"
  | "COMPLIANCE_REVIEW_REQUIRED"
  | "PAYOUT_CREATED"
  | "RECONCILIATION_COMPLETED";

export interface MarketplaceEvent<TPayload = Record<string, unknown>> {
  eventId: string;
  eventType: MarketplaceEventType;
  eventVersion: string;
  occurredAt: string;
  recordedAt: string;
  actor: {
    type: "customer" | "merchant" | "courier" | "platform" | "system" | "provider";
    id?: string;
  };
  jurisdictionId?: string;
  policyVersion?: string;
  correlationId: string;
  causationId?: string;
  idempotencyKey?: string;
  aggregate: {
    type: "offer" | "checkout" | "payment" | "order" | "manifest" | "delivery" | "compliance" | "payout";
    id: string;
  };
  payload: TPayload;
}

export interface EventSubscription {
  subscriptionId: string;
  eventTypes: MarketplaceEventType[];
  consumer: string;
  active: boolean;
}

export interface EventBus {
  publish<TPayload>(event: MarketplaceEvent<TPayload>): Promise<void>;
  subscribe(subscription: EventSubscription, handler: (event: MarketplaceEvent) => Promise<void>): Promise<void>;
}

export interface AuditRecord {
  auditId: string;
  eventId: string;
  eventType: MarketplaceEventType;
  aggregateType: MarketplaceEvent["aggregate"]["type"];
  aggregateId: string;
  occurredAt: string;
  recordedAt: string;
  actorType: MarketplaceEvent["actor"]["type"];
  actorId?: string;
  correlationId: string;
  causationId?: string;
  policyVersion?: string;
  payloadHash: string;
  previousHash?: string;
  sequence: number;
}

export interface AuditLedger {
  append(event: MarketplaceEvent): Promise<AuditRecord>;
  getByAggregate(aggregateType: MarketplaceEvent["aggregate"]["type"], aggregateId: string): Promise<AuditRecord[]>;
  verifyChain(aggregateType: MarketplaceEvent["aggregate"]["type"], aggregateId: string): Promise<{ valid: boolean; brokenAtSequence?: number }>;
}

export class InMemoryEventBus implements EventBus {
  private readonly subscriptions: Array<{ subscription: EventSubscription; handler: (event: MarketplaceEvent) => Promise<void> }> = [];

  async publish<TPayload>(event: MarketplaceEvent<TPayload>): Promise<void> {
    for (const entry of this.subscriptions) {
      if (!entry.subscription.active || !entry.subscription.eventTypes.includes(event.eventType)) continue;
      await entry.handler(event as MarketplaceEvent);
    }
  }

  async subscribe(subscription: EventSubscription, handler: (event: MarketplaceEvent) => Promise<void>): Promise<void> {
    this.subscriptions.push({ subscription, handler });
  }
}

export class InMemoryAuditLedger implements AuditLedger {
  private readonly records: AuditRecord[] = [];
  private readonly sequences = new Map<string, number>();
  private readonly lastHashes = new Map<string, string>();

  async append(event: MarketplaceEvent): Promise<AuditRecord> {
    const key = `${event.aggregate.type}:${event.aggregate.id}`;
    const sequence = (this.sequences.get(key) ?? 0) + 1;
    const previousHash = this.lastHashes.get(key);
    const payloadHash = await sha256(JSON.stringify({ event, previousHash, sequence }));
    const record: AuditRecord = {
      auditId: crypto.randomUUID(),
      eventId: event.eventId,
      eventType: event.eventType,
      aggregateType: event.aggregate.type,
      aggregateId: event.aggregate.id,
      occurredAt: event.occurredAt,
      recordedAt: event.recordedAt,
      actorType: event.actor.type,
      actorId: event.actor.id,
      correlationId: event.correlationId,
      causationId: event.causationId,
      policyVersion: event.policyVersion,
      payloadHash,
      previousHash,
      sequence,
    };
    this.records.push(record);
    this.sequences.set(key, sequence);
    this.lastHashes.set(key, payloadHash);
    return record;
  }

  async getByAggregate(aggregateType: MarketplaceEvent["aggregate"]["type"], aggregateId: string): Promise<AuditRecord[]> {
    return this.records.filter((record) => record.aggregateType === aggregateType && record.aggregateId === aggregateId);
  }

  async verifyChain(aggregateType: MarketplaceEvent["aggregate"]["type"], aggregateId: string): Promise<{ valid: boolean; brokenAtSequence?: number }> {
    const records = await this.getByAggregate(aggregateType, aggregateId);
    let previous: string | undefined;
    for (const record of records) {
      if (record.previousHash !== previous) return { valid: false, brokenAtSequence: record.sequence };
      previous = record.payloadHash;
    }
    return { valid: true };
  }
}

export class AuditedEventBus implements EventBus {
  constructor(private readonly bus: EventBus, private readonly ledger: AuditLedger) {}

  async publish<TPayload>(event: MarketplaceEvent<TPayload>): Promise<void> {
    await this.ledger.append(event as MarketplaceEvent);
    await this.bus.publish(event);
  }

  subscribe(subscription: EventSubscription, handler: (event: MarketplaceEvent) => Promise<void>): Promise<void> {
    return this.bus.subscribe(subscription, handler);
  }
}

async function sha256(value: string): Promise<string> {
  if (typeof crypto !== "undefined" && "subtle" in crypto) {
    const bytes = new TextEncoder().encode(value);
    const digest = await crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  throw new Error("A SHA-256 implementation is required for the audit ledger runtime");
}

export const MARKETPLACE_EVENT_CORE_VERSION = "0.1.0" as const;
