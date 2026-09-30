import assert from 'node:assert/strict';
import test from 'node:test';
import { RemoteAccessProviderRegistry } from './provider-registry.js';
import type { RemoteAccessProvider } from './index.js';

const sshProvider: RemoteAccessProvider = {
  protocol: 'ssh',
  async connect() { throw new Error('not exercised'); },
  async disconnect() { throw new Error('not exercised'); },
};

test('resolves providers deterministically by protocol', () => {
  const registry = new RemoteAccessProviderRegistry();
  registry.register(sshProvider);
  assert.equal(registry.resolve('ssh'), sshProvider);
  assert.deepEqual(registry.list(), ['ssh']);
});

test('rejects duplicate protocol registrations', () => {
  const registry = new RemoteAccessProviderRegistry();
  registry.register(sshProvider);
  assert.throws(() => registry.register(sshProvider), /Remote provider already registered: ssh/);
});

test('fails closed when a provider is absent', () => {
  const registry = new RemoteAccessProviderRegistry();
  assert.throws(() => registry.resolve('ssh'), /No remote provider registered: ssh/);
});
