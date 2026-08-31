import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HomeAssistantTransportRegistry } from './home-assistant-transport-registry.js';

describe('HomeAssistantTransportRegistry', () => {
  it('stores transport configuration separately from canonical devices', () => {
    const registry = new HomeAssistantTransportRegistry();
    registry.register({
      deviceId: 'tv-1',
      entityId: 'media_player.living_room_tv',
      baseUrl: 'http://homeassistant.local/',
    });
    assert.deepEqual(registry.get('tv-1'), {
      deviceId: 'tv-1',
      entityId: 'media_player.living_room_tv',
      baseUrl: 'http://homeassistant.local',
    });
  });
});
