import assert from 'node:assert/strict';
import test from 'node:test';
import { TransactionalMiningPayoutProcessor, type MiningPayoutTransaction } from '../src/mining-payout-processing.ts';

function fakeTransaction(overrides: Partial<MiningPayoutTransaction> = {}) {
  const calls: string[] = [];
  const tx: MiningPayoutTransaction = {
    async processVerifiedPayout() { calls.push('payout'); return 'processed'; },
    async commitCheckpoint() { calls.push('checkpoint'); },
    async rollback() { calls.push('rollback'); },
    ...overrides,
  };
  return { tx, calls };
}

test('payout and checkpoint commit in order', async () => {
  const { tx, calls } = fakeTransaction();
  const processor = new TransactionalMiningPayoutProcessor({ begin: async () => tx });
  const result = await processor.process({ txid: 'tx1', outputIndex: 0 }, { height: 1, blockHash: 'h1', scannedAt: '2026-08-12T20:00:00Z' });
  assert.equal(result, 'processed');
  assert.deepEqual(calls, ['payout', 'checkpoint']);
});

test('payout failure rolls back and does not commit checkpoint', async () => {
  const { tx, calls } = fakeTransaction({
    async processVerifiedPayout() { calls.push('payout'); throw new Error('payout failed'); },
  });
  const processor = new TransactionalMiningPayoutProcessor({ begin: async () => tx });
  await assert.rejects(() => processor.process({ txid: 'tx2', outputIndex: 0 }, { height: 2, blockHash: 'h2', scannedAt: '2026-08-12T20:00:00Z' }), /payout failed/);
  assert.deepEqual(calls, ['payout', 'rollback']);
});

test('checkpoint failure rolls back after payout processing', async () => {
  const { tx, calls } = fakeTransaction({
    async commitCheckpoint() { calls.push('checkpoint'); throw new Error('checkpoint failed'); },
  });
  const processor = new TransactionalMiningPayoutProcessor({ begin: async () => tx });
  await assert.rejects(() => processor.process({ txid: 'tx3', outputIndex: 0 }, { height: 3, blockHash: 'h3', scannedAt: '2026-08-12T20:00:00Z' }), /checkpoint failed/);
  assert.deepEqual(calls, ['payout', 'checkpoint', 'rollback']);
});

test('duplicate payout still advances checkpoint inside the same transaction', async () => {
  const { tx, calls } = fakeTransaction({
    async processVerifiedPayout() { calls.push('payout'); return 'duplicate'; },
  });
  const processor = new TransactionalMiningPayoutProcessor({ begin: async () => tx });
  assert.equal(await processor.process({ txid: 'tx4', outputIndex: 0 }, { height: 4, blockHash: 'h4', scannedAt: '2026-08-12T20:00:00Z' }), 'duplicate');
  assert.deepEqual(calls, ['payout', 'checkpoint']);
});
