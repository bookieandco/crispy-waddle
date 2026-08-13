import type { BitaxeTelemetry } from './bitaxe.ts';

export interface MiningMoneyProjection {
  resourceId: string;
  observedAt: string;
  currency: 'USD';
  hashrateThs: number;
  powerWatts: number;
  electricityRatePerKwh: number;
  estimatedGrossPerHour: number;
  estimatedElectricityPerHour: number;
  estimatedNetPerHour: number;
  confidence: number;
  status: 'projected' | 'unavailable';
}

export interface MiningMoneyProjectionInput {
  resourceId: string;
  telemetry: BitaxeTelemetry;
  electricityRatePerKwh: number;
  estimatedGrossPerHour: number;
  confidence: number;
  observedAt?: string;
}

/**
 * Converts read-only Bitaxe telemetry into a Money Core-compatible projection.
 * No credentials, wallet keys, payments, transfers, or ledger writes occur here.
 */
export function projectMiningEconomics(input: MiningMoneyProjectionInput): MiningMoneyProjection {
  const powerWatts = Math.max(0, input.telemetry.powerWatts ?? 0);
  const electricity = (powerWatts / 1000) * Math.max(0, input.electricityRatePerKwh);
  const gross = Math.max(0, input.estimatedGrossPerHour);

  return {
    resourceId: input.resourceId,
    observedAt: input.observedAt ?? new Date().toISOString(),
    currency: 'USD',
    hashrateThs: Math.max(0, input.telemetry.hashRateGh ?? 0) / 1000,
    powerWatts,
    electricityRatePerKwh: Math.max(0, input.electricityRatePerKwh),
    estimatedGrossPerHour: gross,
    estimatedElectricityPerHour: electricity,
    estimatedNetPerHour: gross - electricity,
    confidence: Math.min(1, Math.max(0, input.confidence)),
    status: 'projected',
  };
}

export interface RealizedMiningPayout {
  payoutId: string;
  walletAddress: string;
  amountBtc: number;
  txid: string;
  verifiedAt: string;
  source: 'on-chain-verification';
}

/** Realized payouts are kept separate from estimates and require independent verification. */
export function isVerifiedMiningPayout(value: RealizedMiningPayout): boolean {
  return value.source === 'on-chain-verification'
    && value.amountBtc > 0
    && value.walletAddress.length > 0
    && value.txid.length > 0;
}
