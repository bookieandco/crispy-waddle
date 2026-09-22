import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreMemecoin } from './scorer.js';

test('hard stops a thin-liquidity token even when momentum is strong', () => {
  const result = scoreMemecoin({
    market: {
      mint: 'mint-a', chain: 'solana', priceUsd: 0.001, liquidityUsd: 5_000,
      volume5mUsd: 100_000, volume1hUsd: 250_000, priceChange5mPct: 80,
      priceChange1hPct: 140, buys5m: 900, sells5m: 200, top10HolderPct: 40,
      mintAuthorityRevoked: true, freezeAuthorityRevoked: true, lpLockedOrBurned: false,
    },
  });

  assert.equal(result.action, 'avoid');
  assert.ok(result.hardStops.some(x => x.includes('Liquidity')));
});

test('does not confuse social hype with a safe trade', () => {
  const result = scoreMemecoin({
    market: {
      mint: 'mint-b', chain: 'solana', priceUsd: 0.002, liquidityUsd: 120_000,
      volume5mUsd: 40_000, volume1hUsd: 180_000, priceChange5mPct: 22,
      priceChange1hPct: 35, buys5m: 500, sells5m: 180, top10HolderPct: 55,
      mintAuthorityRevoked: true, freezeAuthorityRevoked: true, lpLockedOrBurned: true,
      deployerSoldPct: 2,
    },
    social: [{
      source: 'telegram', observedAt: new Date().toISOString(), messageId: '1', text: 'buy now!!!',
      classification: 'scam-pattern', sentiment: 'bullish', confidence: 0.9, coordinated: true,
    }],
  });

  assert.ok(result.rugRisk > 0);
  assert.ok(result.reasons.some(x => x.includes('manipulation')));
});
