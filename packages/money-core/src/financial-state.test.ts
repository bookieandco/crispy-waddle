import { describe, expect, it } from 'vitest';
import { calculateCapitalAllocation, calculateSafeToSpend } from './financial-state.js';

describe('calculateSafeToSpend', () => {
  it('protects obligations, reserves, floor, and pending outflows', () => {
    expect(calculateSafeToSpend({
      currency: 'USD',
      liquidAssets: 100_000n,
      committedObligations: 20_000n,
      reserves: 15_000n,
      survivalFloor: 10_000n,
      pendingOutflows: 5_000n,
    })).toBe(50_000n);
  });

  it('fails closed at zero when protected capital exceeds liquidity', () => {
    expect(calculateSafeToSpend({
      currency: 'USD',
      liquidAssets: 10_000n,
      committedObligations: 20_000n,
      reserves: 0n,
      survivalFloor: 0n,
      pendingOutflows: 0n,
    })).toBe(0n);
  });

  it('rejects negative financial inputs', () => {
    expect(() => calculateSafeToSpend({
      currency: 'USD',
      liquidAssets: -1n,
      committedObligations: 0n,
      reserves: 0n,
      survivalFloor: 0n,
      pendingOutflows: 0n,
    })).toThrow('MONEY_NEGATIVE_VALUE:liquidAssets');
  });
});

describe('calculateCapitalAllocation', () => {
  it('caps risk capital as a percentage of safe-to-spend', () => {
    const result = calculateCapitalAllocation({
      currency: 'USD',
      liquidAssets: 100_000n,
      committedObligations: 20_000n,
      reserves: 15_000n,
      survivalFloor: 10_000n,
      pendingOutflows: 5_000n,
    }, { riskCapitalBps: 2_000n });

    expect(result.safeToSpend).toBe(50_000n);
    expect(result.riskCapitalLimit).toBe(10_000n);
    expect(result.operatingCapital).toBe(40_000n);
    expect(result.availableRiskCapital).toBe(10_000n);
  });

  it('never reports more available risk capital than the risk limit', () => {
    const result = calculateCapitalAllocation({
      currency: 'USD',
      liquidAssets: 100_000n,
      committedObligations: 0n,
      reserves: 0n,
      survivalFloor: 0n,
      pendingOutflows: 0n,
    }, { riskCapitalBps: 1_000n, allocatedRiskCapital: 20_000n });

    expect(result.riskCapitalLimit).toBe(10_000n);
    expect(result.availableRiskCapital).toBe(0n);
  });

  it('rejects a risk allocation above 100%', () => {
    expect(() => calculateCapitalAllocation({
      currency: 'USD',
      liquidAssets: 100n,
      committedObligations: 0n,
      reserves: 0n,
      survivalFloor: 0n,
      pendingOutflows: 0n,
    }, { riskCapitalBps: 10_001n })).toThrow('MONEY_INVALID_RISK_BPS');
  });
});
