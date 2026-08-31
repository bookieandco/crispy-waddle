import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HomeAssistantDeviceRegistry } from './home-assistant-device-registry.js';
import { HomeAssistantRemoteTransport } from './home-assistant-remote-transport.js';

describe('HomeAssistantRemoteTransport device routing', () => {
  it('uses the registered device endpoint and entity', async () => {
    const devices = new HomeAssistantDeviceRegistry();
    devices.register({ deviceId: 'tv-2', entityId: 'media_player.bedroom_tv', baseUrl: 'http://ha-bedroom' });
    let request: Request | undefined;
    const transport = new HomeAssistantRemoteTransport({
      authToken: 'token',
      fetchImpl: async (input, init) => {
        request = new Request(input, init);
        return new Response('[]', { status: 200 });
      },
    }, devices);

    await transport.execute({ requestId: 'r1', deviceId: 'tv-2', capability: 'remote.power', resolved: true });
    assert.equal(request?.url, 'http://ha-bedroom/api/services/homeassistant/toggle');
    assert.equal(await request?.text(), JSON.stringify({ entity_id: 'media_player.bedroom_tv' }));
  });

  it('does not support an unregistered device', () => {
    const devices = new HomeAssistantDeviceRegistry();
    const transport = new HomeAssistantRemoteTransport({ authToken: 'token' }, devices);
    assert.equal(transport.supports({ requestId: 'r2', deviceId: 'missing', capability: 'remote.power', resolved: true }), false);
  });
});
