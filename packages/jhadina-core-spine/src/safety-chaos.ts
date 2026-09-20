export type SafetyFailure =
  | 'cellular-loss'
  | 'wifi-loss'
  | 'gps-loss'
  | 'camera-denied'
  | 'microphone-denied'
  | 'storage-pressure'
  | 'power-loss'
  | 'app-restart'
  | 'duplicate-event'
  | 'corrupt-evidence'
  | 'provider-outage'
  | 'device-disappearance';

export interface SafetyChaosCase {
  readonly id: string;
  readonly failures: readonly SafetyFailure[];
  readonly mustPreserve: readonly ('policy' | 'audit' | 'authorization-scope' | 'evidence-integrity' | 'idempotency')[];
}

export const safetyChaosMatrix: readonly SafetyChaosCase[] = [
  { id: 'offline', failures: ['cellular-loss', 'wifi-loss'], mustPreserve: ['policy', 'audit', 'authorization-scope'] },
  { id: 'sensor-degraded', failures: ['gps-loss', 'camera-denied'], mustPreserve: ['policy', 'authorization-scope'] },
  { id: 'restart-offline', failures: ['app-restart', 'cellular-loss'], mustPreserve: ['audit', 'idempotency'] },
  { id: 'evidence-corruption', failures: ['corrupt-evidence'], mustPreserve: ['evidence-integrity', 'audit'] },
  { id: 'provider-and-device', failures: ['provider-outage', 'device-disappearance'], mustPreserve: ['policy', 'audit', 'authorization-scope'] },
];
