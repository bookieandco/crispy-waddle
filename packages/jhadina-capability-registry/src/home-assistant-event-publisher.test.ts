import { describe, expect, it, vi } from 'vitest';
import { EventBusHomeAssistantEventPublisher } from './home-assistant-event-publisher.js';
import type { CanonicalHomeStateEvent } from './home-assistant-state-events.js';

const event: CanonicalHomeStateEvent = {
  id: 'ha-state:light.living_room:2026-08-31T12:00:00.000Z',
  type: 'home.entity.state_changed',
  occurredAt: '2026-08-31T12:00:00.000Z',
  entityId: 'ha:entity:light.living_room',
  deviceId: 'ha:device:light.living_room',
  state: 'on',
  previousState: 'off',
  changed: true,
  provenance: { source: 'home-assistant', sourceEntityId: 'light.living_room' },
};

describe('EventBusHomeAssistantEventPublisher', () => {
  it('publishes the canonical HA event using the generic event envelope', async () => {
    const publish = vi.fn(async () => undefined);
    const publisher = new EventBusHomeAssistantEventPublisher({ publish } as never);

    await publisher.publishStateChanged(event);

    expect(publish).toHaveBeenCalledOnce();
    expect(publish).toHaveBeenCalledWith({
      id: event.id,
      type: event.type,
      occurredAt: event.occurredAt,
      payload: event,
    });
  });

  it('does not create a parallel bus or mutate the canonical payload', async () => {
    const publish = vi.fn(async () => undefined);
    const publisher = new EventBusHomeAssistantEventPublisher({ publish } as never);

    await publisher.publishStateChanged(event);

    const published = publish.mock.calls[0][0] as { payload: CanonicalHomeStateEvent };
    expect(published.payload).toEqual(event);
    expect(published.payload).toBe(event);
  });
});
