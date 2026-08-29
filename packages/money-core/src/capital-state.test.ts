import { describe, expect, it } from 'vitest';
import { assertCapitalCurrency, assertOwnedCapitalAccount, type MoneyAccountState } from './capital-state.js';

const account: MoneyAccountState = {
  id: 'acct_1',
  provider: 'test-bank',
  externalId: 'external_1',
  kind: 'bank',
  currency: 'USD',
  ownership: 'owned',
  balanceMinor: 100_00n,
  availableBalanceMinor: 100_00n,
  pendingOutflowMinor: 0n,
  updatedAt: '2026-08-29T00:00:00.000Z',
};

describe('capital account ownership', () => {
  it('accepts an owned account', () => {
    expect(() => assertOwnedCapitalAccount(account)).not.toThrow();
  });

  it('rejects an external account', () => {
    expect(() => assertOwnedCapitalAccount({ ...account, ownership: 'external' })).toThrow('MONEY_ACCOUNT_NOT_OWNED');
  });
});

describe('capital currency', () => {
  it('compares currencies case-insensitively', () => {
    expect(() => assertCapitalCurrency('usd', 'USD')).not.toThrow();
  });

  it('rejects mismatched currencies', () => {
    expect(() => assertCapitalCurrency('USD', 'BTC')).toThrow('MONEY_CURRENCY_MISMATCH:USD:BTC');
  });
});
