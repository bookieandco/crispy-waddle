import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RemoteDeviceRegistry, RemoteTransportResolver, type RemoteCapability, type RemoteDevice, type RemoteTransport } from './remote.js';

const device: RemoteDevice = { id: 'tv-1', name: 'Living Room TV', transports: ['wifi', 'ir'], capabilities: ['remote.power'] };
const t = (kind: 'wifi' | 'ir', priority: number, supports = true): RemoteTransport => ({
  kind, priority,
  supports: () => supports,
  execute: async c => ({ success: true, capability: c.capability, deviceId: c.deviceId, transport: kind, attempts: 1 })
});

describe('remote transport resolver', () => {
  it('orders transports deterministically', () => {
    const devices = new RemoteDeviceRegistry(); devices.register(device);
    const resolver = new RemoteTransportResolver({ has: (x: RemoteCapability) => x === 'remote.power' }, devices, [t('ir', 10), t('wifi', 20)]);
    assert.deepEqual(resolver.resolve({ capability: 'remote.power', deviceId: 'tv-1' }).map(x => x.kind), ['wifi', 'ir']);
  });

  it('rejects unknown capability and device', () => {
    const devices = new RemoteDeviceRegistry();
    const resolver = new RemoteTransportResolver({ has: () => false }, devices, []);
    assert.throws(() => resolver.resolve({ capability: 'remote.power', deviceId: 'tv-1' }), /Unknown capability/);
    const resolver2 = new RemoteTransportResolver({ has: () => true }, devices, []);
    assert.throws(() => resolver2.resolve({ capability: 'remote.power', deviceId: 'missing' }), /Unknown device/);
  });

  it('filters unsupported transports', () => {
    const devices = new RemoteDeviceRegistry(); devices.register(device);
    const resolver = new RemoteTransportResolver({ has: () => true }, devices, [t('wifi', 20, false), t('ir', 10, true)]);
    assert.deepEqual(resolver.resolve({ capability: 'remote.power', deviceId: 'tv-1' }).map(x => x.kind), ['ir']);
  });
});
