import assert from 'node:assert/strict';
import test from 'node:test';
import { ingestMiningPayout } from '../src/mining-payout-ingestion.ts';
import type { BitcoinCoreReadClient } from '../src/bitcoin-core.ts';

const walletAddress = 'bc1qy0e6npz6sa7nnn2cytshsqryg5x676sfjucnfg';

function client(transaction: Parameters<BitcoinCoreReadClient['getTransaction']>[0] extends string ? Awaited<ReturnType<BitcoinCoreReadClient['getTransaction']>> : never): BitcoinCoreReadClient {
  return { getTransaction: async () => transaction };
}

test('ingests a confirmed payout as a governed immutable event', async () => {
  const event = await ingestMiningPayout(client({
    txid: 'tx-1',
    confirmations: 6,
    vout: [{ valueBtc: 0.002, addresses: [walletAddress] }],
  }), {
    payoutId: 'payout-1', txid: 'tx-1', walletAddress, resourceId: 'asic-1', verifiedAt: '2026-08-12T18:00:00.000Z',
  });

  assert.ok(event);
  assert.equal(event.amountBtc, 0.002);
  assert.equal(event.txid, 'tx-1');
  assert.equal(event.currency, 'BTC');
  assert.equal(event.immutable, true);
  assert.equal(event.eventId, 'mining-payout:tx-1:payout-1');
});

test('does not ingest zero-confirmation payouts', async () => {
  const event = await ingestMiningPayout(client({
    txid: 'tx-2', confirmations: 0, vout: [{ valueBtc: 0.002, addresses: [walletAddress] }],
  }), {
    payoutId: 'payout-2', txid: 'tx-2', walletAddress, resourceId: 'asic-1',
  });
  assert.equal(event, null);
});

test('does not ingest payouts sent to another address', async () => {
  const event = await ingestMiningPayout(client({
    txid: 'tx-3', confirmations: 6, vout: [{ valueBtc: 0.002, addresses: ['bc1qother'] }],
  }), {
    payoutId: 'payout-3', txid: 'tx-3', walletAddress, resourceId: 'asic-1',
  });
  assert.equal(event, null);
});
