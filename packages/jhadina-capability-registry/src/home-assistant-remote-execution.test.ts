import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry, registerRemoteCapabilities } from './index.js';
import { DeterministicRemoteResolver } from './remote-resolver.js';
import { TransportRouter } from './remote-transport.js';
import { HomeAssistantRemoteTransport } from './home-assistant-remote-transport.js';
import { ResolvedRemoteCommandExecutor } from './remote-execution.js';

describe('Home Assistant remote execution', () => {
  it('routes remote.power through the gateway execution boundary', async () => {
    const registry = new CapabilityRegistry();
    registerRemoteCapabilities(registry);
    let request: Request | undefined;
    const transport = new HomeAssistantRemoteTransport({
      baseUrl: 'http://homeassistant.local',
      entityId: 'media_player.living_room_tv',
      authToken: 'test-token',
      fetchImpl: async (input, init) => {
        request = new Request(input, init);
        return new Response('[]', { status: 200 });
      },
    });
    const executor = new ResolvedRemoteCommandExecutor(
      registry,
      { authorize: async () => true },
      new DeterministicRemoteResolver(registry),
      new TransportRouter([transport]),
    );

    const result = await executor.execute({ requestId: 'ha-1', deviceId: 'tv-1', capability: 'remote.power' });

    assert.deepEqual(result, { status: 'accepted', requestId: 'ha-1' });
    assert.equal(request?.method, 'POST');
    assert.equal(request?.url, 'http://homeassistant.local/api/services/homeassistant/toggle');
    assert.equal(request?.headers.get('authorization'), 'Bearer test-token');
    assert.equal(await request?.text(), JSON.stringify({ entity_id: 'media_player.living_room_tv' }));
  });
});
