import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry, registerRemoteCapabilities } from './index.js';
import { RemoteCommandGateway } from './remote-command-gateway.js';

describe('RemoteCommandGateway', () => {
  function setup(allowed = true) {
    const registry = new CapabilityRegistry();
    registerRemoteCapabilities(registry);
    const calls: string[] = [];
    const gateway = new RemoteCommandGateway(
      registry,
      { authorize: async () => allowed },
      { execute: async request => { calls.push(request.capability); } },
    );
    return { gateway, calls };
  }

  it('rejects unknown capabilities before execution', async () => {
    const { gateway, calls } = setup();
    const result = await gateway.dispatch({ requestId: 'r1', deviceId: 'tv-1', capability: 'remote.nope' });
    assert.equal(result.status, 'rejected');
    assert.equal((result as { reason: string }).reason, 'unknown-capability');
    assert.deepEqual(calls, []);
  });

  it('rejects policy-denied commands before execution', async () => {
    const { gateway, calls } = setup(false);
    const result = await gateway.dispatch({ requestId: 'r2', deviceId: 'tv-1', capability: 'remote.power' });
    assert.equal(result.status, 'rejected');
    assert.equal((result as { reason: string }).reason, 'policy-denied');
    assert.deepEqual(calls, []);
  });

  it('executes only an authorized registered capability', async () => {
    const { gateway, calls } = setup();
    const result = await gateway.dispatch({ requestId: 'r3', deviceId: 'tv-1', capability: 'remote.power' });
    assert.deepEqual(result, { status: 'accepted', requestId: 'r3' });
    assert.deepEqual(calls, ['remote.power']);
  });
});
