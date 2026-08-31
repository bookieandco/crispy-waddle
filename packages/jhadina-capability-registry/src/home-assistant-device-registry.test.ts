import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HomeAssistantDeviceRegistry } from './home-assistant-device-registry.js';

describe('HomeAssistantDeviceRegistry', () => {
  it('registers and resolves devices deterministically', () => {
    const registry = new HomeAssistantDeviceRegistry();
    registry.register({ deviceId: 'tv-1', entityId: 'media_player.living_room_tv', baseUrl: 'http://homeassistant.local' });
    assert.deepEqual(registry.get('tv-1'), {
      deviceId: 'tv-1', entityId: 'media_player.living_room_tv', baseUrl: 'http://homeassistant.local',
    });
  });

  it('rejects unknown devices', () => {
    const registry = new HomeAssistantDeviceRegistry();
    assert.throws(() => registry.resolve({ requestId: 'r1', deviceId: 'missing', capability: 'remote.power', resolved: true }), /unknown-device:missing/);
  });
});
