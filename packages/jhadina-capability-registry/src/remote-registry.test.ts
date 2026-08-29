import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry, registerRemoteCapabilities, REMOTE_CAPABILITY_DEFINITIONS } from './index.js';

describe('remote capability registration', () => {
  it('registers the canonical remote vocabulary', () => {
    const registry = new CapabilityRegistry();
    registerRemoteCapabilities(registry);
    assert.equal(registry.list().length, REMOTE_CAPABILITY_DEFINITIONS.length);
    assert.equal(registry.get('remote.power')?.risk, 'write');
    assert.equal(registry.get('remote.navigation.select')?.version, 1);
  });

  it('is deterministic and rejects duplicate registration', () => {
    const registry = new CapabilityRegistry();
    registerRemoteCapabilities(registry);
    const names = registry.list().map(definition => definition.name);
    assert.deepEqual(names, [...names].sort((a, b) => a.localeCompare(b)));
    assert.throws(() => registerRemoteCapabilities(registry), /already registered/);
  });
});
