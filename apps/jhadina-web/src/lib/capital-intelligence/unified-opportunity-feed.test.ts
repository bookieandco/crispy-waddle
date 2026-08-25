import assert from 'node:assert/strict';
import test from 'node:test';
import { buildUnifiedOpportunityFeed } from './unified-opportunity-feed';

test('normalizes mixed capital verticals without dropping domain metadata', () => {
  const feed = buildUnifiedOpportunityFeed([
    { id: 'stock-1', domain: 'equities', instrument: 'AAPL', source: 'market', asset: 'AAPL', metadata: { sector: 'technology' }, expectedReturn: .1, probability: .8, downside: .05, liquidityScore: .95, confidence: 1.2, observedAt: '2026-08-24T10:00:00Z' },
    { id: 'fx-1', domain: 'forex', instrument: 'EUR/USD', source: 'forex', metadata: { session: 'London' }, expectedReturn: .04, probability: .7, downside: .02, liquidityScore: .98, confidence: .7, observedAt: '2026-08-24T10:00:00Z' },
    { id: 'crypto-1', domain: 'crypto', instrument: 'BTC', source: 'crypto', asset: 'BTC', metadata: { venue: 'spot' }, expectedReturn: .12, probability: .65, downside: .08, liquidityScore: .9, confidence: .8, observedAt: '2026-08-24T10:00:00Z' },
    { id: 'sports-1', domain: 'sports', instrument: 'NBA:game-1', source: 'sports', metadata: { league: 'NBA' }, expectedReturn: .08, probability: .62, downside: .05, liquidityScore: .7, confidence: .6, observedAt: '2026-08-24T10:00:00Z' },
    { id: 'prediction-1', domain: 'prediction_markets', instrument: 'event-1', source: 'prediction-market', metadata: { contract: 'YES' }, expectedReturn: .09, probability: .6, downside: .04, liquidityScore: .65, confidence: .75, observedAt: '2026-08-24T10:00:00Z' },
    { id: 'mine-1', domain: 'crypto', instrument: 'BTC-mining', source: 'mining', asset: 'BTC', metadata: { miner: 'bitaxe', watts: 15 }, expectedReturn: .03, probability: .7, downside: 0, liquidityScore: .5, confidence: .9, observedAt: '2026-08-24T10:00:00Z' },
  ], '2026-08-24T10:01:00Z');

  assert.equal(feed.opportunities.length, 6);
  assert.equal(feed.opportunities[0].confidence, 1);
  assert.equal(feed.opportunities[0].metadata.sector, 'technology');
  assert.equal(feed.opportunities.find((x) => x.id === 'mine-1')?.metadata.miner, 'bitaxe');
  assert.equal(feed.opportunities.find((x) => x.id === 'sports-1')?.metadata.league, 'NBA');
});
