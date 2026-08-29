import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateCapitalAllocation, calculateSafeToSpend } from './financial-state.js';

test('safe-to-spend protects obligations, reserves, floor, and pending outflows', () => {
  assert.equal(calculateSafeToSpend({
    currency: 'USD',
    liquidAssets: 100_000n,
    committedObligations: 20_000n,
    reserves: 15_000n,
    survivalFloor: 10_000n,
    pendingOutflows: 5_000n,
  }), 50_000n);
});

test('safe-to-spend fails closed at zero when protected capital exceeds liquidity', () => {
  assert.equal(calculateSafeToSpend({
    currency: 'USD',
    liquidAssets: 10_000n,
    committedObligations: 20_000n,
    reserves: 0n,
    survivalFloor: 0n,
    pendingOutflows: 0n,
  }), 0n);
});

test('safe-to-spend rejects negative financial inputs', () => {
  assert.throws(() => calculateSafeToSpend({
    currency: 'USD',
    liquidAssets: -1n,
    committedObligations: 0n,
    reserves: 0n,
    survivalFloor: 0n,
    pendingOutflows: 0n,
  }), /MONEY_NEGATIVE_VALUE:liquidAssets/);
});

test('capital allocation caps risk capital as a percentage of safe-to-spend', () => {
  const result = calculateCapitalAllocation({
    currency: 'USD',
    liquidAssets: 100_000n,
    committedObligations: 20_000n,
    reserves: 15_000n,
    survivalFloor: 10_000n,
    pendingOutflows: 5_000n,
  }, { riskCapitalBps: 2_000n });

  assert.equal(result.safeToSpend, 50_000n);
  assert.equal(result.riskCapitalLimit, 10_000n);
  assert.equal(result.operatingCapital, 40_000n);
  assert.equal(result.availableRiskCapital, 10_000n);
});

test('capital allocation never reports more available risk capital than its limit', () => {
  const result = calculateCapitalAllocation({
    currency: 'USD',
    liquidAssets: 100_000n,
    committedObligations: 0n,
    reserves: 0n,
    survivalFloor: 0n,
    pendingOutflows: 0n,
  }, { riskCapitalBps: 1_000n, allocatedRiskCapital: 20_000n });

  assert.equal(result.riskCapitalLimit, 10_000n);
  assert.equal(result.availableRiskCapital, 0n);
});

test('capital allocation rejects a risk percentage above 100%', () => {
  assert.throws(() => calculateCapitalAllocation({
    currency: 'USD',
    liquidAssets: 100n,
    committedObligations: 0n,
    reserves: 0n,
    survivalFloor: 0n,
    pendingOutflows: 0n,
  }, { riskCapitalBps: 10_001n }), /MONEY_INVALID_RISK_BPS/);
});
