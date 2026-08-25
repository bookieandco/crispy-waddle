import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeCryptoExposure } from './crypto-exposure';

test('preserves crypto exposure subtype while normalizing asset identity', () => {
  const exposure = normalizeCryptoExposure({
    subtype: 'mining',
    asset: 'btc',
    instrument: ' BTC-mining ',
    metadata: { miner: 'bitaxe' },
  });

  assert.equal(exposure.subtype, 'mining');
  assert.equal(exposure.asset, 'BTC');
  assert.equal(exposure.instrument, 'BTC-mining');
  assert.equal(exposure.metadata?.miner, 'bitaxe');
});
