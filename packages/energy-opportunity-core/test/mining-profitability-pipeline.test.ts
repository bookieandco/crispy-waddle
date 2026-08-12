import assert from 'node:assert/strict';
import test from 'node:test';
import type { BitcoinCoreReadClient } from '../src/bitcoin-core.ts';
import { InMemoryProfitabilitySnapshotLedger } from '../src/profitability-snapshot.ts';
import { ingestAndReconcileMiningPayout } from '../src/mining-profitability-pipeline.ts';
import type { MiningFinancialEvent } from '../src/financial-events.ts';

const walletAddress = 'bc1qy0e6npz6sa7nnn2cytshsqryg5x676sfjucnfg';
const payoutInput = {
  payoutId: 'pool-payout-1',
  txid: 'tx-1',
  walletAddress,
  resourceId: 'asic-1',
  minimumConfirmations: 1,
  verifiedAt: '2026-08-12T15:00:00.000Z',
};

const bitcoinCore: BitcoinCoreReadClient = {
  async getTransaction(txid) {
    return { txid, confirmations: 6, vout: [{ valueBtc: 0.002, addresses: [walletAddress] }] };
  },
};

function electricity(): MiningFinancialEvent {
  return {
    schemaVersion: 1,
    eventId: 'electricity-1',
    kind: 'electricity_expense_observed',
    resourceId: 'asic-1',
    occurredAt: '2026-08-12T14:00:00.000Z',
    currency: 'USD',
    source: 'meter',
    immutable: true,
    amountUsd: 35,
    powerWatts: 1000,
    durationSeconds: 3600,
    rateUsdPerKwh: 35,
  };
}

test('connects verified payout to realized snapshot', async () => {
  const ledger = new InMemoryProfitabilitySnapshotLedger();
  const result = await ingestAndReconcileMiningPayout({
    bitcoinCore,
    payout: payoutInput,
    events: [electricity()],
    snapshotLedger: ledger,
    btcUsdRate: 90000,
  });

  assert.ok(result.payout);
  assert.ok(result.snapshot);
  assert.equal(result.payout.amountBtc, 0.002);
  assert.equal(result.snapshot?.realizedBtc, 0.002);
  assert.equal(result.snapshot?.realizedUsd, 180);
  assert.equal(result.snapshot?.electricityUsd, 35);
  assert.equal(result.snapshot?.netUsd, 145);
});

test('repeated payout ingestion is idempotent at the snapshot boundary', async () => {
  const ledger = new InMemoryProfitabilitySnapshotLedger();
  const input = { bitcoinCore, payout: payoutInput, events: [electricity()], snapshotLedger: ledger, btcUsdRate: 90000 };
  const first = await ingestAndReconcileMiningPayout(input);
  const second = await ingestAndReconcileMiningPayout(input);

  assert.ok(first.snapshot);
  assert.equal(second.snapshot, first.snapshot);
});

test('does not create a snapshot without BTC valuation', async () => {
  const ledger = new InMemoryProfitabilitySnapshotLedger();
  const result = await ingestAndReconcileMiningPayout({
    bitcoinCore,
    payout: payoutInput,
    events: [electricity()],
    snapshotLedger: ledger,
  });

  assert.ok(result.payout);
  assert.equal(result.snapshot, null);
});

test('rejects unconfirmed payouts before accounting', async () => {
  const ledger = new InMemoryProfitabilitySnapshotLedger();
  const unconfirmed: BitcoinCoreReadClient = {
    async getTransaction(txid) {
      return { txid, confirmations: 0, vout: [{ valueBtc: 0.002, addresses: [walletAddress] }] };
    },
  };

  const result = await ingestAndReconcileMiningPayout({
    bitcoinCore: unconfirmed,
    payout: payoutInput,
    events: [electricity()],
    snapshotLedger: ledger,
    btcUsdRate: 90000,
  });

  assert.equal(result.payout, null);
  assert.equal(result.snapshot, null);
});
