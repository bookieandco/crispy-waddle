import assert from 'node:assert/strict';
import test from 'node:test';
import { valueCapitalSnapshot } from './valuation';

test('values assets using supplied quotes and reports incomplete valuation', () => {
  const result = valueCapitalSnapshot(
    {
      connected: true,
      provider: 'test',
      assets: [
        { asset: 'USD', available: '900', hold: '0' },
        { asset: 'BTC', available: '0.01', hold: '0' },
      ],
      capabilities: { balances: true, accounts: true, trading: false, transfers: false, withdrawals: false },
    },
    [
      { asset: 'USD', quoteCurrency: 'USD', price: 1, observedAt: '2026-08-24T12:00:00Z', source: 'test' },
      { asset: 'BTC', quoteCurrency: 'USD', price: 100000, observedAt: '2026-08-24T12:00:00Z', source: 'test' },
    ],
    'USD',
    '2026-08-24T12:01:00Z',
  );

  assert.equal(result.totalValue, 1900);
  assert.equal(result.complete, true);
  assert.deepEqual(result.unpricedAssets, []);
});

test('never invents an FX conversion when a quote is missing', () => {
  const result = valueCapitalSnapshot(
    {
      connected: true,
      provider: 'test',
      assets: [{ asset: 'EUR', available: '100', hold: '0' }],
      capabilities: { balances: true, accounts: true, trading: false, transfers: false, withdrawals: false },
    },
    [],
  );
  assert.equal(result.totalValue, 0);
  assert.equal(result.complete, false);
  assert.deepEqual(result.unpricedAssets, ['EUR']);
});
