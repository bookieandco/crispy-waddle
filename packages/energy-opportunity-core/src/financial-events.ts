export const MINING_FINANCIAL_EVENT_SCHEMA_VERSION = 1 as const;

export type MiningFinancialEventKind =
  | 'mining_economics_projected'
  | 'electricity_expense_observed'
  | 'mining_payout_verified'
  | 'mining_profitability_snapshot';

export interface MiningFinancialEventBase {
  schemaVersion: typeof MINING_FINANCIAL_EVENT_SCHEMA_VERSION;
  eventId: string;
  kind: MiningFinancialEventKind;
  resourceId: string;
  occurredAt: string;
  currency: 'USD';
  source: 'energy-opportunity-core' | 'bitcoin-core' | 'meter' | 'money-core';
  immutable: true;
}

export interface MiningEconomicsProjectedEvent extends MiningFinancialEventBase {
  kind: 'mining_economics_projected';
  estimatedGrossPerHour: number;
  estimatedElectricityPerHour: number;
  estimatedNetPerHour: number;
  confidence: number;
}

export interface ElectricityExpenseObservedEvent extends MiningFinancialEventBase {
  kind: 'electricity_expense_observed';
  amountUsd: number;
  powerWatts: number;
  durationSeconds: number;
  rateUsdPerKwh: number;
}

export interface MiningPayoutVerifiedEvent extends MiningFinancialEventBase {
  kind: 'mining_payout_verified';
  currency: 'BTC';
  source: 'bitcoin-core';
  walletAddress: string;
  txid: string;
  amountBtc: number;
  confirmations: number;
  verifiedAt: string;
}

export interface MiningProfitabilitySnapshotEvent extends MiningFinancialEventBase {
  kind: 'mining_profitability_snapshot';
  estimatedGrossUsd: number;
  electricityUsd: number;
  realizedBtc: number;
  realizedUsd: number;
  netUsd: number;
}

export type MiningFinancialEvent =
  | MiningEconomicsProjectedEvent
  | ElectricityExpenseObservedEvent
  | MiningPayoutVerifiedEvent
  | MiningProfitabilitySnapshotEvent;

export function isGovernedMiningFinancialEvent(value: unknown): value is MiningFinancialEvent {
  if (!value || typeof value !== 'object') return false;
  const event = value as Partial<MiningFinancialEvent>;
  return event.schemaVersion === MINING_FINANCIAL_EVENT_SCHEMA_VERSION
    && event.immutable === true
    && typeof event.eventId === 'string'
    && typeof event.resourceId === 'string'
    && typeof event.occurredAt === 'string'
    && typeof event.kind === 'string';
}

export function electricityExpenseUsd(powerWatts: number, durationSeconds: number, rateUsdPerKwh: number): number {
  const watts = Math.max(0, powerWatts);
  const seconds = Math.max(0, durationSeconds);
  const rate = Math.max(0, rateUsdPerKwh);
  return (watts / 1000) * (seconds / 3600) * rate;
}
