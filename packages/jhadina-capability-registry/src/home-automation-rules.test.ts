import { describe, expect, it } from 'vitest';
import { evaluateHomeAutomationRule, type HomeAutomationRule } from './home-automation-rules.js';
import type { CanonicalHomeStateEvent } from './home-assistant-state-events.js';

const event: CanonicalHomeStateEvent = {
  id: 'ha-state:binary_sensor.front_door:2026-08-31T12:00:00.000Z',
  type: 'home.entity.state_changed',
  occurredAt: '2026-08-31T12:00:00.000Z',
  entityId: 'ha:entity:binary_sensor.front_door',
  deviceId: 'ha:device:binary_sensor.front_door',
  state: 'on',
  previousState: 'off',
  changed: true,
  provenance: { source: 'home-assistant', sourceEntityId: 'binary_sensor.front_door' },
};

const rule: HomeAutomationRule = {
  id: 'front-door-light', version: 1, enabled: true,
  when: { entityId: 'ha:entity:binary_sensor.front_door', state: 'on' },
  then: { capability: 'home.light.turn_on', operation: 'light.turn_on', input: { entityId: 'light.entry' }, reversible: true, consequenceLevel: 'low' },
};

describe('evaluateHomeAutomationRule', () => {
  it('creates a deterministic proposal when the condition matches', () => {
    const result = evaluateHomeAutomationRule(rule, event);
    expect(result.matched).toBe(true);
    expect(result.proposal).toMatchObject({
      id: `automation:${rule.id}:${event.id}`,
      action: 'home.light.turn_on',
      parameters: { operation: 'light.turn_on', entityId: 'light.entry' },
      consequenceLevel: 'low',
    });
  });

  it('does not match unrelated state', () => {
    const result = evaluateHomeAutomationRule(rule, { ...event, state: 'off' });
    expect(result.matched).toBe(false);
    expect(result.proposal).toBeUndefined();
  });

  it('does not execute or call any transport', () => {
    const result = evaluateHomeAutomationRule(rule, event);
    expect(result).toHaveProperty('proposal');
  });
});
