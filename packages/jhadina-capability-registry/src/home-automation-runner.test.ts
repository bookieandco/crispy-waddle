import { describe, expect, it, vi } from 'vitest';
import { HomeAutomationRunner } from './home-automation-runner.js';
import type { DomainEvent } from '@jhadina/event-bus';
import type { CanonicalHomeStateEvent } from './home-assistant-state-events.js';
import type { HomeAutomationRule } from './home-automation-rules.js';

const payload: CanonicalHomeStateEvent = {
  id: 'ha-state:binary_sensor.front_door:2026-08-31T12:00:00.000Z', type: 'home.entity.state_changed', occurredAt: '2026-08-31T12:00:00.000Z',
  entityId: 'ha:entity:binary_sensor.front_door', deviceId: 'ha:device:binary_sensor.front_door', state: 'on', previousState: 'off', changed: true,
  provenance: { source: 'home-assistant', sourceEntityId: 'binary_sensor.front_door' },
};
const event: DomainEvent<CanonicalHomeStateEvent> = { id: payload.id, type: payload.type, occurredAt: payload.occurredAt, payload };
const rule: HomeAutomationRule = {
  id: 'front-door-light', version: 1, enabled: true,
  when: { entityId: payload.entityId, state: 'on' },
  then: { capability: 'home.light.turn_on', operation: 'light.turn_on', input: { entityId: 'light.entry' }, reversible: true, consequenceLevel: 'low' },
};

describe('HomeAutomationRunner', () => {
  it('emits proposals for matching rules', async () => {
    const propose = vi.fn(async () => undefined);
    await new HomeAutomationRunner([rule], { propose }).handle(event);
    expect(propose).toHaveBeenCalledOnce();
    expect(propose.mock.calls[0][0]).toMatchObject({ matched: true, ruleId: rule.id, proposal: { action: 'home.light.turn_on' } });
  });

  it('ignores unrelated domain events', async () => {
    const propose = vi.fn(async () => undefined);
    await new HomeAutomationRunner([rule], { propose }).handle({ ...event, type: 'other.event' });
    expect(propose).not.toHaveBeenCalled();
  });

  it('never receives or invokes an action executor', async () => {
    const propose = vi.fn(async () => undefined);
    const runner = new HomeAutomationRunner([rule], { propose });
    await runner.handle(event);
    expect(propose).toHaveBeenCalledTimes(1);
  });
});
