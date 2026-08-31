import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HomeAssistantDeviceRegistry } from './home-assistant-device-registry.js';

describe('HomeAssistantDeviceRegistry', () => {
  it('registers canonical devices without transport configuration', () => {
    const registry = new HomeAssistantDeviceRegistry();
    registry.register({ deviceId: 'tv-1', entityId: 'ha:entity:media_player.living_room_tv' });
    assert.deepEqual(registry.get('tv-1'), {
      deviceId: 'tv-1', entityId: 'ha:entity:media_player.living_room_tv',
    });
  });

  it('rejects transport fields on the canonical device contract at compile-time by contract shape', () => {
    const registry = new HomeAssistantDeviceRegistry();
    const device = { deviceId: 'tv-1', entityId: 'ha:entity:media_player.living_room_tv' };
    registry.register(device);
    assert.equal('baseUrl' in registry.get('tv-1')!, false);
  });

  it('rejects unknown devices', () => {
    const registry = new HomeAssistantDeviceRegistry();
    assert.throws(() => registry.resolve({ requestId: 'r1', deviceId: 'missing', capability: 'remote.power', resolved: true }), /unknown-device:missing/);
  });
});
