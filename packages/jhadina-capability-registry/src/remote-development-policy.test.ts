import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry, registerRemoteCapabilities } from './index.js';
import { RemoteDevelopmentPolicy } from './remote-development-policy.js';

describe('RemoteDevelopmentPolicy', () => {
  it('denies by default', async () => {
    const registry = new CapabilityRegistry();
    registerRemoteCapabilities(registry);
    const capability = registry.get('remote.power')!;
    const policy = new RemoteDevelopmentPolicy();
    assert.equal(await policy.authorize({ requestId: 'r1', deviceId: 'tv-1', capability: 'remote.power' }, capability), false);
  });

  it('allows only explicitly registered capability and device pairs', async () => {
    const registry = new CapabilityRegistry();
    registerRemoteCapabilities(registry);
    const capability = registry.get('remote.power')!;
    const policy = new RemoteDevelopmentPolicy({ allowedCapabilities: ['remote.power'], allowedDeviceIds: ['tv-1'] });
    assert.equal(await policy.authorize({ requestId: 'r2', deviceId: 'tv-1', capability: 'remote.power' }, capability), true);
    assert.equal(await policy.authorize({ requestId: 'r3', deviceId: 'tv-2', capability: 'remote.power' }, capability), false);
  });
});
