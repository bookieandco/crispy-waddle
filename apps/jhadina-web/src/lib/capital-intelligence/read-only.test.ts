import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCapitalIntelligenceSnapshot } from './read-only';

test('builds a read-only capital snapshot without execution capabilities', () => {
  const result = buildCapitalIntelligenceSnapshot({
    connected: true,
    provider: 'test',
    assets: [
      { asset: 'USD', available: '900', hold: '0' },
      { asset: 'BTC', available: '0.01', hold: '0' },
    ],
    capabilities: { balances: true, accounts: true, trading: true, transfers: true, withdrawals: true },
  });

  assert.equal(result.positions.length, 2);
  assert.equal(result.deployableCapital.currency, 'USD');
  assert.equal(result.rankedOpportunities.length, 0);
  assert.equal(result.treasuryRecommendations.length, 0);
});
