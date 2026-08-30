export type CommerceEventType =
  | "catalog.changed"
  | "inventory.changed"
  | "order.created"
  | "order.updated"
  | "fulfillment.updated"
  | "tracking.updated"
  | "return.created"
  | "refund.updated";

export interface CommerceEvent<TPayload = unknown> {
  eventId: string;
  type: CommerceEventType;
  occurredAt: string;
  sourceProviderId: string;
  resourceType: string;
  resourceId: string;
  payload: TPayload;
  correlationId?: string;
  idempotencyKey?: string;
}

export interface CommerceEventBus {
  publish<TPayload>(event: CommerceEvent<TPayload>): Promise<void>;
  subscribe(
    eventType: CommerceEventType,
    handler: (event: CommerceEvent) => Promise<void>,
  ): Promise<() => Promise<void>>;
}

export interface CommerceReconciliationIssue {
  issueId: string;
  resourceType: string;
  resourceId: string;
  providerId: string;
  detectedAt: string;
  expected?: unknown;
  observed?: unknown;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "resolved" | "ignored";
}

export interface CommerceReconciliationEngine {
  reconcile(resourceType: string, resourceId: string): Promise<CommerceReconciliationIssue[]>;
}
