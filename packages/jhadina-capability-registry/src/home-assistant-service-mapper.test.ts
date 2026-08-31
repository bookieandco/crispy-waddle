import { describe, expect, it } from 'node:test';
import { DeterministicHomeAssistantServiceMapper } from './home-assistant-service-mapper.js';

const mapper = new DeterministicHomeAssistantServiceMapper();
const capability = { name: 'homeassistant.light.turn_on', description: 'Turn on', risk: 'write' as const, version: 1, sourceService: 'light.turn_on' };

describe('DeterministicHomeAssistantServiceMapper', () => {
  it('maps a canonical capability to an HA service call', () => {
    expect(mapper.map({ capability: capability.name, deviceId: 'ha:device:lamp', entityId: 'ha:entity:light.lamp', data: { brightness_pct: 50 } }, [capability])).toEqual({
      domain: 'light', service: 'turn_on', target: { entity_id: 'light.lamp' }, data: { brightness_pct: 50 },
    });
  });

  it('rejects capabilities not advertised by the entity', () => {
    expect(() => mapper.map({ capability: 'homeassistant.light.turn_off', deviceId: 'ha:device:lamp', entityId: 'ha:entity:light.lamp' }, [capability])).toThrow('capability-not-supported-by-entity');
  });

  it('rejects unsupported service data instead of forwarding arbitrary input', () => {
    expect(() => mapper.map({ capability: capability.name, deviceId: 'ha:device:lamp', entityId: 'ha:entity:light.lamp', data: { token: 'secret' } }, [capability])).toThrow('unsupported-service-data:token');
  });
});
