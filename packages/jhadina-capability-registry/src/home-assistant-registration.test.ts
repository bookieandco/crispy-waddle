import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HomeAssistantDeviceRegistry } from './home-assistant-device-registry.js';
import { registerHomeAssistantDevice } from './home-assistant-registration.js';

describe('Home Assistant registration boundary', () => {
  it('normalizes and registers device configuration', () => {
    const registry = new HomeAssistantDeviceRegistry();
    const device = registerHomeAssistantDevice(registry, {
      deviceId: ' tv-1 ',
      entityId: ' media_player.living_room_tv ',
      baseUrl: 'http://ha.local/',
    });
    assert.deepEqual(device, {
      deviceId: 'tv-1',
      entityId: 'media_player.living_room_tv',
      baseUrl: 'http://ha.local',
    });
    assert.deepEqual(registry.get('tv-1'), device);
  });
});
