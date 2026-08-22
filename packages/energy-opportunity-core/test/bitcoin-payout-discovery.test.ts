import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverBitcoinPayouts } from '../src/bitcoin-payout-discovery.ts';
import type { BitcoinCoreDiscoveryClient } from '../src/bitcoin-payout-discovery.ts';

function client(): BitcoinCoreDiscoveryClient {
  const blocks = new Map<number, { hash: string; txs: any[] }>([
    [100, { hash: 'h100', txs: [{ txid: 'tx-unrelated', blockHash: 'h100', blockHeight: 100, confirmations: 3, vout: [{ valueBtc: 2, addresses: ['bc1-other'] }] }] }],
    [101, { hash: 'h101', txs: [{ txid: 'tx-payout', blockHash: 'h101', blockHeight: 101, confirmations: 2, vout: [{ valueBtc: 0.002, addresses: ['bc1-target'] }] }] }],
    [102, { hash: 'h102', txs: [{ txid: 'tx-pending', blockHash: 'h102', blockHeight: 102, confirmations: 1, vout: [{ valueBtc: 0.003, addresses: ['bc1-target'] }] }] }],
  ]);
  return {
    async getBlockCount() { return 102; },
    async getBlockHash(height) { return blocks.get(height)!.hash; },
    async getBlockTransactions(hash) { return [...blocks.values()].find((block) => block.hash === hash)!.txs; },
  };
}

test('discovers only matching confirmed outputs', async () => {
  const result = await discoverBitcoinPayouts({ client: client(), walletAddress: 'bc1-target', fromHeight: 100, toHeight: 102, minimumConfirmations: 2, now: '2026-08-12T12:00:00.000Z' });
  assert.deepEqual(result.payouts.map((p) => p.txid), ['tx-payout']);
  assert.equal(result.payouts[0].amountBtc, 0.002);
  assert.deepEqual(result.checkpoint, { height: 102, blockHash: 'h102', scannedAt: '2026-08-12T12:00:00.000Z' });
});

test('ignores unrelated transactions and zero-value outputs', async () => {
  const result = await discoverBitcoinPayouts({
    client: {
      async getBlockCount() { return 100; },
      async getBlockHash() { return 'h100'; },
      async getBlockTransactions() { return [{ txid: 'zero', blockHash: 'h100', blockHeight: 100, confirmations: 1, vout: [{ valueBtc: 0, addresses: ['bc1-target'] }] }]; },
    },
    walletAddress: 'bc1-target',
    fromHeight: 100,
  });
  assert.equal(result.payouts.length, 0);
});

test('does not scan beyond the current tip', async () => {
  const result = await discoverBitcoinPayouts({ client: client(), walletAddress: 'bc1-target', fromHeight: 101, toHeight: 999, now: '2026-08-12T12:00:00.000Z' });
  assert.equal(result.checkpoint.height, 102);
  assert.equal(result.checkpoint.blockHash, 'h102');
});

test('rejects an invalid starting height or missing address', async () => {
  await assert.rejects(() => discoverBitcoinPayouts({ client: client(), walletAddress: '', fromHeight: 100 }), /WALLET_ADDRESS_REQUIRED/);
  await assert.rejects(() => discoverBitcoinPayouts({ client: client(), walletAddress: 'bc1-target', fromHeight: -1 }), /INVALID_FROM_HEIGHT/);
});
