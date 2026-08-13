import assert from 'node:assert/strict';
import test from 'node:test';
import { InMemoryBitcoinPayoutCheckpointStore, scanBitcoinPayouts } from '../src/bitcoin-payout-checkpoint.ts';
import type { BitcoinCoreBlockTransaction, BitcoinCoreDiscoveryClient } from '../src/bitcoin-payout-discovery.ts';

const wallet = 'bc1qy0e6npz6sa7nnn2cytshsqryg5x676sfjucnfg';

function clientFactory(blocks: Record<number, { hash: string; txs?: BitcoinCoreBlockTransaction[] }>): BitcoinCoreDiscoveryClient {
  return {
    async getBlockCount() { return Math.max(...Object.keys(blocks).map(Number)); },
    async getBlockHash(height) { return blocks[height]?.hash ?? `missing-${height}`; },
    async getBlockTransactions(hash) {
      const block = Object.values(blocks).find((value) => value.hash === hash);
      return block?.txs ?? [];
    },
  };
}

test('persists checkpoint and resumes without losing the scan boundary', async () => {
  const store = new InMemoryBitcoinPayoutCheckpointStore();
  const client = clientFactory({ 100: { hash: 'h100' }, 101: { hash: 'h101' }, 102: { hash: 'h102' } });

  const first = await scanBitcoinPayouts({ client, checkpointStore: store, walletAddress: wallet, startHeight: 100, now: '2026-08-12T12:00:00Z' });
  const second = await scanBitcoinPayouts({ client, checkpointStore: store, walletAddress: wallet, startHeight: 100, now: '2026-08-12T12:01:00Z' });

  assert.equal(first.checkpoint.height, 102);
  assert.equal(second.checkpoint.height, 102);
  assert.equal(second.reorgDetected, false);
  assert.equal(second.rescannedFromHeight, 91);
});

test('detects a changed checkpoint hash and rescans the bounded lookback window', async () => {
  const store = new InMemoryBitcoinPayoutCheckpointStore();
  const original = clientFactory({ 100: { hash: 'h100' }, 101: { hash: 'h101' }, 102: { hash: 'h102' } });
  await scanBitcoinPayouts({ client: original, checkpointStore: store, walletAddress: wallet, startHeight: 100, reorgLookback: 2, now: '2026-08-12T12:00:00Z' });

  const reorganized = clientFactory({ 101: { hash: 'h101-new' }, 102: { hash: 'h102-new' }, 103: { hash: 'h103' } });
  const result = await scanBitcoinPayouts({ client: reorganized, checkpointStore: store, walletAddress: wallet, startHeight: 100, reorgLookback: 2, now: '2026-08-12T12:01:00Z' });

  assert.equal(result.reorgDetected, true);
  assert.equal(result.rescannedFromHeight, 101);
  assert.equal(result.checkpoint.height, 103);
  assert.equal(result.checkpoint.blockHash, 'h103');
});

test('does not advance checkpoint when discovery fails', async () => {
  const store = new InMemoryBitcoinPayoutCheckpointStore();
  const good = clientFactory({ 100: { hash: 'h100' }, 101: { hash: 'h101' } });
  await scanBitcoinPayouts({ client: good, checkpointStore: store, walletAddress: wallet, startHeight: 100, now: '2026-08-12T12:00:00Z' });
  const before = await store.load(wallet);

  const failing: BitcoinCoreDiscoveryClient = {
    async getBlockCount() { return 102; },
    async getBlockHash(height) { if (height === 101) throw new Error('RPC_DOWN'); return `h${height}`; },
    async getBlockTransactions() { return []; },
  };

  await assert.rejects(() => scanBitcoinPayouts({ client: failing, checkpointStore: store, walletAddress: wallet, startHeight: 100 }));
  assert.deepEqual(await store.load(wallet), before);
});
