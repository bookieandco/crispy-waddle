import type { JhadinaEvent } from './contracts';

export type EventHandler<TPayload = unknown> = (event: JhadinaEvent<TPayload>) => void | Promise<void>;

export interface EventBus {
  publish<TPayload>(event: JhadinaEvent<TPayload>): Promise<void>;
  subscribe<TPayload>(type: string, handler: EventHandler<TPayload>): () => void;
}

export class InMemoryEventBus implements EventBus {
  private readonly handlers = new Map<string, Set<EventHandler>>();

  async publish<TPayload>(event: JhadinaEvent<TPayload>): Promise<void> {
    const subscribers = [...(this.handlers.get(event.type) ?? [])];
    await Promise.all(subscribers.map((handler) => handler(event)));
  }

  subscribe<TPayload>(type: string, handler: EventHandler<TPayload>): () => void {
    const subscribers = this.handlers.get(type) ?? new Set<EventHandler>();
    subscribers.add(handler as EventHandler);
    this.handlers.set(type, subscribers);
    return () => subscribers.delete(handler as EventHandler);
  }
}
