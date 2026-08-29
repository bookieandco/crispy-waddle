export type MoneyAccountOwnership = 'owned' | 'authorized' | 'external' | 'unknown';

export type MoneyAccountKind =
  | 'bank'
  | 'brokerage'
  | 'crypto_exchange'
  | 'crypto_wallet'
  | 'payment'
  | 'other';

export type MoneyAccountState = {
  id: string;
  provider: string;
  externalId: string;
  kind: MoneyAccountKind;
  currency: string;
  ownership: MoneyAccountOwnership;
  balanceMinor: bigint;
  availableBalanceMinor: bigint;
  pendingOutflowMinor: bigint;
  updatedAt: string;
};

export type CapitalState = {
  currency: string;
  totalAssetsMinor: bigint;
  liquidAssetsMinor: bigint;
  committedObligationsMinor: bigint;
  reservesMinor: bigint;
  survivalFloorMinor: bigint;
  pendingOutflowsMinor: bigint;
  safeToSpendMinor: bigint;
  riskCapitalLimitMinor: bigint;
  allocatedRiskCapitalMinor: bigint;
  availableRiskCapitalMinor: bigint;
};

export function assertOwnedCapitalAccount(account: MoneyAccountState): void {
  if (account.ownership !== 'owned') {
    throw new Error('MONEY_ACCOUNT_NOT_OWNED');
  }
}

export function assertCapitalCurrency(expected: string, actual: string): void {
  if (expected.toUpperCase() !== actual.toUpperCase()) {
    throw new Error(`MONEY_CURRENCY_MISMATCH:${expected}:${actual}`);
  }
}
