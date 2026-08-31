import { describe, expect, it } from 'vitest';
import { normalizeHomeAssistantStateChanged } from './home-assistant-state-events.js';

describe('normalizeHomeAssistantStateChanged', () => {
  it('normalizes state changes into canonical Jhadina identifiers', () => {
    const event = normalizeHomeAssistantStateChanged({
      entity_id: 'light.Living_Room',
      old_state: 'off',
      new_state: 'on',
      occurred_at: '2026-08-31T12:00:00Z',
    });

    expect(event.type).toBe('home.entity.state_changed');
    expect(event.entityId).toBe('ha:entity:light.living_room');
    expect(event.deviceId).toBe('ha:device:light.living_room');
    expect(event.previousState).toBe('off');
    expect(event.state).toBe('on');
    expect(event.changed).toBe(true);
    expect(event.occurredAt).toBe('2026-08-31T12:00:00.000Z');
  });

  it('does not expose arbitrary attributes or transport configuration', () => {
    const event = normalizeHomeAssistantStateChanged({
      entity_id: 'sensor.temperature',
      new_state: 24,
      attributes: { baseUrl: 'https://internal.invalid', token: 'secret' },
    });

    expect(event).not.toHaveProperty('attributes');
    expect(JSON.stringify(event)).not.toContain('internal.invalid');
    expect(JSON.stringify(event)).not.toContain('secret');
  });

  it('rejects invalid entity identifiers', () => {
    expect(() => normalizeHomeAssistantStateChanged({
      entity_id: 'invalid entity',
      new_state: 'on',
    })).toThrow('invalid-home-assistant-entity-id');
  });
});
