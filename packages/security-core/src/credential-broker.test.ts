import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CredentialBroker,
  InMemoryCredentialLeaseStore,
  type CredentialSecretStore,
} from './credential-broker.js';

function setup() {
  const leases = new InMemoryCredentialLeaseStore();
  const secrets: CredentialSecretStore = {
    async resolve(ref) {
      return ref === 'money/plaid/default' ? 'super-secret' : '';
    },
  };
  const broker = new CredentialBroker(secrets, leases, {
    authorize: () => 'allow',
  });
  return { broker, leases };
}

const request = {
  actorId: 'actor-1',
  workerId: 'worker-1',
  domain: 'money',
  capability: 'money.account.read',
  credentialRef: 'money/plaid/default',
  resourceId: 'account-1',
  ttlMs: 10_000,
  nowMs: 1_000,
};

test('issues metadata-only short-lived leases', async () => {
  const { broker } = setup();
  const lease = await broker.issue(request);
  assert.equal(lease.actorId, 'actor-1');
  assert.equal(lease.workerId, 'worker-1');
  assert.equal(lease.expiresAt, 11_000);
  assert.equal('secret' in lease, false);
  assert.equal('token' in lease, false);
});

test('consumes a lease exactly once', async () => {
  const { broker } = setup();
  const lease = await broker.issue(request);
  const binding = request;
  assert.equal(await broker.consume(lease, binding, 2_000), 'super-secret');
  await assert.rejects(() => broker.consume(lease, binding, 2_001), /REPLAYED_OR_MISSING/);
});

test('rejects actor, worker, capability, and resource substitution', async () => {
  const { broker } = setup();
  const lease = await broker.issue(request);

  await assert.rejects(
    () => broker.consume(lease, { ...request, actorId: 'actor-2' }, 2_000),
    /ACTOR_MISMATCH/,
  );
  await assert.rejects(
    () => broker.consume(lease, { ...request, workerId: 'worker-2' }, 2_000),
    /WORKER_MISMATCH/,
  );
  await assert.rejects(
    () => broker.consume(lease, { ...request, capability: 'money.transfer.create' }, 2_000),
    /CAPABILITY_MISMATCH/,
  );
  await assert.rejects(
    () => broker.consume(lease, { ...request, resourceId: 'account-2' }, 2_000),
    /RESOURCE_MISMATCH/,
  );
});

test('expires leases before secret resolution', async () => {
  const { broker } = setup();
  const lease = await broker.issue(request);
  await assert.rejects(() => broker.consume(lease, request, 11_000), /LEASE_EXPIRED/);
});

test('denies issuance when policy, kill switch, or egress gate blocks use', async () => {
  const leases = new InMemoryCredentialLeaseStore();
  const secrets = { resolve: async () => 'secret' };
  const denied = new CredentialBroker(secrets, leases, { authorize: () => 'deny' });
  await assert.rejects(() => denied.issue(request), /LEASE_DENIED/);

  const killSwitched = new CredentialBroker(secrets, leases, {
    authorize: () => 'allow',
    allowTraffic: () => false,
  });
  await assert.rejects(() => killSwitched.issue(request), /TRAFFIC_BLOCKED/);

  const egressBlocked = new CredentialBroker(secrets, leases, {
    authorize: () => 'allow',
    allowCredentialEgress: () => false,
  });
  await assert.rejects(() => egressBlocked.issue(request), /EGRESS_BLOCKED/);
});

test('caps lease TTL and rejects invalid input', async () => {
  const { broker } = setup();
  const lease = await broker.issue({ ...request, ttlMs: 999_999 });
  assert.equal(lease.expiresAt, 61_000);
  await assert.rejects(() => broker.issue({ ...request, ttlMs: 0 }), /TTL_INVALID/);
  await assert.rejects(() => broker.issue({ ...request, credentialRef: '' }), /CREDENTIAL_REF_MISSING/);
});
