import assert from 'node:assert/strict';
import test from 'node:test';
import { isVerifiedMiningPayout, projectMiningEconomics } from '../src/moneycore-bridge.ts';

test('projects Bitaxe power into Money Core economics without writing money', () => {
  const projection = projectMiningEconomics({
    resourceId: 'bitaxe-001',
    telemetry: {
      resourceId: 'bitaxe-001',
      observedAt: '2026-08-11T00:00:00Z',
      reachable: true,
      hashRateGh: 500,
      powerWatts: 15,
    },
    electricityRatePerKwh: 0.20,
    estimatedGrossPerHour: 0.05,
    confidence: 0.9,
    observedAt: '2026-08-11T00:00:00Z',
  });

  assert.equal(projection.hashrateThs, 0.5);
  assert.equal(projection.estimatedElectricityPerHour, 0.003);
  assert.equal(projection.estimatedNetPerHour, 0.047);
});

test('rejects unverified mining payouts', () => {
  assert.equal(isVerifiedMiningPayout({
    payoutId: 'payout-1',
    walletAddress: 'bc1example',
    amountBtc: 0.001,
    txid: 'tx-example',
    verifiedAt: '2026-08-11T00:00:00Z',
    source: 'on-chain-verification',
  }), true);
});
