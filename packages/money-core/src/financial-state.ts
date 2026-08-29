export type Currency = string;

/** Exact monetary value represented in minor currency units. */
export type MoneyAmount = {
  currency: Currency;
  minorUnits: bigint;
};

export type FinancialAccountKind =
  | 'bank'
  | 'brokerage'
  | 'crypto_exchange'
  | 'wallet'
  | 'payment'
  | 'other';

export type FinancialAccount = {
  id: string;
  provider: string;
  externalId: string;
  kind: FinancialAccountKind;
  currency: Currency;
  ownedByUser: boolean;
  /** Spendable balance after provider-side holds, when known. */
  available?: MoneyAmount;
  /** Total balance reported by the provider, when known. */
  balance?: MoneyAmount;
  lastSyncedAt?: string;
};

export type FinancialObligation = {
  id: string;
  currency: Currency;
  amount: bigint;
  dueAt?: string;
  status: 'open' | 'scheduled' | 'paid' | 'cancelled';
  priority: 'survival' | 'essential' | 'operating' | 'discretionary';
};

export type CapitalReserve = {
  id: string;
  currency: Currency;
  amount: bigint;
  reason: 'survival' | 'tax' | 'emergency' | 'operating' | 'custom';
  locked: boolean;
};

export type FinancialState = {
  currency: Currency;
  liquidAssets: bigint;
  committedObligations: bigint;
  reserves: bigint;
  survivalFloor: bigint;
  pendingOutflows: bigint;
};

export type CapitalAllocationSnapshot = {
  currency: Currency;
  totalLiquidAssets: bigint;
  committedObligations: bigint;
  reserves: bigint;
  survivalFloor: bigint;
  pendingOutflows: bigint;
  safeToSpend: bigint;
  operatingCapital: bigint;
  riskCapitalLimit: bigint;
  allocatedRiskCapital: bigint;
  availableRiskCapital: bigint;
};

function nonNegative(value: bigint, field: string): bigint {
  if (value < 0n) throw new Error(`MONEY_NEGATIVE_VALUE:${field}`);
  return value;
}

function assertCurrency(currency: string): void {
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('MONEY_INVALID_CURRENCY');
}

/**
 * Deterministically derives safe-to-spend from financial state.
 * No model/provider data can override these arithmetic constraints.
 */
export function calculateSafeToSpend(state: FinancialState): bigint {
  assertCurrency(state.currency);
  const liquid = nonNegative(state.liquidAssets, 'liquidAssets');
  const obligations = nonNegative(state.committedObligations, 'committedObligations');
  const reserves = nonNegative(state.reserves, 'reserves');
  const floor = nonNegative(state.survivalFloor, 'survivalFloor');
  const pending = nonNegative(state.pendingOutflows, 'pendingOutflows');

  const protectedCapital = obligations + reserves + floor + pending;
  return liquid > protectedCapital ? liquid - protectedCapital : 0n;
}

/**
 * Applies a deterministic risk-capital policy on top of safe-to-spend.
 * riskCapitalBps is bounded to 0..10000 (100%).
 */
export function calculateCapitalAllocation(
  state: FinancialState,
  options: { riskCapitalBps: bigint; operatingCapitalFloor?: bigint; allocatedRiskCapital?: bigint },
): CapitalAllocationSnapshot {
  const safeToSpend = calculateSafeToSpend(state);
  const riskCapitalBps = nonNegative(options.riskCapitalBps, 'riskCapitalBps');
  if (riskCapitalBps > 10_000n) throw new Error('MONEY_INVALID_RISK_BPS');

  const operatingCapitalFloor = nonNegative(options.operatingCapitalFloor ?? 0n, 'operatingCapitalFloor');
  const allocatedRiskCapital = nonNegative(options.allocatedRiskCapital ?? 0n, 'allocatedRiskCapital');
  const riskCapitalLimit = (safeToSpend * riskCapitalBps) / 10_000n;
  const operatingCapital = safeToSpend > riskCapitalLimit ? safeToSpend - riskCapitalLimit : 0n;
  const availableRiskCapital = riskCapitalLimit > allocatedRiskCapital
    ? riskCapitalLimit - allocatedRiskCapital
    : 0n;

  return {
    currency: state.currency,
    totalLiquidAssets: state.liquidAssets,
    committedObligations: state.committedObligations,
    reserves: state.reserves,
    survivalFloor: state.survivalFloor,
    pendingOutflows: state.pendingOutflows,
    safeToSpend,
    operatingCapital: operatingCapital < operatingCapitalFloor ? 0n : operatingCapital,
    riskCapitalLimit,
    allocatedRiskCapital,
    availableRiskCapital,
  };
}
