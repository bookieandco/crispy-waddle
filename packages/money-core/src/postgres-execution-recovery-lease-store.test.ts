import assert from 'node:assert/strict';
import test from 'node:test';

import { PostgresExecutionRecoveryLeaseStore } from './postgres-execution-recovery-lease-store.js';

type QueryCall = { text: string; values?: readonly unknown[] };

function createClient(rowsQueue: Array<Record<string, unknown>[]>) {
  const calls: QueryCall[] = [];
  return {
    calls,
    client: {
      async query<T = Record<string, unknown>>(text: string, values?: readonly unknown[]) {
        calls.push({ text, values });
        return { rows: (rowsQueue.shift() ?? []) as T[] };
      },
    },
  };
}

test('claim uses claim_money_execution_recovery_lease and maps row', async () => {
  const row = {
    execution_id: '3f92d045-3f42-4ea7-8679-b6bc0cae2059',
    lease_id: 'lease-1',
    lease_expires_at: '2099-01-01T00:00:00.000Z',
    state: 'recovery_required',
  };
  const { client, calls } = createClient([[row]]);
  const store = new PostgresExecutionRecoveryLeaseStore(client as never);

  const lease = await store.claim(row.execution_id, row.lease_id, 60);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.text, 'SELECT * FROM public.claim_money_execution_recovery_lease($1,$2,$3)');
  assert.deepEqual(calls[0]?.values, [row.execution_id, row.lease_id, 60]);
  assert.deepEqual(lease, {
    executionId: row.execution_id,
    leaseId: row.lease_id,
    leaseExpiresAt: row.lease_expires_at,
    state: row.state,
  });
});

test('renew uses renew_money_execution_recovery_lease and maps row', async () => {
  const row = {
    execution_id: '3f92d045-3f42-4ea7-8679-b6bc0cae2059',
    lease_id: 'lease-1',
    lease_expires_at: '2099-01-01T00:00:30.000Z',
    state: 'recovery_required',
  };
  const { client, calls } = createClient([[row]]);
  const store = new PostgresExecutionRecoveryLeaseStore(client as never);

  const lease = await store.renew(row.execution_id, row.lease_id, 30);

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.text, 'SELECT * FROM public.renew_money_execution_recovery_lease($1,$2,$3)');
  assert.deepEqual(calls[0]?.values, [row.execution_id, row.lease_id, 30]);
  assert.deepEqual(lease, {
    executionId: row.execution_id,
    leaseId: row.lease_id,
    leaseExpiresAt: row.lease_expires_at,
    state: row.state,
  });
});

test('release uses release_money_execution_recovery_lease and returns boolean', async () => {
  const { client, calls } = createClient([[{ release_money_execution_recovery_lease: true }]]);
  const store = new PostgresExecutionRecoveryLeaseStore(client as never);

  const released = await store.release('3f92d045-3f42-4ea7-8679-b6bc0cae2059', 'lease-1');

  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.text, 'SELECT public.release_money_execution_recovery_lease($1,$2) AS release_money_execution_recovery_lease');
  assert.deepEqual(calls[0]?.values, ['3f92d045-3f42-4ea7-8679-b6bc0cae2059', 'lease-1']);
  assert.equal(released, true);
});
