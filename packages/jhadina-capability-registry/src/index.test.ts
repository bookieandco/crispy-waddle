import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CapabilityRegistry } from './index.js';

describe('CapabilityRegistry', () => {
  it('registers and retrieves immutable capability definitions', () => {
    const registry = new CapabilityRegistry();
    registry.register({
      name: 'overage.review',
      description: 'Read-only review of a verified opportunity',
      risk: 'read',
      version: 1,
    });

    assert.equal(registry.has('overage.review'), true);
    assert.deepEqual(registry.get('overage.review'), {
      name: 'overage.review',
      description: 'Read-only review of a verified opportunity',
      risk: 'read',
      version: 1,
    });
  });

  it('rejects duplicate registrations', () => {
    const registry = new CapabilityRegistry();
    const capability = { name: 'money.read', description: 'Read account data', risk: 'read' as const, version: 1 };
    registry.register(capability);
    assert.throws(() => registry.register(capability), /already registered/);
  });

  it('does not make policy decisions', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: 'overage.submit_claim', description: 'Submit a claim', risk: 'external', version: 1 });
    assert.equal(registry.has('overage.submit_claim'), true);
    assert.equal(typeof (registry.get('overage.submit_claim') as object), 'object');
  });
});
