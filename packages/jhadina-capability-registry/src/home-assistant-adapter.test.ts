import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DeterministicHomeAssistantAdapter } from './home-assistant-adapter.js';

describe('Home Assistant normalization boundary', () => {
  it('normalizes an entity deterministically and derives capabilities from services', () => {
    const adapter = new DeterministicHomeAssistantAdapter();
    const normalized = adapter.normalizeEntity(
      {
        entity_id: ' light.Living_Room ',
        device_id: 'device-42',
        state: 'on',
        attributes: {
          friendly_name: 'Living Room',
          device_class: 'light',
          supported_features: 1,
          unit_of_measurement: '%',
          api_token: 'must-not-escape',
        },
      },
      [
        { domain: 'light', service: 'turn_off' },
        { domain: 'light', service: 'turn_on' },
        { domain: 'switch', service: 'turn_on' },
      ],
    );

    assert.deepEqual(normalized, {
      entityId: 'ha:entity:light.living_room',
      deviceId: 'ha:device:device-42',
      domain: 'light',
      state: 'on',
      available: true,
      friendlyName: 'Living Room',
      deviceClass: 'light',
      unitOfMeasurement: '%',
      supportedFeatures: 1,
      capabilities: [
        {
          name: 'homeassistant.light.turn_off',
          description: 'Home Assistant light.turn_off',
          risk: 'destructive',
          version: 1,
          sourceService: 'light.turn_off',
        },
        {
          name: 'homeassistant.light.turn_on',
          description: 'Home Assistant light.turn_on',
          risk: 'write',
          version: 1,
          sourceService: 'light.turn_on',
        },
      ],
      provenance: {
        source: 'home-assistant',
        sourceEntityId: 'light.Living_Room',
        sourceDeviceId: 'device-42',
        domain: 'light',
      },
    });
    assert.equal(JSON.stringify(normalized).includes('must-not-escape'), false);
  });

  it('does not create capabilities for an unsupported entity service domain', () => {
    const adapter = new DeterministicHomeAssistantAdapter();
    const normalized = adapter.normalizeEntity(
      { entity_id: 'sensor.temperature', state: 21.5 },
      [{ domain: 'light', service: 'turn_on' }],
    );

    assert.deepEqual(normalized.capabilities, []);
    assert.equal(normalized.available, true);
  });

  it('does not create executable capabilities for unavailable state', () => {
    const adapter = new DeterministicHomeAssistantAdapter();
    const normalized = adapter.normalizeEntity(
      { entity_id: 'switch.patio', state: 'unavailable' },
      [{ domain: 'switch', service: 'turn_on' }],
    );

    assert.equal(normalized.available, false);
    assert.equal(normalized.capabilities.length, 1);
  });
});
