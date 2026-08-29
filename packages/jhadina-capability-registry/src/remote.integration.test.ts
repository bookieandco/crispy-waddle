import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry } from './index.js';
import { registerRemoteCapabilities } from './remote-capabilities.js';
import { RemoteDeviceRegistry, RemoteTransportResolver, type RemoteTransport } from './remote.js';
import { RemoteCommandExecutor } from './remote-executor.js';

describe('remote control integration', () => {
  it('executes through the canonical registry, resolver, and fallback chain', async () => {
    const capabilities = new CapabilityRegistry();
    registerRemoteCapabilities(capabilities);

    const devices = new RemoteDeviceRegistry();
    devices.register({
      id: 'tv-1', name: 'Living Room TV', transports: ['wifi', 'ir'], capabilities: ['remote.power'],
    });

    const attempts: string[] = [];
    const wifi: RemoteTransport = {
      kind: 'wifi', priority: 20,
      supports: () => true,
      execute: async command => {
        attempts.push('wifi');
        return { success: false, capability: command.capability, deviceId: command.deviceId, transport: 'wifi', attempts: 1, error: { code: 'TIMEOUT', message: 'Wi-Fi timed out' } };
      },
    };
    const ir: RemoteTransport = {
      kind: 'ir', priority: 10,
      supports: () => true,
      execute: async command => {
        attempts.push('ir');
        return { success: true, capability: command.capability, deviceId: command.deviceId, transport: 'ir', attempts: 1 };
      },
    };

    const resolver = new RemoteTransportResolver(capabilities, devices, [ir, wifi]);
    const executor = new RemoteCommandExecutor(command => resolver.resolve(command));
    const result = await executor.execute({ capability: 'remote.power', deviceId: 'tv-1' });

    assert.equal(capabilities.has('remote.power'), true);
    assert.equal(result.success, true);
    assert.equal(result.transport, 'ir');
    assert.equal(result.attempts, 2);
    assert.deepEqual(attempts, ['wifi', 'ir']);
  });
});
