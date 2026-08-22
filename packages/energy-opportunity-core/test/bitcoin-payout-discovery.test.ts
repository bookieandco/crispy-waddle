import assert from 'node:assert/strict';
import test from 'node:test';
import { discoverBitcoinPayouts } from '../src/bitcoin-payout-discovery.ts';
import type { BitcoinCoreBlockTransaction, BitcoinCoreDiscoveryClient } from '../src/bitcoin-payout-discovery.ts';

const wallet = 'bc1qy0e6npz6sa7nnn2cytshsqryg5x676sfjucnfg';
const other = 'bc1qother0000000000000000000000000000000';

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

test('finds an output paying the wallet address and ignores unrelated outputs', async () => {
  const client = clientFactory({
    100: {
      hash: 'h100',
      txs: [
        {
          txid: 'tx-1',
          vout: [
            { n: 0, value: 0.5, scriptPubKey: { address: other } },
            { n: 1, value: 0.00250000, scriptPubKey: { address: wallet } },
          ],
        },
      ],
    },
  });

  const result = await discoverBitcoinPayouts({ client, walletAddress: wallet, fromHeight: 100 });

  assert.equal(result.payouts.length, 1);
  assert.deepEqual(result.payouts[0], {
    txid: 'tx-1',
    voutIndex: 1,
    address: wallet,
    amountSats: 250_000,
    blockHeight: 100,
    blockHash: 'h100',
    confirmations: 1,
    observedAt: result.payouts[0].observedAt,
  });
  assert.equal(result.checkpoint.height, 100);
  assert.equal(result.checkpoint.blockHash, 'h100');
});

test('matches a legacy scriptPubKey.addresses array as well as a single address', async () => {
  const client = clientFactory({
    100: {
      hash: 'h100',
      txs: [{ txid: 'tx-legacy', vout: [{ n: 0, value: 0.001, scriptPubKey: { addresses: [wallet] } }] }],
    },
  });

  const result = await discoverBitcoinPayouts({ client, walletAddress: wallet, fromHeight: 100 });
  assert.equal(result.payouts.length, 1);
  assert.equal(result.payouts[0].amountSats, 100_000);
});

test('excludes outputs below the requested minimum confirmations', async () => {
  const client = clientFactory({
    100: { hash: 'h100', txs: [{ txid: 'tx-old', vout: [{ n: 0, value: 1, scriptPubKey: { address: wallet } }] }] },
    101: { hash: 'h101', txs: [{ txid: 'tx-new', vout: [{ n: 0, value: 1, scriptPubKey: { address: wallet } }] }] },
  });

  // tip=101: block 100 has 2 confirmations, block 101 has 1.
  const result = await discoverBitcoinPayouts({ client, walletAddress: wallet, fromHeight: 100, minimumConfirmations: 2 });

  assert.equal(result.payouts.length, 1);
  assert.equal(result.payouts[0].txid, 'tx-old');
  assert.equal(result.checkpoint.height, 101);
  assert.equal(result.checkpoint.blockHash, 'h101');
});

test('propagates a client error without returning a partial result', async () => {
  const failing: BitcoinCoreDiscoveryClient = {
    async getBlockCount() { return 101; },
    async getBlockHash(height) { if (height === 101) throw new Error('RPC_DOWN'); return `h${height}`; },
    async getBlockTransactions() { return []; },
  };

  await assert.rejects(
    () => discoverBitcoinPayouts({ client: failing, walletAddress: wallet, fromHeight: 100 }),
    /RPC_DOWN/,
  );
});
