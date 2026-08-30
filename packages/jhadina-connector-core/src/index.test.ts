import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConnectorGateway,
  ConnectorRegistry,
  type ConnectorAdapter,
  type ConnectorOperation,
} from './index.js';

const readOperation: ConnectorOperation = {
  name: 'repo.read',
  capability: 'github.repo.read',
  kind: 'read',
  reversibility: 'reversible',
  description: 'Read repository metadata',
};

function adapter(overrides: Partial<ConnectorAdapter> = {}): ConnectorAdapter {
  return {
    manifest: {
      id: 'github',
      provider: 'github',
      version: 1,
      operations: [readOperation],
    },
    state: 'connected',
    async execute() {
      return { ok: true };
    },
    async verify() {
      return true;
    },
    ...overrides,
  };
}

test('registry rejects duplicate connectors', () => {
  const registry = new ConnectorRegistry();
  registry.register(adapter());
  assert.throws(() => registry.register(adapter()), /already registered/);
});

test('gateway rejects capability mismatches before execution', async () => {
  let executed = false;
  const registry = new ConnectorRegistry();
  registry.register(adapter({ execute: async () => { executed = true; return {}; } }));
  const gateway = new ConnectorGateway(registry);

  await assert.rejects(
    gateway.execute({
      connectorId: 'github',
      operation: 'repo.read',
      capability: 'github.repo.write',
      input: {},
      idempotencyKey: 'key-1',
      correlationId: 'corr-1',
    }),
    /Capability mismatch/,
  );
  assert.equal(executed, false);
});

test('gateway verifies successful connector actions', async () => {
  const registry = new ConnectorRegistry();
  registry.register(adapter());
  const gateway = new ConnectorGateway(registry);

  const response = await gateway.execute({
    connectorId: 'github',
    operation: 'repo.read',
    capability: 'github.repo.read',
    input: { repository: 'bookieandco/crispy-waddle' },
    idempotencyKey: 'key-2',
    correlationId: 'corr-2',
  });

  assert.equal(response.status, 'succeeded');
  assert.equal(response.verified, true);
});

test('gateway returns the original result for duplicate idempotency keys', async () => {
  let calls = 0;
  const registry = new ConnectorRegistry();
  registry.register(adapter({ execute: async () => { calls += 1; return { calls }; } }));
  const gateway = new ConnectorGateway(registry);

  const request = {
    connectorId: 'github',
    operation: 'repo.read',
    capability: 'github.repo.read',
    input: {},
    idempotencyKey: 'same-key',
    correlationId: 'corr-3',
  };

  const first = await gateway.execute(request);
  const second = await gateway.execute({ ...request, correlationId: 'corr-4' });

  assert.deepEqual(second, first);
  assert.equal(calls, 1);
});

test('gateway blocks disabled connectors', async () => {
  const registry = new ConnectorRegistry();
  registry.register(adapter({ state: 'disabled' }));
  const gateway = new ConnectorGateway(registry);

  await assert.rejects(
    gateway.execute({
      connectorId: 'github',
      operation: 'repo.read',
      capability: 'github.repo.read',
      input: {},
      idempotencyKey: 'key-4',
      correlationId: 'corr-5',
    }),
    /Connector unavailable/,
  );
});
