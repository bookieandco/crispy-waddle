import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateMiningEconomics } from '../src/mining-economics.ts';
import { asicseerProviderDescriptor, hashRateHpsToGhps, wattsToKwhPerDay } from '../src/mining-fleet.ts';

test('calculates daily energy cost and net mining economics deterministically', () => {
  const result = evaluateMiningEconomics({
    powerWatts: 15,
    electricityPricePerKwh: 0.10,
    expectedGrossRevenuePerDay: 0.50,
    poolFeeRate: 0.02,
    capitalCost: 150,
    maximumPaybackDays: 500,
  });

  assert.equal(result.energyKwhPerDay, 0.36);
  assert.equal(result.energyCostPerDay, 0.036);
  assert.equal(result.poolFeesPerDay, 0.01);
  assert.equal(result.netRevenuePerDay, 0.454);
  assert.equal(result.paybackDays, 330.3964757709251);
  assert.equal(result.decision, 'operate');
});

test('rejects an uneconomic fleet member when payback exceeds the capital threshold', () => {
  const result = evaluateMiningEconomics({
    powerWatts: 100,
    electricityPricePerKwh: 0.30,
    expectedGrossRevenuePerDay: 0.25,
    capitalCost: 500,
    maximumPaybackDays: 365,
  });

  assert.ok(result.netRevenuePerDay < 0);
  assert.equal(result.decision, 'do-not-operate');
  assert.match(result.reasons.join(' '), /net revenue|payback/i);
});

test('returns insufficient-data when no expected gross revenue is supplied', () => {
  const result = evaluateMiningEconomics({
    powerWatts: 15,
    electricityPricePerKwh: 0.10,
    expectedGrossRevenuePerDay: 0,
  });

  assert.equal(result.decision, 'insufficient-data');
  assert.equal(result.paybackDays, null);
});

test('ASICseer is represented as a BCH read-only provider descriptor', () => {
  const provider = asicseerProviderDescriptor();
  assert.equal(provider.providerId, 'asicseer');
  assert.deepEqual(provider.networks, ['bitcoin-cash']);
  assert.equal(provider.readOnly, true);
  assert.ok(provider.capabilities.includes('proxy'));
  assert.ok(provider.capabilities.includes('solo'));
});

test('normalizes common fleet units', () => {
  assert.equal(hashRateHpsToGhps(470_000_000_000), 470);
  assert.equal(wattsToKwhPerDay(15), 0.36);
});
