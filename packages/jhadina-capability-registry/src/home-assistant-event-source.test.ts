import { describe, expect, it, vi } from 'vitest';
import { HomeAssistantStateEventIngestor, type HomeAssistantEventSource } from './home-assistant-event-source.js';
import type { HomeAssistantEventPublisher } from './home-assistant-event-publisher.js';

describe('HomeAssistantStateEventIngestor', () => {
  it('normalizes source events and publishes canonical events', async () => {
    let handler: ((input: any) => void | Promise<void>) | undefined;
    const source: HomeAssistantEventSource = { subscribe: (next) => { handler = next; return () => { handler = undefined; }; } };
    const publishStateChanged = vi.fn(async () => undefined);
    const publisher: HomeAssistantEventPublisher = { publishStateChanged };
    const ingestor = new HomeAssistantStateEventIngestor(source, publisher);

    const unsubscribe = ingestor.start();
    await handler?.({ entity_id: 'light.Living_Room', old_state: 'off', new_state: 'on', occurred_at: '2026-08-31T12:00:00Z' });

    expect(publishStateChanged).toHaveBeenCalledOnce();
    expect(publishStateChanged.mock.calls[0][0]).toMatchObject({
      type: 'home.entity.state_changed',
      entityId: 'ha:entity:light.living_room',
      state: 'on',
      previousState: 'off',
    });

    unsubscribe();
    expect(handler).toBeUndefined();
  });
});
