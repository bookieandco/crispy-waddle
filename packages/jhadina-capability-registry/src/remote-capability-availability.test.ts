import test from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry } from './index.js';
import { listRemoteCapabilityAvailability } from './remote-capability-availability.js';

const capability = 'remote.navigation.up';

function registryWithCapability() {
  const registry = new CapabilityRegistry();
  registry.register({
    name: capability,
    description: 'Navigate up',
    risk: 'low',
    version: 1,
  });
  return registry;
}

test('marks a capability available when a transport supports the device command', () => {
  const registry = registryWithCapability();
  const transport = { supports: (command: { deviceId: string; capability: string }) => command.deviceId === 'living-room' && command.capability === capability };

  assert.deepEqual(listRemoteCapabilityAvailability(registry, [transport], 'living-room'), [
    { name: capability, available: true },
  ]);
});

test('marks a capability unavailable when no transport supports it', () => {
  const registry = registryWithCapability();
  const transport = { supports: () => false };

  assert.deepEqual(listRemoteCapabilityAvailability(registry, [transport], 'living-room'), [
    { name: capability, available: false },
  ]);
});
