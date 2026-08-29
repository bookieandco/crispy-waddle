import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RemoteDeviceNormalizer } from './remote-discovery.js';
import type { DiscoveredRemoteDevice } from './remote-discovery.js';

const candidate: DiscoveredRemoteDevice = {
  provider: 'mdns', name: ' Living Room TV ', manufacturer: 'Acme', model: 'X1',
  identity: 'TV-01', addresses: ['192.168.1.20', '192.168.1.20'], ports: [8009, 8009],
  transports: ['wifi', 'wifi'], capabilities: ['remote.power', 'remote.power'], discoveredAt: '2026-08-29T00:00:00Z',
};

describe('remote discovery normalization', () => {
  it('normalizes identity and removes duplicates deterministically', () => {
    const device = new RemoteDeviceNormalizer().normalize(candidate);
    assert.equal(device.id, 'remote:tv-01');
    assert.equal(device.name, 'Living Room TV');
    assert.deepEqual(device.addresses, ['192.168.1.20']);
    assert.deepEqual(device.ports, [8009]);
    assert.deepEqual(device.transports, ['wifi']);
    assert.deepEqual(device.capabilities, ['remote.power']);
  });

  it('rejects candidates without stable identity or transport', () => {
    const normalizer = new RemoteDeviceNormalizer();
    assert.throws(() => normalizer.normalize({ ...candidate, identity: undefined, addresses: [] }), /stable identity/);
    assert.throws(() => normalizer.normalize({ ...candidate, transports: [] }), /no transport/);
  });

  it('merges duplicate discoveries deterministically', () => {
    const normalizer = new RemoteDeviceNormalizer();
    const left = normalizer.normalize(candidate);
    const right = normalizer.normalize({ ...candidate, provider: 'ssdp', name: 'Bedroom TV', addresses: ['192.168.1.21'], ports: [8060], transports: ['wifi', 'bluetooth'] });
    const merged = normalizer.merge(left, right);
    assert.equal(merged.id, left.id);
    assert.equal(merged.name, 'Bedroom TV');
    assert.deepEqual(merged.addresses, ['192.168.1.20', '192.168.1.21']);
    assert.deepEqual(merged.discoverySources, ['mdns', 'ssdp']);
    assert.deepEqual(merged.transports, ['bluetooth', 'wifi']);
  });
});
