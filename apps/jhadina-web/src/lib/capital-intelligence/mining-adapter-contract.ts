import type { CapitalDomain } from './taxonomy';

export type MiningSource = 'bitaxe' | 'cgminer-bitaxe' | 'gminer' | 'teamredminer' | 'cpuminer' | 'asicseer';

export type MiningTelemetry = {
  source: MiningSource;
  minerId: string;
  domain: CapitalDomain;
  instrument: string;
  observedAt: string;
  hashratePerSecond: number;
  powerWatts: number;
  acceptedShares?: number;
  rejectedShares?: number;
  hardwareErrors?: number;
  temperatureC?: number;
  uptimePct?: number;
  pool?: string;
  algorithm?: string;
};

/** Read/normalize telemetry only. Adapters must not execute financial actions. */
export function normalizeMiningTelemetry(input: MiningTelemetry): MiningTelemetry {
  return {
    ...input,
    hashratePerSecond: Math.max(0, input.hashratePerSecond),
    powerWatts: Math.max(0, input.powerWatts),
    acceptedShares: input.acceptedShares === undefined ? undefined : Math.max(0, input.acceptedShares),
    rejectedShares: input.rejectedShares === undefined ? undefined : Math.max(0, input.rejectedShares),
    hardwareErrors: input.hardwareErrors === undefined ? undefined : Math.max(0, input.hardwareErrors),
    uptimePct: input.uptimePct === undefined ? undefined : Math.max(0, Math.min(1, input.uptimePct)),
  };
}
