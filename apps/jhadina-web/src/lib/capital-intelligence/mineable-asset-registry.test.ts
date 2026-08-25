import assert from 'node:assert/strict';
import test from 'node:test';
import { createMineableAssetRegistry, findMineableAssets } from './mineable-asset-registry';

test('registry supports hardware filtering and merged-mining metadata', () => {
  const registry = createMineableAssetRegistry([
    {
      id: 'btc', symbol: 'BTC', name: 'Bitcoin', domain: 'crypto', network: 'Bitcoin',
      algorithm: 'SHA-256', hardware: ['asic'], active: true, source: 'curated', observedAt: '2026-08-24T12:00:00Z',
    },
    {
      id: 'ltc', symbol: 'LTC', name: 'Litecoin', domain: 'crypto', network: 'Litecoin',
      algorithm: 'Scrypt', hardware: ['asic'], mergeMinedWith: ['doge'], active: true, source: 'curated', observedAt: '2026-08-24T12:00:00Z',
    },
    {
      id: 'doge', symbol: 'DOGE', name: 'Dogecoin', domain: 'crypto', network: 'Dogecoin',
      algorithm: 'Scrypt', hardware: ['asic'], mergeMinedWith: ['ltc'], active: true, source: 'curated', observedAt: '2026-08-24T12:00:00Z',
    },
  ], '2026-08-24T12:01:00Z');

  const scrypt = findMineableAssets(registry, 'asic', 'scrypt');
  assert.equal(scrypt.length, 2);
  assert.deepEqual(scrypt.find((asset) => asset.symbol === 'LTC')?.mergeMinedWith, ['doge']);
  assert.equal(findMineableAssets(registry, 'gpu', 'SHA-256').length, 0);
});

test('duplicate asset ids resolve to the latest supplied metadata', () => {
  const registry = createMineableAssetRegistry([
    { id: 'x', symbol: 'X', name: 'Old', domain: 'crypto', network: 'X', algorithm: 'A', hardware: ['cpu'], active: true, source: 'curated', observedAt: '1' },
    { id: 'x', symbol: 'X', name: 'New', domain: 'crypto', network: 'X', algorithm: 'A', hardware: ['gpu'], active: true, source: 'provider', observedAt: '2' },
  ], '2');
  assert.equal(registry.assets.length, 1);
  assert.equal(registry.assets[0].name, 'New');
});
