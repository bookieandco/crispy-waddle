/**
 * Canonical DomainEvent contract.
 *
 * Required fields (validated by InMemoryEventBus.publish and any durable
 * adapter — events missing these fields are rejected fail-closed):
 *   id          — UUID; unique event identity; used for idempotency
 *   type        — namespaced verb, e.g. "overage.reviewed"
 *   version     — semantic version of the event schema (integer ≥ 1)
 *   occurredAt  — ISO 8601 timestamp of when the event occurred
 *   payload     — event-specific data
 *
 * Optional canonical metadata (carry through to durable stores and outbox):
 *   aggregate     — the aggregate type + id this event belongs to
 *   actor         — the verified identity that caused the event
 *   causationId   — id of the command/request that caused this event
 *   correlationId — id shared across all events in a logical operation
 *   provenance    — source system/process that produced this event
 */
export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly occurredAt: string;
  readonly payload: TPayload;
  /** Aggregate this event belongs to (type + id). */
  readonly aggregate?: { type: string; id: string };
  /** Verified actor identity that caused this event. */
  readonly actor?: string;
  /** ID of the command/request that directly caused this event. */
  readonly causationId?: string;
  /** Shared across all events in one logical operation (saga/workflow). */
  readonly correlationId?: string;
  /** Source system or process that produced this event. */
  readonly provenance?: string;
}

export type EventHandler<TPayload = unknown> = (event: DomainEvent<TPayload>) => void | Promise<void>;

export interface EventBus {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
  subscribe<TPayload>(type: string, handler: EventHandler<TPayload>): () => void;
}

/**
 * In-process, non-durable EventBus.
 *
 * @testOnly / local-dev only — InMemoryEventBus must NOT be used in
 * production composition roots.  Production requires a durable outbox-backed
 * adapter so events survive process restarts and are delivered at-least-once.
 * Tracked in Issue #193.
 */
export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler<unknown>>>();

  subscribe<TPayload>(type: string, handler: EventHandler<TPayload>): () => void {
    const existing = this.handlers.get(type) ?? new Set<EventHandler<unknown>>();
    existing.add(handler as EventHandler<unknown>);
    this.handlers.set(type, existing);
    return () => existing.delete(handler as EventHandler<unknown>);
  }

  async publish<TPayload>(event: DomainEvent<TPayload>): Promise<void> {
    if (!event.id || !event.type || !event.occurredAt) throw new Error('Invalid domain event');
    if (typeof event.version !== 'number' || !Number.isInteger(event.version) || event.version < 1) {
      throw new Error('DomainEvent.version must be a positive integer');
    }
    const handlers = [...(this.handlers.get(event.type) ?? [])];
    for (const handler of handlers) {
      await handler(event as DomainEvent<unknown>);
    }
  }
}
