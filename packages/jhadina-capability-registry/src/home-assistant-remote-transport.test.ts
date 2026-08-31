import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { HomeAssistantRemoteTransport } from './home-assistant-remote-transport.js';

describe('HomeAssistantRemoteTransport', () => {
  it('maps remote.power to a Home Assistant toggle service call', async () => {
    let url = '';
    let init: RequestInit | undefined;
    const transport = new HomeAssistantRemoteTransport({
      baseUrl: 'http://ha.local/',
      entityId: 'media_player.tv',
      authToken: 'test-token',
      fetchImpl: async (input, options) => {
        url = String(input);
        init = options;
        return new Response('[]', { status: 200 });
      },
    });

    assert.equal(transport.supports({ requestId: '1', deviceId: 'tv', capability: 'remote.power', resolved: true }), true);
    await transport.execute({ requestId: '1', deviceId: 'tv', capability: 'remote.power', resolved: true });

    assert.equal(url, 'http://ha.local/api/services/homeassistant/toggle');
    assert.equal(init?.method, 'POST');
    assert.equal((init?.headers as Record<string, string>).Authorization, 'Bearer test-token');
    assert.deepEqual(JSON.parse(String(init?.body)), { entity_id: 'media_player.tv' });
  });

  it('rejects non-power capabilities', async () => {
    const transport = new HomeAssistantRemoteTransport({
      baseUrl: 'http://ha.local', entityId: 'media_player.tv', authToken: 'test-token',
    });
    assert.equal(transport.supports({ requestId: '1', deviceId: 'tv', capability: 'remote.volume.up', resolved: true }), false);
  });
});
