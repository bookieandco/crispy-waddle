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

  it('does not make policy decisions — registration ≠ authorization', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: 'overage.submit_claim', description: 'Submit a claim', risk: 'external', version: 1 });
    assert.equal(registry.has('overage.submit_claim'), true);
    assert.equal(typeof (registry.get('overage.submit_claim') as object), 'object');
  });

  // ── New conformance tests ─────────────────────────────────────────────────

  it('approval, audit, executor and idempotency metadata are stored and retrievable', () => {
    const registry = new CapabilityRegistry();
    registry.register({
      name: 'memory.propose',
      description: 'Propose a new memory candidate',
      risk: 'write',
      version: 2,
      approvalRequired: true,
      auditRequired: true,
      executor: 'memory-propose-handler',
      idempotency: 'not idempotent — creates a new candidate on each call',
    });

    const def = registry.get('memory.propose');
    assert.ok(def);
    assert.equal(def.approvalRequired, true);
    assert.equal(def.auditRequired, true);
    assert.equal(def.executor, 'memory-propose-handler');
    assert.equal(def.version, 2);
  });

  it('registered definitions are frozen — mutation is rejected', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: 'files.read', description: 'Read files', risk: 'read', version: 1 });
    const def = registry.get('files.read') as Record<string, unknown>;
    assert.throws(() => { def['description'] = 'mutated'; }, /Cannot assign to read only/);
  });

  it('requiresApprovalByDefault: true for destructive/financial capabilities', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: 'payment.send', description: 'Send payment', risk: 'financial', version: 1 });
    registry.register({ name: 'data.delete', description: 'Delete data', risk: 'destructive', version: 1 });
    registry.register({ name: 'user.read', description: 'Read user', risk: 'read', version: 1 });

    assert.equal(registry.requiresApprovalByDefault('payment.send'), true);
    assert.equal(registry.requiresApprovalByDefault('data.delete'), true);
    assert.equal(registry.requiresApprovalByDefault('user.read'), false);
  });

  it('requiresApprovalByDefault: true when approvalRequired is explicitly set', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: 'growth.schedule', description: 'Schedule post', risk: 'write', version: 1, approvalRequired: true });
    assert.equal(registry.requiresApprovalByDefault('growth.schedule'), true);
  });

  it('requiresApprovalByDefault: false for unknown capability', () => {
    const registry = new CapabilityRegistry();
    assert.equal(registry.requiresApprovalByDefault('unknown.capability'), false);
  });

  it('requiresAudit: true for destructive, financial, and external capabilities', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: 'files.delete', description: 'Delete files', risk: 'destructive', version: 1 });
    registry.register({ name: 'payment.charge', description: 'Charge card', risk: 'financial', version: 1 });
    registry.register({ name: 'api.call', description: 'External API call', risk: 'external', version: 1 });
    registry.register({ name: 'memory.read', description: 'Read memory', risk: 'read', version: 1 });

    assert.equal(registry.requiresAudit('files.delete'), true);
    assert.equal(registry.requiresAudit('payment.charge'), true);
    assert.equal(registry.requiresAudit('api.call'), true);
    assert.equal(registry.requiresAudit('memory.read'), false);
  });

  it('requiresAudit: true when auditRequired is explicitly set on a read capability', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: 'identity.read', description: 'Read PII', risk: 'read', version: 1, auditRequired: true });
    assert.equal(registry.requiresAudit('identity.read'), true);
  });

  it('list() returns capabilities sorted alphabetically by name', () => {
    const registry = new CapabilityRegistry();
    registry.register({ name: 'z.last', description: '', risk: 'read', version: 1 });
    registry.register({ name: 'a.first', description: '', risk: 'read', version: 1 });
    registry.register({ name: 'm.middle', description: '', risk: 'read', version: 1 });

    const names = registry.list().map((d) => d.name);
    assert.deepEqual(names, ['a.first', 'm.middle', 'z.last']);
  });

  it('rejects version < 1', () => {
    const registry = new CapabilityRegistry();
    assert.throws(
      () => registry.register({ name: 'bad.version', description: '', risk: 'read', version: 0 }),
      /Invalid capability version/,
    );
  });

  it('rejects empty name', () => {
    const registry = new CapabilityRegistry();
    assert.throws(
      () => registry.register({ name: '  ', description: '', risk: 'read', version: 1 }),
      /name is required/,
    );
  });
});

