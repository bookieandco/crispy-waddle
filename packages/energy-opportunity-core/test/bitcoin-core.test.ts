import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyMiningPayout } from '../src/bitcoin-core.ts';

test('verifies a confirmed payout to the configured wallet address', async () => {
  const result = await verifyMiningPayout({
    async getTransaction(txid) {
      return {
        txid,
        confirmations: 3,
        vout: [
          { valueBtc: 0.0001, addresses: ['bc1qmine'] },
          { valueBtc: 0.0002, addresses: ['bc1qother'] },
        ],
      };
    },
  }, {
    payoutId: 'payout-1',
    txid: 'tx-1',
    walletAddress: 'bc1qmine',
    resourceId: 'bitaxe-01',
  });

  assert.equal(result?.amountBtc, 0.0001);
  assert.equal(result?.confirmations, 3);
  assert.equal(result?.source, 'bitcoin-core');
});

test('does not realize an unconfirmed or unrelated transaction', async () => {
  const client = { async getTransaction(txid: string) {
    return { txid, confirmations: 0, vout: [{ valueBtc: 1, addresses: ['bc1qother'] }] };
  } };
  assert.equal(await verifyMiningPayout(client, {
    payoutId: 'payout-2', txid: 'tx-2', walletAddress: 'bc1qmine', resourceId: 'bitaxe-01',
  }), null);
});
