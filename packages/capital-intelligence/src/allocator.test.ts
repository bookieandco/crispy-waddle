import { describe, expect, it } from 'vitest';
import { deployableCapital, rankOpportunities, recommendTreasury } from './allocator.js';
import type { CapitalPosition, Opportunity } from './domain.js';

describe('capital allocator', () => {
  const positions: CapitalPosition[] = [
    { bucket: 'required', balance: { amount: 300, currency: 'USD' } },
    { bucket: 'tax_reserve', balance: { amount: 100, currency: 'USD' } },
    { bucket: 'operating_reserve', balance: { amount: 100, currency: 'USD' } },
    { bucket: 'unallocated', balance: { amount: 500, currency: 'USD' } },
  ];

  it('keeps protected buckets out of deployable capital', () => {
    expect(deployableCapital(positions)).toEqual({ amount: 500, currency: 'USD' });
  });

  it('ranks positive edge by confidence, liquidity, and risk', () => {
    const make = (id: string, expectedValue: number, riskScore: number): Opportunity => ({
      id,
      domain: 'equities',
      instrument: id,
      strategy: 'test',
      side: 'buy',
      expectedValue,
      confidence: 0.8,
      riskScore,
      liquidityScore: 0.9,
      observedAt: new Date().toISOString(),
      evidence: [],
    });
    expect(rankOpportunities([make('high-risk', 0.2, 0.9), make('better', 0.1, 0.1)])[0].id).toBe('better');
  });

  it('creates a recommendation when a bucket is below target', () => {
    const result = recommendTreasury([
      { bucket: 'operating_reserve', balance: { amount: 50, currency: 'USD' }, target: { amount: 100, currency: 'USD' } },
    ], '2026-08-24T12:00:00.000Z');
    expect(result[0]).toMatchObject({ kind: 'transfer', toBucket: 'operating_reserve', amount: { amount: 50, currency: 'USD' } });
  });
});
