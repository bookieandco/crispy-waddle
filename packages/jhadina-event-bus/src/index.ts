export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly occurredAt: string;
  readonly payload: TPayload;
}

export type EventHandler<TPayload = unknown> = (event: DomainEvent<TPayload>) => void | Promise<void>;

export interface EventBus {
  publish<TPayload>(event: DomainEvent<TPayload>): Promise<void>;
  subscribe<TPayload>(type: string, handler: EventHandler<TPayload>): () => void;
}

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
    const handlers = [...(this.handlers.get(event.type) ?? [])];
    for (const handler of handlers) {
      await handler(event as DomainEvent<unknown>);
    }
  }
}
