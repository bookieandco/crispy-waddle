import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry, registerRemoteCapabilities } from './index.js';
import { DeterministicRemoteResolver } from './remote-resolver.js';
import { TransportRouter, type RemoteTransport } from './remote-transport.js';
import { ResolvedRemoteCommandExecutor } from './remote-execution.js';

describe('remote execution integration', () => {
  it('routes an authorized registered command through resolver and transport', async () => {
    const registry = new CapabilityRegistry();
    registerRemoteCapabilities(registry);
    const seen: string[] = [];
    const transport: RemoteTransport = {
      kind: 'in-memory',
      supports: command => command.capability === 'remote.power',
      execute: async command => { seen.push(`${command.deviceId}:${command.capability}`); },
    };
    const executor = new ResolvedRemoteCommandExecutor(
      registry,
      { authorize: async () => true },
      new DeterministicRemoteResolver(registry),
      new TransportRouter([transport]),
    );

    const result = await executor.execute({
      requestId: 'integration-1',
      deviceId: 'tv-1',
      capability: 'remote.power',
    });

    assert.deepEqual(result, { status: 'accepted', requestId: 'integration-1' });
    assert.deepEqual(seen, ['tv-1:remote.power']);
  });

  it('does not execute when policy denies', async () => {
    const registry = new CapabilityRegistry();
    registerRemoteCapabilities(registry);
    let executed = false;
    const transport: RemoteTransport = {
      kind: 'in-memory',
      supports: () => true,
      execute: async () => { executed = true; },
    };
    const executor = new ResolvedRemoteCommandExecutor(
      registry,
      { authorize: async () => false },
      new DeterministicRemoteResolver(registry),
      new TransportRouter([transport]),
    );

    const result = await executor.execute({ requestId: 'integration-2', deviceId: 'tv-1', capability: 'remote.power' });

    assert.equal(result.status, 'rejected');
    assert.equal(executed, false);
  });
});
