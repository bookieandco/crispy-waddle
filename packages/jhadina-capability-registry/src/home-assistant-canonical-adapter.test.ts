import { describe, expect, it } from 'node:test';
import { DeterministicHomeAssistantCanonicalAdapter } from './home-assistant-canonical-adapter.js';

describe('DeterministicHomeAssistantCanonicalAdapter', () => {
  it('maps the existing HA adapter output into the canonical entity model', () => {
    const adapter = new DeterministicHomeAssistantCanonicalAdapter();
    const entity = adapter.normalizeEntity(
      {
        entity_id: 'light.living_room',
        device_id: 'lamp-1',
        state: 'on',
        attributes: { friendly_name: 'Living Room' },
      },
      [{ domain: 'light', service: 'turn_on' }],
    );

    expect(entity).toEqual({
      entityId: 'ha:entity:light.living_room',
      deviceId: 'ha:device:lamp-1',
      domain: 'light',
      state: 'on',
      availability: 'available',
      friendlyName: 'Living Room',
      deviceClass: null,
      unitOfMeasurement: null,
      supportedFeatures: null,
    });
  });

  it('builds one canonical device from multiple entities without transport data', () => {
    const adapter = new DeterministicHomeAssistantCanonicalAdapter();
    const model = adapter.normalizeModel(
      [
        { entity_id: 'light.a', device_id: 'device-1', state: 'on' },
        { entity_id: 'sensor.b', device_id: 'device-1', state: 21 },
      ],
      [],
    );

    expect(model.devices).toEqual([{
      deviceId: 'ha:device:device-1',
      name: null,
      manufacturer: null,
      model: null,
      entities: ['ha:entity:light.a', 'ha:entity:sensor.b'],
      provenance: { source: 'home-assistant', sourceDeviceId: 'device-1' },
    }]);
    expect(model.entities.map(entity => entity.entityId)).toEqual([
      'ha:entity:light.a',
      'ha:entity:sensor.b',
    ]);
    expect(JSON.stringify(model)).not.toContain('baseUrl');
  });
});
