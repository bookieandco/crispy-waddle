import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  RemoteCapabilityRegistry,
  RemoteDeviceRegistry,
  RemoteTransportResolver,
  type RemoteCapability,
  type RemoteDevice,
  type RemoteTransport,
} from './index.js';

const device: RemoteDevice = {
  id: 'tv-1',
  name: 'Living Room TV',
  transports: ['wifi', 'ir'],
  capabilities: ['remote.power', 'remote.volume.up'],
};

function transport(kind: 'wifi' | 'ir', priority: number, supported: RemoteCapability[] = ['remote.power']): RemoteTransport {
  return {
    kind,
    priority,
    supports: (candidate, capability) => candidate.id === device.id && supported.includes(capability),
    execute: async (command) => ({ success: true, capability: command.capability, deviceId: command.deviceId, transport: kind, attempts: 1 }),
  };
}

describe('remote core', () => {
  it('rejects duplicate capabilities and devices', () => {
    const capabilities = new RemoteCapabilityRegistry();
    capabilities.register({ id: 'remote.power', description: 'Power control', risk: 'write', version: 1 });
    assert.throws(() => capabilities.register({ id: 'remote.power', description: 'duplicate', risk: 'write', version: 1 }), /already registered/);

    const devices = new RemoteDeviceRegistry();
    devices.register(device);
    assert.throws(() => devices.register(device), /already registered/);
  });

  it('resolves transports deterministically by priority then kind', () => {
    const capabilities = new RemoteCapabilityRegistry();
    capabilities.register({ id: 'remote.power', description: 'Power control', risk: 'write', version: 1 });
    const devices = new RemoteDeviceRegistry();
    devices.register(device);

    const resolver = new RemoteTransportResolver(capabilities, devices, [transport('ir', 10), transport('wifi', 20)]);
    assert.deepEqual(resolver.resolve({ capability: 'remote.power', deviceId: 'tv-1' }).map((item) => item.kind), ['wifi', 'ir']);
  });

  it('fails explicitly for unknown capability and device', () => {
    const capabilities = new RemoteCapabilityRegistry();
    const devices = new RemoteDeviceRegistry();
    const resolver = new RemoteTransportResolver(capabilities, devices, []);
    assert.throws(() => resolver.resolve({ capability: 'remote.power', deviceId: 'tv-1' }), /Unknown capability/);

    capabilities.register({ id: 'remote.power', description: 'Power control', risk: 'write', version: 1 });
    assert.throws(() => resolver.resolve({ capability: 'remote.power', deviceId: 'missing' }), /Unknown device/);
  });

  it('excludes unsupported transports', () => {
    const capabilities = new RemoteCapabilityRegistry();
    capabilities.register({ id: 'remote.power', description: 'Power control', risk: 'write', version: 1 });
    const devices = new RemoteDeviceRegistry();
    devices.register(device);
    const resolver = new RemoteTransportResolver(capabilities, devices, [
      transport('wifi', 20, ['remote.volume.up']),
      transport('ir', 10, ['remote.power']),
    ]);
    assert.deepEqual(resolver.resolve({ capability: 'remote.power', deviceId: 'tv-1' }).map((item) => item.kind), ['ir']);
  });
});
