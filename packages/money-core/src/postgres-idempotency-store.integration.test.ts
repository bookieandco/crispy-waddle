import assert from 'node:assert/strict';
import test from 'node:test';

import { createPostgresClient } from './postgres-client.js';
import { PostgresIdempotencyStore } from './postgres-idempotency-store.js';

test('PostgresIdempotencyStore allows exactly one concurrent claimant', async () => {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL_REQUIRED_FOR_POSTGRES_INTEGRATION_TEST');
  }

  const client = createPostgresClient({ connectionString, max: 10 });
  const requestId = `integration-race-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const store = new PostgresIdempotencyStore({ client, pollIntervalMs: 10, timeoutMs: 5_000 });

  try {
    const claims = await Promise.all(
      Array.from({ length: 10 }, () =>
        store.claim({
          requestId,
          userId: 'integration-user',
          capability: 'money.payment.create',
        }),
      ),
    );

    assert.equal(claims.filter((claim) => claim.claimed).length, 1);
    assert.equal(claims.filter((claim) => !claim.claimed).length, 9);

    const result = { providerReference: `provider-${requestId}`, status: 'succeeded' };
    await store.complete(requestId, result);

    const completed = await Promise.all(
      Array.from({ length: 10 }, () => store.waitForCompletion(requestId)),
    );

    assert.deepEqual(completed, Array.from({ length: 10 }, () => result));
  } finally {
    await client.query('DELETE FROM money_transaction_requests WHERE request_id = $1', [requestId]);
    await client.end();
  }
});
