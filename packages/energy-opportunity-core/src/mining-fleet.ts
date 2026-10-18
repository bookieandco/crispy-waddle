/**
 * Read-only mining fleet contracts.
 *
 * This package deliberately stops at observation/normalization. It does not
 * start miners, submit shares, control hardware, hold credentials, or move
 * funds.
 */

export type MiningNetwork = 'bitcoin' | 'bitcoin-cash' | 'other-sha256';

export type MiningDeviceStatus = 'online' | 'offline' | 'degraded' | 'unknown';

export interface MiningDeviceObservation {
  deviceId: string;
  manufacturer?: string;
  model?: string;
  network: MiningNetwork;
  algorithm: 'sha256';
  status: MiningDeviceStatus;
  hashrateHps?: number;
  powerWatts?: number;
  temperatureC?: number;
  uptimeSeconds?: number;
  acceptedShares?: number;
  rejectedShares?: number;
  staleShares?: number;
  firmwareVersion?: string;
  observedAt: string;
}

export interface MiningPoolObservation {
  providerId: string;
  providerKind: 'pool' | 'proxy' | 'passthrough' | 'solo';
  network: MiningNetwork;
  workerId?: string;
  acceptedShares?: number;
  rejectedShares?: number;
  staleShares?: number;
  reportedHashrateHps?: number;
  effectiveHashrateHps?: number;
  difficulty?: number;
  poolFeeRate?: number;
  payoutAmountSats?: number;
  payoutTxid?: string;
  observedAt: string;
}

export interface MiningProviderDescriptor {
  providerId: string;
  displayName: string;
  networks: readonly MiningNetwork[];
  capabilities: readonly ('pool' | 'proxy' | 'passthrough' | 'solo' | 'telemetry' | 'share-log' | 'block-events')[];
  readOnly: true;
}

/**
 * Descriptor for ASICseer/ckpool-family deployments.
 * This is metadata only; no ASICseer process is spawned and no network
 * connection is opened by this package.
 */
export function asicseerProviderDescriptor(): MiningProviderDescriptor {
  return {
    providerId: 'asicseer',
    displayName: 'ASICseer Pool',
    networks: ['bitcoin-cash'],
    capabilities: ['pool', 'proxy', 'passthrough', 'solo', 'telemetry', 'share-log', 'block-events'],
    readOnly: true,
  };
}

export function hashRateHpsToGhps(hashrateHps: number): number {
  if (!Number.isFinite(hashrateHps) || hashrateHps < 0) {
    throw new Error('hashrateHps must be a finite non-negative number');
  }
  return hashrateHps / 1_000_000_000;
}

export function wattsToKwhPerDay(powerWatts: number): number {
  if (!Number.isFinite(powerWatts) || powerWatts < 0) {
    throw new Error('powerWatts must be a finite non-negative number');
  }
  return (powerWatts * 24) / 1_000;
}
