import assert from 'node:assert/strict';
import test from 'node:test';
import { CapabilityRegistry } from '../../jhadina-capability-registry/src/index.js';
import { REMOTE_ACCESS_CAPABILITY, registerRemoteAccessCapability } from './capability.js';

test('registers remote access as an external capability', () => {
  const registry = new CapabilityRegistry();
  registerRemoteAccessCapability(registry);
  const definition = registry.get(REMOTE_ACCESS_CAPABILITY);
  assert.equal(definition?.risk, 'external');
  assert.equal(definition?.version, 1);
});

test('registration is idempotent', () => {
  const registry = new CapabilityRegistry();
  registerRemoteAccessCapability(registry);
  registerRemoteAccessCapability(registry);
  assert.equal(registry.list().filter((item) => item.name === REMOTE_ACCESS_CAPABILITY).length, 1);
});
