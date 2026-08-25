import assert from 'node:assert/strict';
import test from 'node:test';
import { deployableCapital, rankOpportunities, recommendTreasury } from './allocator.js';
import type { CapitalPosition, Opportunity } from './domain.js';

test('keeps protected buckets out of deployable capital', () => {
  const positions: CapitalPosition[] = [
    { bucket: 'required', balance: { amount: 300, currency: 'USD' } },
    { bucket: 'tax_reserve', balance: { amount: 100, currency: 'USD' } },
    { bucket: 'operating_reserve', balance: { amount: 100, currency: 'USD' } },
    { bucket: 'unallocated', balance: { amount: 500, currency: 'USD' } },
  ];
  assert.deepEqual(deployableCapital(positions), { amount: 500, currency: 'USD' });
});

test('ranks opportunities by expected value adjusted for confidence, liquidity, and risk', () => {
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
  assert.equal(rankOpportunities([make('high-risk', 0.2, 0.9), make('better', 0.1, 0.1)])[0].id, 'better');
});

test('creates a recommendation when a bucket is below target', () => {
  const result = recommendTreasury([
    { bucket: 'operating_reserve', balance: { amount: 50, currency: 'USD' }, target: { amount: 100, currency: 'USD' } },
  ], '2026-08-24T12:00:00.000Z');
  assert.deepEqual(result[0]?.amount, { amount: 50, currency: 'USD' });
  assert.equal(result[0]?.toBucket, 'operating_reserve');
});
