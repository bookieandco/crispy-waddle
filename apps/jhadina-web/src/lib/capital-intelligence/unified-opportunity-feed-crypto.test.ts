import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUnifiedOpportunityFeed } from './unified-opportunity-feed';

test('preserves mining subtype in unified crypto opportunities', () => {
  const feed = buildUnifiedOpportunityFeed([{
    id: 'btc-mine-1',
    domain: 'crypto',
    instrument: 'BTC-mining',
    source: 'mining',
    asset: 'BTC',
    cryptoExposureSubtype: 'mining',
    metadata: { miner: 'bitaxe', algorithm: 'SHA-256' },
    expectedReturn: 0.03,
    probability: 0.7,
    downside: 0.01,
    liquidityScore: 0.5,
    confidence: 0.9,
    observedAt: '2026-08-24T12:00:00Z',
  }], '2026-08-24T12:01:00Z');

  assert.equal(feed.opportunities[0].domain, 'crypto');
  assert.equal(feed.opportunities[0].source, 'mining');
  assert.equal(feed.opportunities[0].cryptoExposureSubtype, 'mining');
  assert.equal(feed.opportunities[0].metadata.algorithm, 'SHA-256');
});
