import type { EventBus, DomainEvent } from '@jhadina/event-bus';
import type { CanonicalHomeStateEvent } from './home-assistant-state-events.js';

export interface HomeAssistantEventPublisher {
  publishStateChanged(event: CanonicalHomeStateEvent): Promise<void>;
}

/** Thin adapter: HA-specific events become generic Jhadina domain events. */
export class EventBusHomeAssistantEventPublisher implements HomeAssistantEventPublisher {
  constructor(private readonly eventBus: EventBus) {}

  async publishStateChanged(event: CanonicalHomeStateEvent): Promise<void> {
    const domainEvent: DomainEvent<CanonicalHomeStateEvent> = Object.freeze({
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      payload: event,
    });
    await this.eventBus.publish(domainEvent);
  }
}
