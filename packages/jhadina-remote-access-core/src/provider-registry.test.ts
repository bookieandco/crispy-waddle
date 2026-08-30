import { describe, expect, it } from 'vitest';
import { RemoteAccessProviderRegistry } from './provider-registry.js';
import type { RemoteAccessProvider } from './index.js';

const sshProvider: RemoteAccessProvider = {
  protocol: 'ssh',
  async connect() { throw new Error('not exercised'); },
  async disconnect() { throw new Error('not exercised'); },
};

describe('RemoteAccessProviderRegistry', () => {
  it('resolves providers deterministically by protocol', () => {
    const registry = new RemoteAccessProviderRegistry();
    registry.register(sshProvider);
    expect(registry.resolve('ssh')).toBe(sshProvider);
    expect(registry.list()).toEqual(['ssh']);
  });

  it('rejects duplicate protocol registrations', () => {
    const registry = new RemoteAccessProviderRegistry();
    registry.register(sshProvider);
    expect(() => registry.register(sshProvider)).toThrow('Remote provider already registered: ssh');
  });

  it('fails closed when a provider is absent', () => {
    const registry = new RemoteAccessProviderRegistry();
    expect(() => registry.resolve('ssh')).toThrow('No remote provider registered: ssh');
  });
});
