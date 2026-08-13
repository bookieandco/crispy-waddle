import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_MINING_COINS, discoverMiningOpportunities } from '../src/coin-registry.ts';

const discover = (supportedAlgorithms: ('sha256' | 'scrypt' | 'randomx' | 'other')[]) =>
  discoverMiningOpportunities({ resourceId: 'test-resource', supportedAlgorithms });

test('SHA-256 hardware supports Bitcoin only', () => {
  const opportunities = discover(['sha256']);
  assert.deepEqual(
    opportunities.filter(item => item.compatible).map(item => item.coin.symbol),
    ['BTC'],
  );
  assert.equal(opportunities.find(item => item.coin.symbol === 'BTC')?.reasonCodes[0], 'ALGORITHM_SUPPORTED');
  assert.equal(opportunities.find(item => item.coin.symbol === 'DOGE')?.reasonCodes[0], 'ALGORITHM_UNSUPPORTED');
});

test('Scrypt hardware supports both Dogecoin and Litecoin', () => {
  const opportunities = discover(['scrypt']);
  assert.deepEqual(
    opportunities.filter(item => item.compatible).map(item => item.coin.symbol),
    ['DOGE', 'LTC'],
  );
  assert.deepEqual(
    opportunities.find(item => item.coin.symbol === 'DOGE')?.coin.mergeMinedWith,
    ['LTC'],
  );
  assert.deepEqual(
    opportunities.find(item => item.coin.symbol === 'LTC')?.coin.mergeMinedWith,
    ['DOGE'],
  );
});

test('RandomX hardware supports Monero', () => {
  const opportunities = discover(['randomx']);
  assert.equal(opportunities.find(item => item.coin.symbol === 'XMR')?.compatible, true);
  assert.equal(opportunities.find(item => item.coin.symbol === 'BTC')?.compatible, false);
});

test('incompatible hardware is never silently made mineable', () => {
  const opportunities = discover(['other']);
  assert.equal(opportunities.every(item => item.compatible === false), true);
  assert.equal(opportunities.every(item => item.reasonCodes.includes('ALGORITHM_UNSUPPORTED')), true);
});

test('default registry has the expected four proof-of-work opportunities', () => {
  assert.deepEqual(DEFAULT_MINING_COINS.map(coin => coin.symbol), ['BTC', 'DOGE', 'LTC', 'XMR']);
});
