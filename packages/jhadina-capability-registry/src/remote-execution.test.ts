import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry, registerRemoteCapabilities } from './index.js';
import { ResolvedRemoteCommandExecutor } from './remote-execution.js';

describe('ResolvedRemoteCommandExecutor', () => {
  it('resolves and routes an authorized registered command', async () => {
    const registry = new CapabilityRegistry();
    registerRemoteCapabilities(registry);
    const events: string[] = [];
    const executor = new ResolvedRemoteCommandExecutor(
      registry,
      { authorize: async () => true },
      { resolve: request => ({ ...request, resolved: true }) },
      { resolve: command => command.capability === 'remote.power' ? { execute: async c => events.push(c.capability) } : undefined },
    );
    const result = await executor.execute({ requestId: 'r1', deviceId: 'tv-1', capability: 'remote.power' });
    assert.deepEqual(result, { status: 'accepted', requestId: 'r1' });
    assert.deepEqual(events, ['remote.power']);
  });

  it('rejects when no transport supports the resolved command', async () => {
    const registry = new CapabilityRegistry();
    registerRemoteCapabilities(registry);
    const executor = new ResolvedRemoteCommandExecutor(
      registry,
      { authorize: async () => true },
      { resolve: request => ({ ...request, resolved: true }) },
      { resolve: () => undefined },
    );
    const result = await executor.execute({ requestId: 'r2', deviceId: 'tv-1', capability: 'remote.power' });
    assert.deepEqual(result, { status: 'rejected', requestId: 'r2', reason: 'no-supported-transport' });
  });
});
